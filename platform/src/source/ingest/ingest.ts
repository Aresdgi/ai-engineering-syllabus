/**
 * Orquestador de la ingesta fiel (M1-W4).
 *
 * `ingestSnapshot` implementa AC-1.1..AC-1.13 sobre los puertos inyectables
 * `SourceReader` y `SourceStore`:
 *
 * 1. Resuelve repositorio, default branch/ref y commit SHA (AC-1.1..AC-1.3).
 * 2. Si ya existe un snapshot `complete`/`complete_with_errors` para ese
 *    commit, es un no-op que devuelve el existente (AC-1.11).
 * 3. Si no, crea/reutiliza el snapshot en `importing`, lee el árbol completo
 *    (AC-1.4) y falla de forma explícita si llegó truncado.
 * 4. Filtra los tres roots (`content/projects`, `content/contexts`,
 *    `content/lessons`) e importa cada blob (AC-1.5..AC-1.7): guarda
 *    path + blob_sha verificado contra el árbol (AC-1.8), `raw_content` UTF-8
 *    íntegro o `binary_reference` pinneada por commit (AC-1.9), e idioma solo
 *    por evidencia de path (AC-1.10, ADR-012). Los bytes de los binarios se
 *    guardan en `source_blobs` (ADR-018, direccionados por contenido) antes
 *    que las filas de `source_files`.
 * 5. Construye los índices mínimos con `classify/` (título y orden en `null`).
 * 6. Registra cada fallo por archivo en `source_import_errors` sin abortar y
 *    sin crear contenido sustituto (AC-1.13); termina `complete`,
 *    `complete_with_errors` o `failed`.
 *
 * Un fallo de resolución de repo/commit (antes de crear el snapshot) se lanza
 * como `SourceIngestError`/error del reader: no hay fila de snapshot a la que
 * asociar el error. Un fallo global posterior a la creación (árbol truncado o
 * ilegible, escritura en el store) se registra y el snapshot termina `failed`.
 */

import { SourceReaderError } from "../github/errors";
import {
  buildSourceContexts,
  buildSourceLessons,
  buildSourceProjects,
} from "../classify/indexes";
import { classifySourceMedia } from "../classify/media";
import {
  classifySourcePath,
  comparePaths,
  resolveSourceLanguage,
} from "../classify/paths";
import { collectBlobPaths } from "../classify/tree";
import { validateSourceFileContent } from "../validate/files";
import { validateBlobContent, validateSourceTree } from "../validate/snapshot";
import type { SourceValidationContext } from "../validate/paths";
import {
  type NewSourceBlob,
  type NewSourceFile,
  type NewSourceImportError,
  type SourceBlobSha,
  type SourceCommitSha,
  type SourceFileContent,
  type SourceImportErrorKind,
  type SourcePath,
  type SourceReader,
  type SourceRepositoryDescriptor,
  type SourceSnapshot,
  type SourceSnapshotStatus,
  type SourceStore,
  type SourceTimestamp,
  type SourceTree,
  type SourceTreeBlobEntry,
} from "../types";
import { SourceIngestError } from "./errors";

const RAW_GITHUB_HOST_PATTERN = /^https:\/\/github\.com\//;

const RAW_GITHUB_HOST = "https://raw.githubusercontent.com/";

export type IngestSnapshotOptions = Readonly<{
  reader: SourceReader;
  store: SourceStore;
  /** Repo esperado (`owner/name`); debe coincidir con el del reader. */
  repo?: string;
  /** Ref a resolver; por defecto la default branch del repositorio. */
  ref?: string;
  /** Commit exacto a importar; tiene prioridad sobre `ref`. */
  commit?: string;
  /** Reloj inyectable (duración determinista en tests). */
  now?: () => Date;
}>;

export type IngestRootCounts = Readonly<{
  projects: number;
  contexts: number;
  lessons: number;
}>;

export type IngestFileCounts = Readonly<{
  total: number;
  text: number;
  binary: number;
  byRoot: IngestRootCounts;
}>;

export type IngestIndexCounts = Readonly<{
  projects: number;
  contexts: number;
  lessons: number;
}>;

export type IngestSnapshotCounts = Readonly<{
  files: IngestFileCounts;
  indexes: IngestIndexCounts;
  errors: number;
}>;

