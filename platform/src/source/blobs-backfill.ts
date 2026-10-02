/**
 * Backfill de `source_blobs` (M2, ADR-018): `pnpm --dir platform blobs:backfill`.
 *
 * Los snapshots importados por M1 guardaron los binarios solo como
 * `binary_reference` (URL pinneada a `raw.githubusercontent.com`), sin bytes.
 * Este CLI rellena `source_blobs` para el snapshot activo:
 *
 * - Lista los archivos binarios del snapshot (`binary_reference` no nulo) y
 *   descarta los `blob_sha` que ya tienen fila en `source_blobs` (idempotente).
 * - Obtiene los bytes del commit pinneado con el reader de GitHub (un único
 *   tarball por commit) o, con `--from-dir <ruta>`, de un checkout local.
 * - Verifica `gitBlobSha(bytes) === blob_sha` antes de insertar; un hash
 *   incoherente se reporta como error y no se escribe (nunca se sustituye).
 * - `--dry-run` lee, verifica y resume, pero no escribe en la base.
 *
 * Nunca imprime `DATABASE_URL` ni `GITHUB_TOKEN`: los mensajes pasan por
 * `describeError`/`redactSecrets`.
 *
 * Códigos de salida: 0 correcto (o nada pendiente), 1 con errores de
 * lectura/hash, 2 error de argumentos, configuración o base de datos.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { computeGitBlobSha } from "./fixtures";
import { createGithubSourceReader, normalizeSourcePath } from "./github/reader";
import { describeError, redactSecrets, type RedactEnv } from "../lib/redact";
import { PostgresSourceStore } from "./store/postgres-store";
import {
  type ActiveSourceSnapshot,
  type NewSourceBlob,
  type SourceBinaryFileEntry,
  type SourceBlobSha,
  type SourceSnapshotId,
} from "./types";

export const BLOBS_BACKFILL_USAGE = [
  "Uso: pnpm --dir platform blobs:backfill [opciones]",
  "",
  "Rellena source_blobs (bytes de los binarios) para el snapshot activo.",
  "",
  "Opciones:",
  "  --dry-run            Lee y verifica los bytes, pero no escribe en la base",
  "  --from-dir <ruta>    Lee los binarios de un checkout local (p. ej. --from-dir ..) en vez de GitHub",
  "  --repo <owner/name>  Repo para el reader de GitHub (por defecto GITHUB_REPO o el repo del snapshot)",
  "  -h, --help           Muestra esta ayuda",
].join("\n");

export type BlobBackfillCliOptions = Readonly<{
  dryRun: boolean;
  fromDir: string | null;
  repo: string | null;
  help: boolean;
}>;

export type BlobBackfillCliParseResult =
  | Readonly<{ ok: true; options: BlobBackfillCliOptions }>
  | Readonly<{ ok: false; message: string }>;

const VALUE_FLAGS = new Set(["--from-dir", "--repo"]);

export function parseBlobBackfillArgs(
  argv: readonly string[],
): BlobBackfillCliParseResult {
  const options = {
    dryRun: false,
    fromDir: null as string | null,
    repo: null as string | null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const separator = arg.indexOf("=");
    const name = separator === -1 ? arg : arg.slice(0, separator);
    if (!VALUE_FLAGS.has(name)) {
      return { ok: false, message: `opción desconocida "${arg}"` };
    }

    const value = separator === -1 ? argv[index + 1] : arg.slice(separator + 1);
    if (value === undefined || value === "" || value.startsWith("--")) {
      return { ok: false, message: `falta el valor de ${name}` };
    }
    if (separator === -1) {
      index += 1;
    }

    if (name === "--from-dir") {
      options.fromDir = value;
    } else {
      options.repo = value;
    }
  }

  return { ok: true, options };
}

/** Puerto de datos del backfill; `PostgresSourceStore` lo satisface. */
export interface BlobBackfillStore {
  findActiveSnapshot(): Promise<ActiveSourceSnapshot | null>;
  listBinaryFiles(
    snapshotId: SourceSnapshotId,
  ): Promise<readonly SourceBinaryFileEntry[]>;
  findExistingBlobShas(
    blobShas: readonly SourceBlobSha[],
  ): Promise<ReadonlySet<SourceBlobSha>>;
  upsertBlobs(blobs: readonly NewSourceBlob[]): Promise<void>;
}

export type BlobBackfillFailureKind =
  | "read-failed"
  | "hash-mismatch"
  | "write-failed";

