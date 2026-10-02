/**
 * `GithubSourceReader` (M1-W2): implementación real de `SourceReader` contra
 * la API de GitHub + tarball del commit (estrategia B+A de
 * `docs/milestones/M1_AUDIT_PLAN.md` §4.2).
 *
 * Flujo:
 * 1. `GET /repos/{owner}/{repo}` → default branch (AC-1.2).
 * 2. `GET /repos/{owner}/{repo}/commits/{ref}` → SHA completo + fecha (AC-1.3).
 * 3. `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` → inventario
 *    autoritativo con `blob_sha`, `mode` y `size`; `truncated=true` falla con
 *    error tipado (AC-1.4).
 * 4. `GET https://codeload.github.com/{owner}/{repo}/tar.gz/{sha}` una sola vez
 *    por commit; se descomprime con `node:zlib` y se extrae con `tar-stream`
 *    quitando el prefijo del directorio raíz del tarball; `readFile` devuelve
 *    los bytes exactos (AC-1.9).
 *
 * Decisiones:
 * - Solo se cachea lo direccionable por contenido (árbol y tarball por SHA de
 *   commit). `getRepository` y `resolveCommit` no se cachean: un mismo reader
 *   puede volver a preguntar por una rama móvil sin quedarse con un valor
 *   viejo.
 * - `fetch` es inyectable (`fetchImpl`) para tests sin red.
 * - `GITHUB_TOKEN` es opcional y solo se envía a `api.github.com`; nunca al
 *   codeload ni a raw. Nunca se registra.
 * - Fallback opcional por archivo a `raw.githubusercontent.com` (por defecto
 *   activado), pensado para archivos individuales; el tarball sigue siendo la
 *   vía primaria y su fallo se memoriza por commit para no reintentarlo en
 *   bucle.
 */

import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract, type ExtractEvents } from "tar-stream";
import {
  SOURCE_DEFAULT_REPOSITORY,
  type ResolvedSourceCommit,
  type SourceCommitSha,
  type SourcePath,
  type SourceReader,
  type SourceRepositoryDescriptor,
  type SourceTree,
  type SourceTreeBlobEntry,
  type SourceTreeEntry,
  type SourceTreeReferenceEntry,
} from "../types";
import {
  CommitResolutionError,
  FileReadError,
  RepositoryResolutionError,
  SourceReaderConfigError,
  SourceReaderError,
  TarballReadError,
  TreeReadError,
  TreeTruncatedError,
  type SourceHttpErrorContext,
  type SourceRateLimitInfo,
} from "./errors";

const DEFAULT_API_BASE_URL = "https://api.github.com";
const DEFAULT_TARBALL_BASE_URL = "https://codeload.github.com";
const DEFAULT_RAW_BASE_URL = "https://raw.githubusercontent.com";

const USER_AGENT = "ai-engineering-syllabus-platform-source-reader";

const API_ACCEPT = "application/vnd.github+json";
const API_VERSION = "2022-11-28";

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const TREE_MODE_PATTERN = /^[0-7]{5,6}$/;

const MAX_API_ERROR_BODY_LENGTH = 300;

/** `fetch` de la plataforma, inyectable en tests. */
export type FetchLike = typeof globalThis.fetch;

export type GithubSourceReaderConfig = {
  /** Repo en formato `owner/name`; por defecto `SOURCE_DEFAULT_REPOSITORY`. */
  repo?: string;
  /** Token de solo lectura; `null`/ausente = peticiones anónimas. */
  token?: string | null;
  /** Implementación de `fetch`; por defecto `globalThis.fetch`. */
  fetchImpl?: FetchLike;
  /** Fallback por archivo a raw.githubusercontent.com (por defecto `true`). */
  rawFallback?: boolean;
  apiBaseUrl?: string;
  tarballBaseUrl?: string;
  rawBaseUrl?: string;
};