export type IngestSnapshotResult = Readonly<{
  repository: SourceRepositoryDescriptor;
  ref: string;
  commitSha: SourceCommitSha;
  snapshot: SourceSnapshot;
  status: SourceSnapshotStatus;
  noop: boolean;
  counts: IngestSnapshotCounts | null;
  errors: readonly NewSourceImportError[];
  startedAt: SourceTimestamp;
  finishedAt: SourceTimestamp;
  durationMs: number;
}>;

type MutableRootCounts = {
  projects: number;
  contexts: number;
  lessons: number;
};

type MutableFileCounts = {
  total: number;
  text: number;
  binary: number;
  byRoot: MutableRootCounts;
};

type BuildResultInput = Readonly<{
  repository: SourceRepositoryDescriptor;
  ref: string;
  commitSha: SourceCommitSha;
  snapshot: SourceSnapshot;
  status: SourceSnapshotStatus;
  noop: boolean;
  counts: IngestSnapshotCounts | null;
  errors: readonly NewSourceImportError[];
  startedAt: Date;
  clock: () => Date;
}>;

type FailSnapshotInput = Readonly<{
  store: SourceStore;
  repository: SourceRepositoryDescriptor;
  ref: string;
  commitSha: SourceCommitSha;
  snapshot: SourceSnapshot;
  error: NewSourceImportError;
  startedAt: Date;
  clock: () => Date;
}>;

type CollectTreeFilesInput = Readonly<{
  reader: SourceReader;
  tree: SourceTree;
  commitSha: SourceCommitSha;
  repository: SourceRepositoryDescriptor;
  context: SourceValidationContext;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyRootCounts(): MutableRootCounts {
  return { projects: 0, contexts: 0, lessons: 0 };
}

function emptyFileCounts(): MutableFileCounts {
  return { total: 0, text: 0, binary: 0, byRoot: emptyRootCounts() };
}

function emptyIndexCounts(): IngestIndexCounts {
  return { projects: 0, contexts: 0, lessons: 0 };
}

function buildResult(input: BuildResultInput): IngestSnapshotResult {
  const finishedAt = input.clock();
  return {
    repository: input.repository,
    ref: input.ref,
    commitSha: input.commitSha,
    snapshot: input.snapshot,
    status: input.status,
    noop: input.noop,
    counts: input.counts,
    errors: input.errors,
    startedAt: input.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - input.startedAt.getTime()),
  };
}

function normalizeRef(ref: string | undefined, defaultBranch: string): string {
  const trimmed = ref?.trim();
  return trimmed !== undefined && trimmed !== "" ? trimmed : defaultBranch;
}

function assertExpectedRepository(
  repo: string | undefined,
  repository: SourceRepositoryDescriptor,
): void {
  if (repo === undefined) {
    return;
  }
  const segments = repo.trim().split("/");
  if (segments.length !== 2 || segments[0] === "" || segments[1] === "") {
    throw new SourceIngestError({
      kind: "repository-resolution-failed",
      message: `"${repo}" no es un repo válido: usa el formato "owner/name"`,
    });
  }
  const servedLabel = `${repository.owner}/${repository.name}`;
  if (segments[0] !== repository.owner || segments[1] !== repository.name) {
    throw new SourceIngestError({
      kind: "repository-resolution-failed",
      message: `el reader sirvió "${servedLabel}" pero la ingesta pidió "${repo.trim()}"`,
    });
  }
}

/**
 * `binary_reference` pinneada por commit. Se sirve desde
 * `raw.githubusercontent.com` derivado del `canonical_url`, sin hardcodear
 * owner/name ni guardar base64 en el store.
 */
function buildBinaryReference(
  repository: SourceRepositoryDescriptor,
  commitSha: SourceCommitSha,
  sourcePath: SourcePath,
): string {
  const encodedPath = sourcePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const base = repository.canonicalUrl
    .replace(RAW_GITHUB_HOST_PATTERN, RAW_GITHUB_HOST)
    .replace(/\/+$/, "");
  return `${base}/${commitSha}/${encodedPath}`;
}

function toImportError(
  error: unknown,
  context: SourceValidationContext,
  sourcePath: SourcePath | null,
  fallbackKind: SourceImportErrorKind,
): NewSourceImportError {
  if (error instanceof SourceReaderError) {
    return {
      snapshotId: context.snapshotId,
      sourcePath,
      errorKind: error.kind,
      message: error.message,
      detail: error.detail,
    };
  }
  return {
    snapshotId: context.snapshotId,
    sourcePath,
    errorKind: fallbackKind,
    message: errorMessage(error),
    detail: null,
  };
}