export type BlobBackfillFailure = Readonly<{
  path: string;
  blobSha: string;
  kind: BlobBackfillFailureKind;
  message: string;
}>;

export type BlobBackfillResult = Readonly<{
  dryRun: boolean;
  repository: string | null;
  snapshotId: string | null;
  commitSha: string | null;
  /** Archivos binarios del snapshot (puede incluir blobs repetidos). */
  binaryFiles: number;
  /** `blob_sha` distintos entre esos archivos (dedupe por contenido). */
  uniqueBlobs: number;
  /** Blobs únicos que ya tenían fila en `source_blobs`. */
  alreadyPresent: number;
  /** Blobs únicos pendientes de insertar. */
  pending: number;
  /** Blobs pendientes leídos y verificados (candidatos a insertar). */
  verified: number;
  /** Blobs insertados realmente (siempre 0 con `--dry-run`). */
  inserted: number;
  failures: readonly BlobBackfillFailure[];
}>;

export type BlobBackfillOptions = Readonly<{
  store: BlobBackfillStore;
  /**
   * Obtiene los bytes de un binario del snapshot activo. `snapshot` permite
   * construir un reader de GitHub perezoso con el commit correcto.
   */
  fetchBytes: (
    file: SourceBinaryFileEntry,
    snapshot: ActiveSourceSnapshot,
  ) => Promise<Uint8Array>;
  dryRun?: boolean;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyResult(dryRun: boolean): BlobBackfillResult {
  return {
    dryRun,
    repository: null,
    snapshotId: null,
    commitSha: null,
    binaryFiles: 0,
    uniqueBlobs: 0,
    alreadyPresent: 0,
    pending: 0,
    verified: 0,
    inserted: 0,
    failures: [],
  };
}

/**
 * Núcleo del backfill, sin I/O propio: consulta el store, obtiene bytes con
 * `fetchBytes`, verifica el SHA-1 git y (salvo `dryRun`) inserta. Un fallo de
 * escritura se propaga (la llamada del store es atómica); los fallos de
 * lectura/hash se registran por archivo y no abortan el resto.
 */
export async function backfillSourceBlobs(
  options: BlobBackfillOptions,
): Promise<BlobBackfillResult> {
  const dryRun = options.dryRun ?? false;
  const snapshot = await options.store.findActiveSnapshot();
  if (!snapshot) {
    return emptyResult(dryRun);
  }

  const files = await options.store.listBinaryFiles(snapshot.snapshotId);
  const uniqueBySha = new Map<SourceBlobSha, SourceBinaryFileEntry>();
  for (const file of files) {
    if (!uniqueBySha.has(file.blobSha)) {
      uniqueBySha.set(file.blobSha, file);
    }
  }

  const existing = await options.store.findExistingBlobShas([
    ...uniqueBySha.keys(),
  ]);
  const pendingFiles = [...uniqueBySha.values()].filter(
    (file) => !existing.has(file.blobSha),
  );

  const failures: BlobBackfillFailure[] = [];
  const ready: NewSourceBlob[] = [];

  for (const file of pendingFiles) {
    let bytes: Uint8Array;
    try {
      bytes = await options.fetchBytes(file, snapshot);
    } catch (error) {
      failures.push({
        path: file.path,
        blobSha: file.blobSha,
        kind: "read-failed",
        message: errorMessage(error),
      });
      continue;
    }

    const computed = computeGitBlobSha(bytes);
    if (computed !== file.blobSha) {
      failures.push({
        path: file.path,
        blobSha: file.blobSha,
        kind: "hash-mismatch",
        message: `el contenido no coincide con el blob del snapshot (esperado ${file.blobSha}, calculado ${computed}); no se inserta`,
      });
      continue;
    }

    ready.push({
      blobSha: file.blobSha,
      bytes,
      byteSize: bytes.byteLength,
    });
  }

  let inserted = 0;
  if (!dryRun && ready.length > 0) {
    await options.store.upsertBlobs(ready);
    inserted = ready.length;
  }

  return {
    dryRun,
    repository: `${snapshot.owner}/${snapshot.name}`,
    snapshotId: snapshot.snapshotId,
    commitSha: snapshot.commitSha,
    binaryFiles: files.length,
    uniqueBlobs: uniqueBySha.size,
    alreadyPresent: existing.size,
    pending: pendingFiles.length,
    verified: ready.length,
    inserted,
    failures,
  };
}

/**
 * Fuente de bytes desde un checkout local: `root` + path posix del snapshot.
 * Rechaza paths que no sean relativos válidos o que escapen de `root`.
 */
export function createDirectoryBytesFetcher(
  root: string,
): (file: SourceBinaryFileEntry) => Promise<Uint8Array> {
  const absoluteRoot = path.resolve(root);
  return async (file) => {
    const normalized = normalizeSourcePath(file.path);
    if (normalized === null) {
      throw new Error(
        `"${file.path}" no es un path posix relativo válido del snapshot`,
      );
    }
    const absolutePath = path.resolve(absoluteRoot, ...normalized.split("/"));
    if (
      absolutePath !== absoluteRoot &&
      !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)
    ) {
      throw new Error(`"${file.path}" sale del directorio ${absoluteRoot}`);
    }
    return new Uint8Array(await readFile(absolutePath));
  };
}