export type GithubSourceReaderEnv = Readonly<
  Record<string, string | undefined>
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyEnv(
  env: GithubSourceReaderEnv,
  name: string,
): string | null {
  const value = env[name];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const REPOSITORY_SLUG_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

function invalidRepositorySegmentReason(segment: string): string | null {
  if (segment === "." || segment === "..") {
    return 'no puede ser "." ni ".."';
  }
  if (!REPOSITORY_SLUG_SEGMENT_PATTERN.test(segment)) {
    return "solo admite letras, números, punto, guion y guion bajo (^[A-Za-z0-9._-]+$)";
  }
  return null;
}

function parseRepositorySlug(repo: string): { owner: string; name: string } {
  const trimmed = repo.trim();
  const segments = trimmed.split("/");
  if (
    segments.length !== 2 ||
    segments[0]?.trim() === "" ||
    segments[1]?.trim() === ""
  ) {
    throw new SourceReaderConfigError(
      `"${repo}" no es un repo válido: usa el formato "owner/name"`,
    );
  }
  const owner = segments[0].trim();
  const name = segments[1].trim();
  const ownerReason = invalidRepositorySegmentReason(owner);
  if (ownerReason) {
    throw new SourceReaderConfigError(
      `"${repo}" no es un repo válido: "owner" ${ownerReason}`,
    );
  }
  const nameReason = invalidRepositorySegmentReason(name);
  if (nameReason) {
    throw new SourceReaderConfigError(
      `"${repo}" no es un repo válido: "name" ${nameReason}`,
    );
  }
  return { owner, name };
}

function normalizeToken(token: string | null | undefined): string | null {
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim();
  return trimmed === "" ? null : trimmed;
}

function readIntegerHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

/** Lee `x-ratelimit-*`; `null` si la respuesta no trae ninguna cabecera. */
export function readRateLimit(headers: Headers): SourceRateLimitInfo | null {
  const limit = readIntegerHeader(headers, "x-ratelimit-limit");
  const remaining = readIntegerHeader(headers, "x-ratelimit-remaining");
  const resetSeconds = readIntegerHeader(headers, "x-ratelimit-reset");
  if (limit === null && remaining === null && resetSeconds === null) {
    return null;
  }
  return {
    limit,
    remaining,
    resetAt:
      resetSeconds === null
        ? null
        : new Date(resetSeconds * 1000).toISOString(),
  };
}

async function readApiErrorMessage(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    if (text.trim() === "") {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed) && typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // Cuerpo no JSON: se devuelve truncado tal cual.
    }
    return text.slice(0, MAX_API_ERROR_BODY_LENGTH);
  } catch {
    return null;
  }
}

function readCommitDate(payload: Record<string, unknown>): string | null {
  const commit = payload.commit;
  if (!isRecord(commit)) {
    return null;
  }
  const committer = commit.committer;
  if (isRecord(committer) && typeof committer.date === "string") {
    return committer.date;
  }
  const author = commit.author;
  if (isRecord(author) && typeof author.date === "string") {
    return author.date;
  }
  return null;
}

function normalizeTreeMode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!TREE_MODE_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed.padStart(6, "0");
}

function mapTreeEntry(
  raw: unknown,
  index: number,
  commitSha: SourceCommitSha,
  url: string,
): SourceTreeEntry {
  const invalid = (reason: string): TreeReadError =>
    new TreeReadError(commitSha, {
      url,
      cause: new Error(`entrada tree[${index}] inválida: ${reason}`),
    });

  if (!isRecord(raw)) {
    throw invalid("no es un objeto");
  }
  const entryPath = raw.path;
  const sha = raw.sha;
  const mode = normalizeTreeMode(raw.mode);
  const type = raw.type;

  if (typeof entryPath !== "string" || entryPath === "") {
    throw invalid("falta path");
  }
  if (typeof sha !== "string" || sha === "") {
    throw invalid("falta sha");
  }

  if (type === "blob") {
    if (mode !== "100644" && mode !== "100755" && mode !== "120000") {
      throw invalid(`modo de blob no soportado "${String(raw.mode)}"`);
    }
    if (
      typeof raw.size !== "number" ||
      !Number.isFinite(raw.size) ||
      raw.size < 0
    ) {
      throw invalid("blob sin size válido");
    }
    const blobEntry: SourceTreeBlobEntry = {
      type: "blob",
      path: entryPath,
      blobSha: sha,
      size: raw.size,
      mode,
    };
    return blobEntry;
  }

  if (type === "tree") {
    if (mode !== "040000") {
      throw invalid(`modo de tree no soportado "${String(raw.mode)}"`);
    }
    const treeEntry: SourceTreeReferenceEntry = {
      type: "tree",
      path: entryPath,
      objectSha: sha,
      mode: "040000",
    };
    return treeEntry;
  }

  if (type === "commit") {
    if (mode !== "160000") {
      throw invalid(`modo de submódulo no soportado "${String(raw.mode)}"`);
    }
    const submoduleEntry: SourceTreeReferenceEntry = {
      type: "commit",
      path: entryPath,
      objectSha: sha,
      mode: "160000",
    };
    return submoduleEntry;
  }

  throw invalid(`type no soportado "${String(type)}"`);
}