/**
 * Falla global posterior a la creación del snapshot: registra el error y deja
 * el snapshot en `failed` (mejor esfuerzo: si el store no responde, el error
 * original sigue siendo el resultado).
 */
async function failSnapshot(
  input: FailSnapshotInput,
): Promise<IngestSnapshotResult> {
  await input.store.insertImportErrors([input.error]).catch(() => undefined);
  await input.store
    .setSnapshotStatus(input.snapshot.id, "failed")
    .catch(() => undefined);
  return buildResult({
    repository: input.repository,
    ref: input.ref,
    commitSha: input.commitSha,
    snapshot: { ...input.snapshot, status: "failed" },
    status: "failed",
    noop: false,
    counts: {
      files: emptyFileCounts(),
      indexes: emptyIndexCounts(),
      errors: 1,
    },
    errors: [input.error],
    startedAt: input.startedAt,
    clock: input.clock,
  });
}

async function collectTreeFiles(input: CollectTreeFilesInput): Promise<{
  files: NewSourceFile[];
  blobs: NewSourceBlob[];
  errors: NewSourceImportError[];
  counts: MutableFileCounts;
}> {
  const { reader, tree, commitSha, repository, context } = input;
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const blobPaths = collectBlobPaths(tree);

  const blobEntries = tree.entries
    .filter((entry): entry is SourceTreeBlobEntry => entry.type === "blob")
    .filter((entry) => classifySourcePath(entry.path) !== "auxiliary")
    .sort((a, b) => comparePaths(a.path, b.path));

  const files: NewSourceFile[] = [];
  const blobsBySha = new Map<SourceBlobSha, NewSourceBlob>();
  const errors: NewSourceImportError[] = [];
  const counts = emptyFileCounts();

  for (const entry of blobEntries) {
    let bytes: Uint8Array;
    try {
      bytes = await reader.readFile(commitSha, entry.path);
    } catch (error) {
      errors.push(
        toImportError(error, context, entry.path, "file-read-failed"),
      );
      continue;
    }

    const hashError = validateBlobContent(
      { path: entry.path, blobSha: entry.blobSha },
      bytes,
      context,
    );
    if (hashError) {
      errors.push(hashError);
      continue;
    }

    const media = classifySourceMedia(entry.path, bytes);
    const language = resolveSourceLanguage(entry.path, blobPaths);

    let content: SourceFileContent;
    if (media.isBinary) {
      content = {
        rawContent: null,
        binaryReference: buildBinaryReference(
          repository,
          commitSha,
          entry.path,
        ),
      };
    } else {
      let rawContent: string;
      try {
        rawContent = decoder.decode(bytes);
      } catch (error) {
        errors.push({
          snapshotId: context.snapshotId,
          sourcePath: entry.path,
          errorKind: "file-decode-failed",
          message: `"${entry.path}" está clasificado como texto pero no es UTF-8 válido: ${errorMessage(error)}; se registra el error y no se sustituye el contenido`,
          detail: null,
        });
        continue;
      }
      content = { rawContent, binaryReference: null };
    }

    const file: NewSourceFile = {
      snapshotId: context.snapshotId,
      path: entry.path,
      blobSha: entry.blobSha,
      mediaType: media.mediaType,
      ...language,
      ...content,
    };
    const invariantError = validateSourceFileContent(file, context);
    if (invariantError) {
      errors.push(invariantError);
      continue;
    }

    files.push(file);
    counts.total += 1;
    if (media.isBinary) {
      counts.binary += 1;
      // El hash ya se verificó contra el árbol (`validateBlobContent`): los
      // bytes son fieles o el archivo no llega hasta aquí. Direccionado por
      // contenido: un mismo blob compartido por varios paths se guarda una vez.
      if (!blobsBySha.has(entry.blobSha)) {
        blobsBySha.set(entry.blobSha, {
          blobSha: entry.blobSha,
          bytes,
          byteSize: bytes.byteLength,
        });
      }
    } else {
      counts.text += 1;
    }
    const bucket = classifySourcePath(entry.path);
    if (bucket !== "auxiliary") {
      counts.byRoot[bucket] += 1;
    }
  }

  for (const entry of tree.entries) {
    if (entry.type !== "commit") {
      continue;
    }
    if (classifySourcePath(entry.path) === "auxiliary") {
      continue;
    }
    errors.push({
      snapshotId: context.snapshotId,
      sourcePath: entry.path,
      errorKind: "file-read-failed",
      message: `"${entry.path}" es un submódulo y no puede importarse como blob fiel; se registra el error y no se sustituye`,
      detail: { objectSha: entry.objectSha, mode: entry.mode },
    });
  }

  return { files, blobs: [...blobsBySha.values()], errors, counts };
}

