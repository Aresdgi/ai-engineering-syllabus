import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

export const SOURCE_FIXTURES_RELATIVE_DIR = path.posix.join(
  "fixtures",
  "source",
);

export const SOURCE_FIXTURES_MANIFEST_NAME = "manifest.json";

export const SOURCE_FIXTURES_REPOSITORY =
  "4GeeksAcademy/ai-engineering-syllabus";

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;

const BLOB_SHA_PATTERN = /^[0-9a-f]{40}$/;

const WINDOWS_ABSOLUTE_PATTERN = /^[a-zA-Z]:/;

export type SourceFixtureEntry = Readonly<{
  commit: string;
  path: string;
  blob_sha: string;
}>;

export type SourceFixtureManifest = Readonly<{
  repository: string;
  fixtures: readonly SourceFixtureEntry[];
}>;

export type SourceFixtureViolationKind =
  | "fixture-unlisted"
  | "fixture-modified"
  | "fixture-missing"
  | "manifest-invalid";

export type SourceFixtureViolation = {
  kind: SourceFixtureViolationKind;
  file: string;
  message: string;
};

export type SourceFixtureVerification = {
  verifiedFiles: string[];
  violations: SourceFixtureViolation[];
};

/**
 * Git blob SHA-1: sha1("blob <bytes>\0" + contenido). Coincide con
 * `git hash-object <archivo>`.
 */