function readTreeLength(payload: Record<string, unknown>): number {
  return Array.isArray(payload.tree) ? payload.tree.length : 0;
}

export function isFullCommitSha(value: string): boolean {
  return COMMIT_SHA_PATTERN.test(value);
}

/**
 * Normaliza un path posix relativo del repo fuente. Devuelve `null` si el path
 * es vacío, absoluto, usa `\` o contiene segmentos `.`/`..`/vacíos.
 */
export function normalizeSourcePath(value: string): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.startsWith("/") || trimmed.includes("\\")) {
    return null;
  }
  const withoutDotSlash = trimmed.replace(/^\.\//, "");
  const segments = withoutDotSlash.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return null;
  }
  return segments.join("/");
}

function encodeRawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Stream de entrada de `tar-stream` (streamx), no un `stream.Readable` de Node. */
type TarEntryStream = ExtractEvents["entry"][1];

function collectEntryBytes(stream: TarEntryStream): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: unknown) => {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array | string),
      );
    });
    stream.on("end", () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    stream.on("error", (error: unknown) => {
      reject(error);
    });
  });
}

/**
 * Extrae el tar.gz a un mapa `path relativo (sin prefijo raíz) → bytes`.
 *
 * - El prefijo de directorio raíz del tarball de GitHub (`<repo>-<sha>/`) se
 *   detecta con la primera entrada con `/` y se elimina de todas.
 * - Los nombres largos (pax) y las rutas anidadas se resuelven tal cual los
 *   entrega `tar-stream`.
 * - Los symlinks se guardan como los bytes de su destino (el contenido del
 *   blob git de un symlink es el propio target).
 * - Los paths con `..` o absolutos se descartan: el reader nunca escribe en
 *   disco, pero el mapa no debe ser ambiguo.
 */
export async function extractTarballFiles(
  tarball: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  let rootPrefix: string | null = null;

  const resolveEntryPath = (rawName: string): string | null => {
    const name = rawName
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .replace(/\/+$/, "");
    if (name === "") {
      return null;
    }
    const segments = name.split("/").filter((segment) => segment !== "");
    if (segments.some((segment) => segment === "." || segment === "..")) {
      return null;
    }
    if (segments.length >= 2) {
      if (rootPrefix === null) {
        rootPrefix = segments[0] ?? null;
      }
      if (rootPrefix !== null && segments[0] === rootPrefix) {
        segments.shift();
      }
    }
    const normalized = segments.join("/");
    return normalized === "" ? null : normalized;
  };

  const extractor = extract();

  extractor.on("entry", (header, entryStream, next) => {
    const fail = (error: unknown): void => {
      next(error instanceof Error ? error : new Error(String(error)));
    };

    if (header.type === "file") {
      collectEntryBytes(entryStream).then((bytes) => {
        const path = resolveEntryPath(header.name);
        if (path !== null && !files.has(path)) {
          files.set(path, bytes);
        }
        next();
      }, fail);
      return;
    }

    if (header.type === "symlink") {
      const path = resolveEntryPath(header.name);
      if (path !== null && !files.has(path)) {
        const target = header.linkname ?? "";
        files.set(path, new Uint8Array(Buffer.from(target, "utf8")));
      }
      entryStream.resume();
      next();
      return;
    }

    entryStream.resume();
    next();
  });

  // `extract()` usa los streams de `streamx`; en runtime interoperan con
  // `node:stream` (verificado por los tests) y aquí solo hace falta ajustar el
  // tipo para `pipeline`, que es de Node.
  await pipeline(
    Readable.from([Buffer.from(tarball)]),
    createGunzip(),
    extractor as unknown as Writable,
  );

  return files;
}