export function buildBlobBackfillHumanSummary(
  result: BlobBackfillResult,
): string {
  const label = result.dryRun ? "blobs:backfill (dry-run)" : "blobs:backfill";
  const lines: string[] = [];
  if (result.snapshotId === null) {
    lines.push(
      `${label}: no hay snapshot activo (complete/complete_with_errors); no se escribe nada`,
    );
    return lines.join("\n");
  }
  lines.push(
    `${label}: repo=${result.repository} snapshot=${result.snapshotId} commit=${result.commitSha}`,
  );
  lines.push(
    `${label}: binarios=${result.binaryFiles} blobsUnicos=${result.uniqueBlobs} yaPresentes=${result.alreadyPresent} pendientes=${result.pending} verificados=${result.verified} insertados=${result.inserted} errores=${result.failures.length}`,
  );
  result.failures.forEach((failure, index) => {
    lines.push(
      `${label}: error[${index + 1}] tipo=${failure.kind} path=${failure.path} mensaje=${failure.message}`,
    );
  });
  return lines.join("\n");
}

export function exitCodeForBackfill(result: BlobBackfillResult): number {
  return result.failures.length > 0 ? 1 : 0;
}

function readNonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export type BlobsBackfillCliEnv = RedactEnv;

export async function runBlobsBackfillCli(
  argv: readonly string[],
  env: BlobsBackfillCliEnv = process.env,
): Promise<number> {
  const parsed = parseBlobBackfillArgs(argv);
  if (!parsed.ok) {
    console.error(`blobs:backfill: ${parsed.message}`);
    console.error(BLOBS_BACKFILL_USAGE);
    return 2;
  }
  const options = parsed.options;
  if (options.help) {
    console.log(BLOBS_BACKFILL_USAGE);
    return 0;
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl === "") {
    console.error(
      "blobs:backfill: falta DATABASE_URL. Copia platform/.env.example a platform/.env.local y define la URI del Session pooler de Supabase.",
    );
    return 2;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const store = new PostgresSourceStore(drizzleNodePostgres(pool));
    const directoryFetcher =
      options.fromDir !== null
        ? createDirectoryBytesFetcher(options.fromDir)
        : null;
    // Un único reader por ejecución: memoriza el tarball del commit y evita
    // una descarga por archivo (y un rate limit innecesario).
    let githubReader: ReturnType<typeof createGithubSourceReader> | null = null;

    const result = await backfillSourceBlobs({
      store,
      dryRun: options.dryRun,
      fetchBytes: async (file, snapshot) => {
        if (directoryFetcher !== null) {
          return directoryFetcher(file);
        }
        if (githubReader === null) {
          const repo =
            options.repo ??
            readNonEmpty(env.GITHUB_REPO) ??
            `${snapshot.owner}/${snapshot.name}`;
          githubReader = createGithubSourceReader({ repo }, env);
        }
        return githubReader.readFile(snapshot.commitSha, file.path);
      },
    });

    const output = buildBlobBackfillHumanSummary(result);
    // Defensa en profundidad: los mensajes pueden contener credenciales si el
    // reader/DB las incluyen en un error; nunca se imprimen en crudo.
    console.log(redactSecrets(output, env));
    return exitCodeForBackfill(result);
  } catch (error) {
    console.error(`blobs:backfill: ${describeError(error, env)}`);
    return 2;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

const entryPoint = process.argv[1];
const isDirectRun =
  entryPoint !== undefined &&
  path.resolve(entryPoint) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runBlobsBackfillCli(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(`blobs:backfill: ${describeError(error, process.env)}`);
      process.exitCode = 2;
    });
}