export function computeGitBlobSha(content: Uint8Array): string {
  const header = Buffer.from(`blob ${content.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(content).digest("hex");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isRegularFile(target: string): boolean {
  try {
    return lstatSync(target).isFile();
  } catch {
    return false;
  }
}

function listAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function invalidFixturePathReason(value: string): string | null {
  if (value.trim() === "") {
    return "está vacío";
  }
  if (value.includes("\\")) {
    return "usa separadores de Windows; usa una ruta posix relativa";
  }
  if (path.posix.isAbsolute(value) || WINDOWS_ABSOLUTE_PATTERN.test(value)) {
    return "es una ruta absoluta; debe ser relativa a la raíz del repo fuente";
  }
  const segments = value.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return "contiene segmentos vacíos, '.' o '..'";
  }
  return null;
}

function parseFixtureEntry(
  value: unknown,
  prefix: string,
): { entry: SourceFixtureEntry | null; messages: string[] } {
  if (!isRecord(value)) {
    return { entry: null, messages: [`${prefix} debe ser un objeto`] };
  }

  const commit = value.commit;
  const fixturePath = value.path;
  const blobSha = value.blob_sha;
  const messages: string[] = [];

  if (typeof commit !== "string" || !COMMIT_PATTERN.test(commit)) {
    messages.push(
      `${prefix}.commit debe ser un SHA hexadecimal de 7 a 40 caracteres`,
    );
  }
  if (typeof fixturePath !== "string") {
    messages.push(`${prefix}.path debe ser un string`);
  } else {
    const reason = invalidFixturePathReason(fixturePath);
    if (reason) {
      messages.push(`${prefix}.path ${reason}`);
    }
  }
  if (typeof blobSha !== "string" || !BLOB_SHA_PATTERN.test(blobSha)) {
    messages.push(
      `${prefix}.blob_sha debe ser un SHA-1 hexadecimal de 40 caracteres`,
    );
  }

  if (
    messages.length > 0 ||
    typeof commit !== "string" ||
    typeof fixturePath !== "string" ||
    typeof blobSha !== "string"
  ) {
    return { entry: null, messages };
  }
  return {
    entry: { commit, path: fixturePath, blob_sha: blobSha },
    messages,
  };
}

export type SourceFixtureManifestParseResult =
  | { ok: true; manifest: SourceFixtureManifest }
  | { ok: false; messages: string[] };

export function parseSourceFixtureManifest(
  raw: string,
): SourceFixtureManifestParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      messages: [`no es JSON válido (${describeError(error)})`],
    };
  }

  if (!isRecord(parsed)) {
    return { ok: false, messages: ["la raíz debe ser un objeto JSON"] };
  }

  const messages: string[] = [];

  const repository = parsed.repository;
  if (typeof repository !== "string" || repository.trim() === "") {
    messages.push('falta "repository" (string no vacío)');
  } else if (repository !== SOURCE_FIXTURES_REPOSITORY) {
    messages.push(
      `"repository" debe ser "${SOURCE_FIXTURES_REPOSITORY}" (recibido "${repository}")`,
    );
  }

  const rawFixtures = parsed.fixtures;
  if (!Array.isArray(rawFixtures)) {
    messages.push('falta "fixtures" (array)');
    return { ok: false, messages };
  }

  const fixtures: SourceFixtureEntry[] = [];
  const seenLocations = new Set<string>();

  rawFixtures.forEach((value, index) => {
    const prefix = `fixtures[${index}]`;
    const { entry, messages: entryMessages } = parseFixtureEntry(value, prefix);
    if (!entry) {
      messages.push(...entryMessages);
      return;
    }
    const location = `${entry.commit}/${entry.path}`;
    if (seenLocations.has(location)) {
      messages.push(`${prefix} duplica la ubicación ${location}`);
      return;
    }
    seenLocations.add(location);
    fixtures.push(entry);
  });

  if (messages.length > 0 || typeof repository !== "string") {
    return { ok: false, messages };
  }
  return { ok: true, manifest: { repository, fixtures } };
}

/**
 * Verifica el directorio de fixtures fuente contra su manifiesto.
 *
 * - Directorio inexistente: no se verifica ni se excluye nada (no es un
 *   error).
 * - Directorio con archivos y sin manifiesto: cada archivo es una violación
 *   `fixture-unlisted`; un directorio vacío no produce violaciones.
 * - Un archivo no declarado, un contenido que no coincide con `blob_sha` o
 *   una entrada sin archivo son violaciones.
 * - Solo los archivos que pasan la verificación se devuelven en
 *   `verifiedFiles` para excluirlos del escaneo de nombres.
 */
export function verifySourceFixtures(
  fixturesRoot: string,
): SourceFixtureVerification {
  const verifiedFiles: string[] = [];
  const violations: SourceFixtureViolation[] = [];

  if (!existsSync(fixturesRoot) || !isDirectory(fixturesRoot)) {
    return { verifiedFiles, violations };
  }

  const manifestPath = path.join(fixturesRoot, SOURCE_FIXTURES_MANIFEST_NAME);
  const fixtureFiles = listAllFiles(fixturesRoot).filter(
    (file) => file !== manifestPath,
  );

  const unlisted = (file: string): SourceFixtureViolation => ({
    kind: "fixture-unlisted",
    file,
    message: `no figura en ${SOURCE_FIXTURES_RELATIVE_DIR}/${SOURCE_FIXTURES_MANIFEST_NAME}; declara el fixture con su commit, path original y blob_sha (git hash-object) antes de excluirlo del guard`,
  });

  let manifest: SourceFixtureManifest;
  if (!existsSync(manifestPath)) {
    for (const file of fixtureFiles) {
      violations.push(unlisted(file));
    }
    return { verifiedFiles, violations };
  }

  try {
    const parsed = parseSourceFixtureManifest(
      readFileSync(manifestPath, "utf8"),
    );
    if (!parsed.ok) {
      violations.push({
        kind: "manifest-invalid",
        file: manifestPath,
        message: `el manifiesto es inválido: ${parsed.messages.join("; ")}`,
      });
      for (const file of fixtureFiles) {
        violations.push(unlisted(file));
      }
      return { verifiedFiles, violations };
    }
    manifest = parsed.manifest;
  } catch (error) {
    violations.push({
      kind: "manifest-invalid",
      file: manifestPath,
      message: `no se pudo leer el manifiesto (${describeError(error)})`,
    });
    for (const file of fixtureFiles) {
      violations.push(unlisted(file));
    }
    return { verifiedFiles, violations };
  }

  const entriesByLocation = new Map<string, SourceFixtureEntry>();
  for (const entry of manifest.fixtures) {
    entriesByLocation.set(`${entry.commit}/${entry.path}`, entry);
  }

  for (const file of fixtureFiles) {
    const location = path
      .relative(fixturesRoot, file)
      .split(path.sep)
      .join("/");
    const entry = entriesByLocation.get(location);
    if (!entry) {
      violations.push(unlisted(file));
      continue;
    }
    const actualBlobSha = computeGitBlobSha(readFileSync(file));
    if (actualBlobSha !== entry.blob_sha) {
      violations.push({
        kind: "fixture-modified",
        file,
        message: `el contenido no coincide con blob_sha del manifiesto (esperado ${entry.blob_sha}, calculado ${actualBlobSha}); el fixture fue alterado y no se excluye del escaneo`,
      });
      continue;
    }
    verifiedFiles.push(file);
  }

  for (const entry of manifest.fixtures) {
    const expectedFile = path.join(
      fixturesRoot,
      entry.commit,
      ...entry.path.split("/"),
    );
    if (!isRegularFile(expectedFile)) {
      violations.push({
        kind: "fixture-missing",
        file: expectedFile,
        message: `el manifiesto declara ${entry.commit}/${entry.path} pero el archivo no existe (o no es un archivo regular); copia el fixture verbatim conservando el path original`,
      });
    }
  }

  return { verifiedFiles, violations };
}