export class GithubSourceReader implements SourceReader {
  private readonly owner: string;

  private readonly name: string;

  private readonly repositoryLabel: string;

  private readonly token: string | null;

  private readonly fetchImpl: FetchLike;

  private readonly rawFallback: boolean;

  private readonly apiBaseUrl: string;

  private readonly tarballBaseUrl: string;

  private readonly rawBaseUrl: string;

  private readonly treeCache = new Map<SourceCommitSha, Promise<SourceTree>>();

  private readonly tarballCache = new Map<
    SourceCommitSha,
    Promise<Map<string, Uint8Array>>
  >();

  private readonly tarballFailures = new Map<
    SourceCommitSha,
    SourceReaderError
  >();

  constructor(config: GithubSourceReaderConfig = {}) {
    const { owner, name } = parseRepositorySlug(
      config.repo ?? SOURCE_DEFAULT_REPOSITORY,
    );
    this.owner = owner;
    this.name = name;
    this.repositoryLabel = `${owner}/${name}`;
    this.token = normalizeToken(config.token);
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new SourceReaderConfigError(
        "no hay `fetch` disponible: inyecta `fetchImpl` (Node >= 18 o tests)",
        "unexpected-error",
      );
    }
    this.rawFallback = config.rawFallback ?? true;
    this.apiBaseUrl = (config.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.tarballBaseUrl = (
      config.tarballBaseUrl ?? DEFAULT_TARBALL_BASE_URL
    ).replace(/\/+$/, "");
    this.rawBaseUrl = (config.rawBaseUrl ?? DEFAULT_RAW_BASE_URL).replace(
      /\/+$/,
      "",
    );
  }

  /** Repo configurado en formato `owner/name`. */
  get repository(): string {
    return this.repositoryLabel;
  }

  async getRepository(): Promise<SourceRepositoryDescriptor> {
    const makeError = (context: SourceHttpErrorContext): SourceReaderError =>
      new RepositoryResolutionError(this.repositoryLabel, context);
    const { payload, url } = await this.requestJson("", makeError);

    if (
      !isRecord(payload) ||
      typeof payload.default_branch !== "string" ||
      payload.default_branch.trim() === ""
    ) {
      throw makeError({
        url,
        cause: new Error(
          'la respuesta del repositorio no incluye "default_branch" como string no vacío',
        ),
      });
    }

    return {
      owner: this.owner,
      name: this.name,
      canonicalUrl: `https://github.com/${this.owner}/${this.name}`,
      defaultBranch: payload.default_branch.trim(),
    };
  }

  async resolveCommit(ref: string): Promise<ResolvedSourceCommit> {
    const normalizedRef = ref.trim();
    const makeError = (context: SourceHttpErrorContext): SourceReaderError =>
      new CommitResolutionError(normalizedRef, context);
    if (normalizedRef === "") {
      throw makeError({ cause: new Error("el ref está vacío") });
    }

    const { payload, url } = await this.requestJson(
      `/commits/${encodeURIComponent(normalizedRef)}`,
      makeError,
    );

    if (
      !isRecord(payload) ||
      typeof payload.sha !== "string" ||
      !COMMIT_SHA_PATTERN.test(payload.sha.trim().toLowerCase())
    ) {
      throw makeError({
        url,
        cause: new Error(
          'la respuesta del commit no incluye un "sha" SHA-1 de 40 hex',
        ),
      });
    }

    return {
      sha: payload.sha.trim().toLowerCase(),
      committedAt: readCommitDate(payload),
    };
  }

  async getTree(commitSha: SourceCommitSha): Promise<SourceTree> {
    const normalizedSha = commitSha.trim().toLowerCase();
    const cached = this.treeCache.get(normalizedSha);
    if (cached) {
      return cached;
    }
    const promise = this.fetchTree(normalizedSha).catch((error: unknown) => {
      this.treeCache.delete(normalizedSha);
      throw error;
    });
    this.treeCache.set(normalizedSha, promise);
    return promise;
  }

