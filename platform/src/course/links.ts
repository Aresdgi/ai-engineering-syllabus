/**
 * Política de enlaces del Hito 2 (ADR-015 + ADR-018), implementada como
 * función pura más un constructor de contexto que arma la capa de lectura.
 *
 * Orden de decisión de `resolveMarkdownHref`:
 * 1. `#ancla` → externo con el mismo href.
 * 2. URL absoluta del PROPIO repo (github.com `blob`/`tree` y
 *    raw.githubusercontent.com, owner/name comparados sin distinguir
 *    mayúsculas contra el snapshot) cuyo path existe en el snapshot → misma
 *    política que un enlace relativo (paso 5); si el path no existe, se deja
 *    intacta como externa (apunta a otra ref, no es un enlace roto). La ref
 *    puede ser de un segmento (`main`) o `refs/heads/<rama>`/`refs/tags/<tag>`.
 * 3. `http(s)://` / `mailto:` → externo. Antes de devolver `external`, una URL
 *    `http(s)` se canonicaliza (`canonicalizeUrl`, contrato W1) y se consulta el
 *    índice opcional `context.externalArchive` (Hito 2.5, AC-2.5.4/5/6):
 *    lección `captured`/`alias` → `external-archive` (copia propia); herramienta
 *    con respaldo Wayback → `external` + `backup`; marketing o URL sin archivo
 *    → `external` intacto.
 * 4. Cualquier otro esquema (`javascript:`, `data:`, …) → roto.
 * 5. Path relativo (o `/ruta` tratado como path del repo) que existe y tiene
 *    vista interna → ruta interna (con cambio de idioma global si el destino
 *    es la variante de otro idioma del documento de origen).
 * 6. Existe como archivo (texto o binario) sin vista → `/source-files/<path>`
 *    servido por la propia app (`targetKind: "raw"`, ADR-018).
 * 7. Existe como directorio con vista → ruta interna; sin vista → tree@commit
 *    en el espejo configurado (`SOURCE_MIRROR_REPOSITORY`), o en el repo del
 *    snapshot si no hay espejo.
 * 8. No existe → roto (nunca se inventa destino).
 */

import { languagePreferenceHref } from "@/lib/i18n";

import { canonicalizeUrl } from "../external-archive/urls";
import type { MarkdownUrl, MarkdownUrlResolver } from "../lib/markdown/types";
import {
  decodeHrefPath,
  resolveRepoPath,
  splitQueryAndHash,
} from "./path-utils";
import { sourceFileHref } from "./routes";
import type {
  CourseLanguage,
  CourseSnapshot,
  ExternalArchiveLink,
} from "./types";

const EXTERNAL_SCHEME_PATTERN = /^(https?:|mailto:)/i;

const ANY_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

const SAME_REPO_GITHUB_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|tree)\/(?:refs\/(?:heads|tags)\/)?[^/]+\/(.+)$/i;

const SAME_REPO_RAW_PATTERN =
  /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/(?:heads|tags)\/)?[^/]+\/(.+)$/i;

const GITHUB_REPOSITORY_URL_PATTERN =
  /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i;

const GITHUB_REPOSITORY_SLUG_PATTERN = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/;

export type ResolverFile = {
  kind: "text" | "binary";
  language: CourseLanguage | null;
  binaryReference: string | null;
};

export type MarkdownResolutionContext = {
  /** Path del documento que contiene el enlace. */
  fromPath: string;
  /** Idioma ADR-012 del documento de origen; `null` si no se conoce. */
  sourceLanguage?: CourseLanguage | null;
  files: ReadonlyMap<string, ResolverFile>;
  directories: ReadonlySet<string>;
  /** Path de archivo → ruta interna (documento con vista). */
  fileHrefs: ReadonlyMap<string, string>;
  /** Path de directorio → ruta interna (unidad con vista). */
  directoryHrefs: ReadonlyMap<string, string>;
  snapshot: Pick<CourseSnapshot, "canonicalUrl" | "commitSha">;
  /**
   * Base del espejo (p. ej. `https://github.com/usuario/fork`). `undefined`
   * usa `SOURCE_MIRROR_REPOSITORY` del entorno; `null` fuerza el repo del
   * snapshot (útil en tests).
   */
  repositoryUrl?: string | null;
  /**
   * Índice opcional de material archivado por URL canónica (Hito 2.5). Sin él,
   * el comportamiento de los enlaces externos es el del Hito 2 (intacto).
   */
  externalArchive?: ReadonlyMap<string, ExternalArchiveLink>;
};

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function repositoryBaseUrl(canonicalUrl: string): string {
  return canonicalUrl.replace(/\/+$/, "");
}