export async function ingestSnapshot(
  options: IngestSnapshotOptions,
): Promise<IngestSnapshotResult> {
  const clock = options.now ?? (() => new Date());
  const startedAt = clock();

  const repository = await options.reader.getRepository();
  assertExpectedRepository(options.repo, repository);

  const repositoryId = await options.store.upsertRepository(repository);
  const ref = normalizeRef(options.ref, repository.defaultBranch);
  const requestedCommit = options.commit?.trim();
  const resolved = await options.reader.resolveCommit(
    requestedCommit !== undefined && requestedCommit !== ""
      ? requestedCommit
      : ref,
  );
  const commitSha = resolved.sha;

  const existing = await options.store.findSnapshotByCommit(
    repositoryId,
    commitSha,
  );
  if (
    existing &&
    (existing.status === "complete" ||
      existing.status === "complete_with_errors")
  ) {
    return buildResult({
      repository,
      ref,
      commitSha,
      snapshot: existing,
      status: existing.status,
      noop: true,
      counts: null,
      errors: [],
      startedAt,
      clock,
    });
  }

  const snapshot =
    existing ??
    (await options.store.createSnapshot({ repositoryId, ref, commitSha }));
  if (snapshot.status !== "importing") {
    await options.store.setSnapshotStatus(snapshot.id, "importing");
  }
  const context: SourceValidationContext = { snapshotId: snapshot.id };
  const base = {
    store: options.store,
    repository,
    ref,
    commitSha,
    snapshot,
    startedAt,
    clock,
  } as const;

  let tree: SourceTree;
  try {
    tree = await options.reader.getTree(commitSha);
  } catch (error) {
    return failSnapshot({
      ...base,
      error: toImportError(error, context, null, "tree-read-failed"),
    });
  }

  const treeError = validateSourceTree(tree, context);
  if (treeError) {
    return failSnapshot({ ...base, error: treeError });
  }

  const { files, blobs, errors, counts } = await collectTreeFiles({
    reader: options.reader,
    tree,
    commitSha,
    repository,
    context,
  });

  let indexes = emptyIndexCounts();
  try {
    // Primero los bytes (direccionados por contenido, idempotentes): así
    // ninguna fila de `source_files` con `binary_reference` existe sin su blob
    // en `source_blobs` si la escritura de archivos falla. Un blob escrito de
    // más es inocuo: no tiene FK al snapshot, se comparte entre snapshots y
    // `ON CONFLICT (blob_sha) DO NOTHING` lo mantiene idempotente.
    await options.store.upsertBlobs(blobs);
    await options.store.upsertFiles(files);
    const projects = buildSourceProjects(tree, snapshot.id);
    const contexts = buildSourceContexts(tree, snapshot.id);
    const lessons = buildSourceLessons(tree, snapshot.id);
    await options.store.upsertProjects(projects);
    await options.store.upsertContexts(contexts);
    await options.store.upsertLessons(lessons);
    indexes = {
      projects: projects.length,
      contexts: contexts.length,
      lessons: lessons.length,
    };
  } catch (error) {
    errors.push(toImportError(error, context, null, "storage-write-failed"));
    await options.store.insertImportErrors(errors).catch(() => undefined);
    await options.store
      .setSnapshotStatus(snapshot.id, "failed")
      .catch(() => undefined);
    return buildResult({
      ...base,
      snapshot: { ...snapshot, status: "failed" },
      status: "failed",
      noop: false,
      counts: {
        files: counts,
        indexes,
        errors: errors.length,
      },
      errors,
    });
  }

  if (errors.length > 0) {
    await options.store.insertImportErrors(errors);
  }
  const status: SourceSnapshotStatus =
    errors.length > 0 ? "complete_with_errors" : "complete";
  await options.store.setSnapshotStatus(snapshot.id, status);

  return buildResult({
    ...base,
    snapshot: { ...snapshot, status },
    status,
    noop: false,
    counts: {
      files: counts,
      indexes,
      errors: errors.length,
    },
    errors,
  });
}