  async readFile(
    commitSha: SourceCommitSha,
    path: SourcePath,
  ): Promise<Uint8Array> {
    const normalizedSha = commitSha.trim().toLowerCase();
    const normalizedPath = normalizeSourcePath(path);

    if (!COMMIT_SHA_PATTERN.test(normalizedSha)) {
      throw new FileReadError(normalizedSha, path, {
        cause: new Error("commitSha no es un SHA-1 de 40 hex"),
      });
    }
    if (normalizedPath === null) {
      throw new FileReadError(normalizedSha, path, {
        cause: new Error(
          'path inválido: debe ser una ruta posix relativa sin "./", "..", "\\" ni segmentos vacíos',
        ),
      });
    }

    let tarballError: SourceReaderError | null = null;
    let tarballNote = `el path "${normalizedPath}" no existe en el tarball del commit`;
    try {
      const files = await this.ensureTarball(normalizedSha);
      const bytes = files.get(normalizedPath);
      if (bytes) {
        return new Uint8Array(bytes);
      }
    } catch (error) {
      tarballError =
        error instanceof SourceReaderError
          ? error
          : new TarballReadError(normalizedSha, {
              url: this.tarballUrl(normalizedSha),
              cause: error,
            });
      tarballNote = tarballError.message;
    }

    if (this.rawFallback) {
      const raw = await this.tryReadRawFile(normalizedSha, normalizedPath);
      if (raw) {
        return raw;
      }
    }

    const fallbackNote = this.rawFallback
      ? "el fallback a raw.githubusercontent.com tampoco devolvió los bytes"
      : "el fallback a raw.githubusercontent.com está desactivado (rawFallback=false)";

    throw new FileReadError(normalizedSha, normalizedPath, {
      url: this.rawUrl(normalizedSha, normalizedPath),
      note: `${tarballNote}; ${fallbackNote}`,
      cause: tarballError,
    });
  }