/**
 * Normaliza `SOURCE_MIRROR_REPOSITORY` a una URL base de GitHub: acepta
 * `owner/name` (formato de `.env.local`) y la URL del repo (con o sin `.git`).
 * Devuelve `null` para valores ausentes o no reconocibles.
 */
export function normalizeRepositoryUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const urlMatch = GITHUB_REPOSITORY_URL_PATTERN.exec(trimmed);
  if (urlMatch) {
    return `https://github.com/${urlMatch[1]}/${urlMatch[2]}`;
  }
  const slugMatch = GITHUB_REPOSITORY_SLUG_PATTERN.exec(trimmed);
  if (slugMatch) {
    return `https://github.com/${slugMatch[1]}/${slugMatch[2]}`;
  }
  return null;
}

/** Espejo configurado en el entorno, o `null` si no hay uno válido. */
export function mirrorRepositoryUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return normalizeRepositoryUrl(env.SOURCE_MIRROR_REPOSITORY);
}

function repositoryBase(
  snapshot: Pick<CourseSnapshot, "canonicalUrl">,
  repositoryUrl?: string | null,
): string {
  const explicitBase =
    repositoryUrl === undefined ? mirrorRepositoryUrl() : repositoryUrl;
  return explicitBase ?? repositoryBaseUrl(snapshot.canonicalUrl);
}

/** URL de blob pinneada al commit exacto, en el espejo si está configurado. */
export function githubBlobUrl(
  snapshot: Pick<CourseSnapshot, "canonicalUrl" | "commitSha">,
  path: string,
  repositoryUrl?: string | null,
): string {
  return `${repositoryBase(snapshot, repositoryUrl)}/blob/${snapshot.commitSha}/${encodePathSegments(path)}`;
}

/** URL de tree pinneada al commit exacto, en el espejo si está configurado. */
export function githubTreeUrl(
  snapshot: Pick<CourseSnapshot, "canonicalUrl" | "commitSha">,
  path: string,
  repositoryUrl?: string | null,
): string {
  return `${repositoryBase(snapshot, repositoryUrl)}/tree/${snapshot.commitSha}/${encodePathSegments(path)}`;
}

/** Commit corto (7 hex) para la cabecera de procedencia. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function broken(rawHref: string): MarkdownUrl {
  return { kind: "broken", href: null, rawHref };
}

/**
 * Traduce un item del índice de archivo a la resolución de enlace congelada
 * (Hito 2.5, §6.3 + §8):
 * - lección `captured` o alias → `external-archive` (abre `/archive/…`);
 * - herramienta con respaldo Wayback completo → `external` + `backup`;
 * - cualquier otro caso → `external` intacto (marketing incluido).
 */
export function externalArchiveMarkdownUrl(
  rawHref: string,
  link: ExternalArchiveLink,
): MarkdownUrl {
  if (
    link.kind === "lesson" &&
    (link.status === "captured" || link.status === "alias") &&
    link.href !== null
  ) {
    return {
      kind: "external-archive",
      href: link.href,
      originalHref: rawHref,
      archiveId: link.id,
    };
  }
  if (
    link.kind === "tool" &&
    link.waybackUrl !== null &&
    link.waybackCapturedAt !== null
  ) {
    return {
      kind: "external",
      href: rawHref,
      backup: { href: link.waybackUrl, capturedAt: link.waybackCapturedAt },
    };
  }
  return { kind: "external", href: rawHref };
}

/**
 * Resolución de un enlace con esquema externo (`http(s)://`/`mailto:`):
 * consulta el índice de archivo solo para `http(s)` con índice presente y,
 * si no hay item, devuelve el enlace intacto.
 */
function resolveExternalHref(
  rawHref: string,
  context: MarkdownResolutionContext,
): MarkdownUrl {
  if (context.externalArchive !== undefined && /^https?:/i.test(rawHref)) {
    const canonical = canonicalizeUrl(rawHref);
    if (canonical !== null) {
      const link = context.externalArchive.get(canonical);
      if (link !== undefined) {
        return externalArchiveMarkdownUrl(rawHref, link);
      }
    }
  }
  return { kind: "external", href: rawHref };
}

type SameRepoLocation = {
  targetPath: string;
  hash: string;
};

function repositorySlug(
  canonicalUrl: string,
): { owner: string; name: string } | null {
  const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i.exec(
    repositoryBaseUrl(canonicalUrl),
  );
  const owner = match?.[1];
  const name = match?.[2];
  if (owner === undefined || name === undefined) {
    return null;
  }
  return { owner: owner.toLowerCase(), name: name.toLowerCase() };
}