  private apiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: API_ACCEPT,
      "x-github-api-version": API_VERSION,
      "user-agent": USER_AGENT,
    };
    if (this.token !== null) {
      headers.authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request(
    path: string,
    makeError: (context: SourceHttpErrorContext) => SourceReaderError,
  ): Promise<{ url: string; response: Response }> {
    const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.name}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, { headers: this.apiHeaders() });
    } catch (cause) {
      throw makeError({ url, cause });
    }
    if (!response.ok) {
      const apiMessage = await readApiErrorMessage(response);
      throw makeError({
        url,
        status: response.status,
        statusText: response.statusText,
        rateLimit: readRateLimit(response.headers),
        apiMessage,
      });
    }
    return { url, response };
  }

  private async requestJson(
    path: string,
    makeError: (context: SourceHttpErrorContext) => SourceReaderError,
  ): Promise<{ url: string; payload: unknown }> {
    const { url, response } = await this.request(path, makeError);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw makeError({
        url,
        status: response.status,
        statusText: response.statusText,
        rateLimit: readRateLimit(response.headers),
        cause: new Error(`la respuesta no es JSON válido (${String(cause)})`),
      });
    }
    return { url, payload };
  }

  private async fetchTree(commitSha: SourceCommitSha): Promise<SourceTree> {
    const makeError = (context: SourceHttpErrorContext): SourceReaderError =>
      new TreeReadError(commitSha, context);
    if (!COMMIT_SHA_PATTERN.test(commitSha)) {
      throw makeError({
        cause: new Error("commitSha no es un SHA-1 de 40 hex"),
      });
    }

    const { payload, url } = await this.requestJson(
      `/git/trees/${commitSha}?recursive=1`,
      makeError,
    );

    if (!isRecord(payload)) {
      throw makeError({
        url,
        cause: new Error("la respuesta del árbol no es un objeto JSON"),
      });
    }
    if (payload.truncated === true) {
      throw new TreeTruncatedError(commitSha, readTreeLength(payload));
    }
    if (payload.truncated !== false) {
      throw makeError({
        url,
        cause: new Error(
          'la respuesta del árbol no declara "truncated": false',
        ),
      });
    }
    if (!Array.isArray(payload.tree)) {
      throw makeError({
        url,
        cause: new Error('la respuesta del árbol no incluye "tree" como array'),
      });
    }

    const entries = payload.tree.map((entry, index) =>
      mapTreeEntry(entry, index, commitSha, url),
    );
    return { commitSha, truncated: false, entries };
  }

  private tarballUrl(commitSha: SourceCommitSha): string {
    return `${this.tarballBaseUrl}/${this.owner}/${this.name}/tar.gz/${commitSha}`;
  }

  private rawUrl(commitSha: SourceCommitSha, path: string): string {
    return `${this.rawBaseUrl}/${this.owner}/${this.name}/${commitSha}/${encodeRawPath(path)}`;
  }

  private ensureTarball(
    commitSha: SourceCommitSha,
  ): Promise<Map<string, Uint8Array>> {
    const cached = this.tarballCache.get(commitSha);
    if (cached) {
      return cached;
    }
    const failed = this.tarballFailures.get(commitSha);
    if (failed) {
      return Promise.reject(failed);
    }
    const promise = this.downloadTarball(commitSha).catch((error: unknown) => {
      this.tarballCache.delete(commitSha);
      const typed =
        error instanceof SourceReaderError
          ? error
          : new TarballReadError(commitSha, {
              url: this.tarballUrl(commitSha),
              cause: error,
            });
      this.tarballFailures.set(commitSha, typed);
      throw typed;
    });
    this.tarballCache.set(commitSha, promise);
    return promise;
  }

  private async downloadTarball(
    commitSha: SourceCommitSha,
  ): Promise<Map<string, Uint8Array>> {
    const url = this.tarballUrl(commitSha);
    const makeError = (context: SourceHttpErrorContext): SourceReaderError =>
      new TarballReadError(commitSha, context);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: "application/gzip, application/octet-stream",
          "user-agent": USER_AGENT,
        },
      });
    } catch (cause) {
      throw makeError({ url, cause });
    }
    if (!response.ok) {
      throw makeError({
        url,
        status: response.status,
        statusText: response.statusText,
        rateLimit: readRateLimit(response.headers),
        apiMessage: await readApiErrorMessage(response),
      });
    }

    let tarball: Uint8Array;
    try {
      tarball = new Uint8Array(await response.arrayBuffer());
    } catch (cause) {
      throw makeError({
        url,
        status: response.status,
        statusText: response.statusText,
        cause: new Error(
          `no se pudo leer el cuerpo del tarball (${String(cause)})`,
        ),
      });
    }
    if (tarball.byteLength === 0) {
      throw makeError({ url, status: response.status, note: "tarball vacío" });
    }

    try {
      return await extractTarballFiles(tarball);
    } catch (cause) {
      throw makeError({
        url,
        status: response.status,
        cause: new Error(`no se pudo extraer el tarball (${String(cause)})`),
      });
    }
  }

  private async tryReadRawFile(
    commitSha: SourceCommitSha,
    path: string,
  ): Promise<Uint8Array | null> {
    const url = this.rawUrl(commitSha, path);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: "application/octet-stream, text/plain, */*",
          "user-agent": USER_AGENT,
        },
      });
    } catch {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  }
}

/**
 * Construye el reader aplicando los defaults de entorno:
 * `GITHUB_REPO` (formato `owner/name`) y `GITHUB_TOKEN` (solo cabecera de la
 * API, nunca de codeload/raw). Los parámetros explícitos tienen prioridad; un
 * `token: null` explícito desactiva incluso el token del entorno.
 */
export function createGithubSourceReader(
  config: GithubSourceReaderConfig = {},
  env: GithubSourceReaderEnv = process.env,
): GithubSourceReader {
  const repo = config.repo ?? readNonEmptyEnv(env, "GITHUB_REPO") ?? undefined;
  const token =
    config.token !== undefined
      ? config.token
      : (readNonEmptyEnv(env, "GITHUB_TOKEN") ?? null);
  return new GithubSourceReader({ ...config, repo, token });
}