/**
 * Path de snapshot al que apunta una URL absoluta del propio repo, o `null`
 * si la URL no es del repo del snapshot. Ignora `?query`, conserva `#hash` y
 * decodifica `%xx`; la ref de la URL no importa: manda el path.
 */
function sameRepoLocation(
  rawHref: string,
  snapshot: Pick<CourseSnapshot, "canonicalUrl">,
): SameRepoLocation | null {
  const { path: pathPart, hash } = splitQueryAndHash(rawHref);
  const match =
    SAME_REPO_GITHUB_PATTERN.exec(pathPart) ??
    SAME_REPO_RAW_PATTERN.exec(pathPart);
  if (!match) {
    return null;
  }
  const slug = repositorySlug(snapshot.canonicalUrl);
  if (slug === null) {
    return null;
  }
  const owner = (match[1] ?? "").toLowerCase();
  const name = (match[2] ?? "").toLowerCase();
  if (owner !== slug.owner || name !== slug.name) {
    return null;
  }
  const decoded = decodeHrefPath(match[3] ?? "");
  if (decoded === "") {
    return null;
  }
  const targetPath = resolveRepoPath("", `/${decoded}`);
  if (targetPath === null) {
    return null;
  }
  return { targetPath, hash };
}

/**
 * Ruta interna a un documento con vista. Si la variante de destino está en un
 * idioma distinto al del documento de origen (ADR-012), pasa por
 * `/preferences/language/<lang>?next=…` para cambiar el idioma global antes
 * de navegar (p. ej. "These instructions are available in English").
 */
function internalUrl(
  targetPath: string,
  href: string,
  hash: string,
  context: MarkdownResolutionContext,
): MarkdownUrl {
  const targetLanguage = context.files.get(targetPath)?.language ?? null;
  const sourceLanguage = context.sourceLanguage ?? null;
  if (
    targetLanguage !== null &&
    sourceLanguage !== null &&
    targetLanguage !== sourceLanguage
  ) {
    return {
      kind: "internal",
      href: languagePreferenceHref(targetLanguage, `${href}${hash}`),
      targetPath,
    };
  }
  return { kind: "internal", href: `${href}${hash}`, targetPath };
}

/**
 * Resolución de un path que existe en el snapshot: vista interna, archivo
 * servido por la app (`/source-files/`) o tree@commit en el espejo. `null` si
 * el path no existe.
 */
function resolveExistingTarget(
  targetPath: string,
  hash: string,
  rawHref: string,
  context: MarkdownResolutionContext,
): MarkdownUrl | null {
  const internalHref = context.fileHrefs.get(targetPath);
  if (internalHref !== undefined) {
    return internalUrl(targetPath, internalHref, hash, context);
  }

  if (context.files.has(targetPath)) {
    return {
      kind: "source",
      href: sourceFileHref(targetPath),
      targetPath,
      targetKind: "raw",
    };
  }

  if (context.directories.has(targetPath)) {
    const directoryHref = context.directoryHrefs.get(targetPath);
    if (directoryHref !== undefined) {
      return {
        kind: "internal",
        href: directoryHref,
        targetPath,
      };
    }
    return {
      kind: "source",
      href: githubTreeUrl(context.snapshot, targetPath, context.repositoryUrl),
      targetPath,
      targetKind: "tree",
    };
  }

  return null;
}

export function resolveMarkdownHref(
  rawHref: string,
  context: MarkdownResolutionContext,
): MarkdownUrl {
  if (rawHref.startsWith("#")) {
    return { kind: "external", href: rawHref };
  }
  if (ANY_SCHEME_PATTERN.test(rawHref)) {
    const sameRepo = sameRepoLocation(rawHref, context.snapshot);
    if (sameRepo !== null) {
      const resolution = resolveExistingTarget(
        sameRepo.targetPath,
        sameRepo.hash,
        rawHref,
        context,
      );
      if (resolution !== null) {
        return resolution;
      }
    }
    if (EXTERNAL_SCHEME_PATTERN.test(rawHref)) {
      return resolveExternalHref(rawHref, context);
    }
    return broken(rawHref);
  }

  const { path: pathPart, hash } = splitQueryAndHash(rawHref);
  const decoded = decodeHrefPath(pathPart);
  if (decoded === "") {
    return broken(rawHref);
  }
  const targetPath = resolveRepoPath(context.fromPath, decoded);
  if (targetPath === null) {
    return broken(rawHref);
  }

  return (
    resolveExistingTarget(targetPath, hash, rawHref, context) ?? broken(rawHref)
  );
}

/** Resolvedor funcional a partir de un contexto ya construido (puro). */
export function createMarkdownResolver(
  context: MarkdownResolutionContext,
): MarkdownUrlResolver {
  return (rawHref) => resolveMarkdownHref(rawHref, context);
}
