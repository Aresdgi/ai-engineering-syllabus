/**
 * Contratos de dominio SOURCE del Hito 1 (ingestión fiel).
 *
 * Solo tipos, constantes y uniones cerradas: sin I/O, sin red y sin lógica de
 * clasificación (eso vive en `source/classify` y `source/github`). Este archivo
 * es el contrato compartido y congelado entre los workers de M1; consúltese
 * `docs/milestones/M1_AUDIT_PLAN.md` §6-§7.
 *
 * Invariantes de M1:
 * - `title` es siempre `null` (derivarlo del cuerpo es Hito 2); en
 *   `SourceProject`, `canonicalOrder` es siempre `null` (el orden canónico
 *   desde `content/projects/README.md` es Hito 2) y no existe en
 *   contextos/lecciones (`DATA_MODEL.md` solo lo define para proyectos).
 * - `language` solo se asigna con evidencia de nombre de archivo; jamás se
 *   infiere del contenido ni se traduce.
 * - Un `SourceFile` contiene `rawContent` o `binaryReference`, nunca ambos.
 * - Un fallo se registra (`SourceImportError`), nunca se sustituye contenido.
 */

// --- Constantes del repositorio fuente -------------------------------------

export const SOURCE_REPOSITORY_OWNER = "4GeeksAcademy";

export const SOURCE_REPOSITORY_NAME = "ai-engineering-syllabus";

/** Repo por defecto en formato `owner/name`. */
export const SOURCE_DEFAULT_REPOSITORY =
  `${SOURCE_REPOSITORY_OWNER}/${SOURCE_REPOSITORY_NAME}` as const;

/** Raíces de contenido educativo que importa M1 (paths posix relativos). */
export const SOURCE_CONTENT_ROOTS = [
  "content/projects",
  "content/contexts",
  "content/lessons",
] as const;

export type SourceContentRoot = (typeof SOURCE_CONTENT_ROOTS)[number];

// --- Primitivos de dominio --------------------------------------------------

/** Path posix relativo a la raíz del repo fuente (sin `./` ni `..`). */
export type SourcePath = string;

/** SHA-1 git del blob; 40 hex en minúsculas. */
export type SourceBlobSha = string;

/** SHA-1 git del commit; 40 hex en minúsculas. */
export type SourceCommitSha = string;

/** Fecha ISO-8601 (p. ej. `2026-10-02T12:00:00.000Z`). */
export type SourceTimestamp = string;

/**
 * MIME type canónico. La forma `tipo/subtipo` obliga a los clasificadores a
 * usar un valor MIME y a caer a `application/octet-stream` cuando no
 * reconozcan la extensión (decisión de W1b, no de este archivo).
 */
export type SourceMediaType = `${string}/${string}`;

export type SourceJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly SourceJsonValue[]
  | { readonly [key: string]: SourceJsonValue };

/** Metadata jsonb de los índices; nunca cuerpos educativos reescritos. */
export type SourceMetadata = Readonly<{ [key: string]: SourceJsonValue }>;

export type SourceRepositoryId = string;
export type SourceSnapshotId = string;
export type SourceFileId = string;
export type SourceProjectId = string;
export type SourceContextId = string;
export type SourceLessonId = string;
export type SourceImportErrorId = string;

// --- Idioma (AC-1.10) -------------------------------------------------------

/**
 * Idioma declarado por evidencia de path (decisión firme del usuario):
 * - `"es"` + `"suffix"`: el archivo termina en `.es.md`.
 * - `"en"` + `"suffix"`: el archivo termina en `.en.md`.
 * - `"en"` + `"pair-convention"`: es `X.md` y existe `X.es.md` en el mismo
 *   directorio (convención del repo: `.cursor/rules/readme-translations.mdc`).
 * - `null` + `null`: cualquier otro caso (nunca se infiere del contenido).
 */
export type SourceLanguageAssignment =
  | Readonly<{ language: "es"; languageEvidence: "suffix" }>
  | Readonly<{ language: "en"; languageEvidence: "suffix" }>
  | Readonly<{ language: "en"; languageEvidence: "pair-convention" }>
  | Readonly<{ language: null; languageEvidence: null }>;

export type SourceLanguage = SourceLanguageAssignment["language"];

export type SourceLanguageEvidence =
  SourceLanguageAssignment["languageEvidence"];

// --- Repositorio y snapshots ------------------------------------------------

export type SourceRepository = Readonly<{
  id: SourceRepositoryId;
  owner: string;
  name: string;
  canonicalUrl: string;
  defaultBranch: string;
}>;

/** Datos de repositorio antes de persistir (el store asigna el `id`). */
export type SourceRepositoryDescriptor = Readonly<Omit<SourceRepository, "id">>;

export const SOURCE_SNAPSHOT_STATUSES = [
  "importing",
  "complete",
  "complete_with_errors",
  "failed",
] as const;

export type SourceSnapshotStatus = (typeof SOURCE_SNAPSHOT_STATUSES)[number];

export type SourceSnapshot = Readonly<{
  id: SourceSnapshotId;
  repositoryId: SourceRepositoryId;
  ref: string;
  commitSha: SourceCommitSha;
  importedAt: SourceTimestamp;
  status: SourceSnapshotStatus;
}>;

/**
 * Snapshot a crear. `findSnapshotByCommit` + `UNIQUE(repositoryId, commitSha)`
 * garantizan AC-1.11: reimportar el mismo commit es un no-op; un commit nuevo
 * crea otro snapshot sin tocar el anterior.
 */
export type NewSourceSnapshot = Readonly<{
  repositoryId: SourceRepositoryId;
  ref: string;
  commitSha: SourceCommitSha;
}>;

// --- Archivos SOURCE --------------------------------------------------------

/** Texto: `rawContent` íntegro (UTF-8, sin normalizar) y sin referencia. */
export type SourceTextContent = Readonly<{
  rawContent: string;
  binaryReference: null;
}>;

/** Binario: solo referencia pinneada (commit + path), sin base64 en el store. */
export type SourceBinaryContent = Readonly<{
  rawContent: null;
  binaryReference: string;
}>;

export type SourceFileContent = SourceTextContent | SourceBinaryContent;

export type SourceFileFields = Readonly<{
  snapshotId: SourceSnapshotId;
  path: SourcePath;
  blobSha: SourceBlobSha;
  mediaType: SourceMediaType;
}> &
  SourceLanguageAssignment;

export type SourceFile = Readonly<{ id: SourceFileId }> &
  SourceFileFields &
  SourceFileContent;

export type NewSourceFile = SourceFileFields & SourceFileContent;

// --- Índices mínimos (sin título ni orden en M1) ----------------------------

/**
 * Campos comunes de los índices. `preferredReadmePath` es el documento
 * preferido de la unidad: para proyectos `README.es.md`/`README.md`; para
 * contextos `README.es.md`/`README.md` y, si no hay, el primer
 * `CONTEXT-*.es.md`/`.en.md`/`.md` del directorio; para lecciones
 * `<slug>.es.md`/`<slug>.md`/`<slug>.en.md`. `null` si la unidad no tiene
 * documento reconocible (se registra como metadata/error, nunca se inventa).
 *
 * `canonicalOrder` solo existe en `SourceProject` (`DATA_MODEL.md` solo lo
 * define para proyectos) y en M1 es siempre `null`.
 */
export type SourceIndexFields = Readonly<{
  snapshotId: SourceSnapshotId;
  sourcePath: SourcePath;
  title: null;
  preferredReadmePath: SourcePath | null;
  metadata: SourceMetadata;
}> &
  SourceLanguageAssignment;

export type SourceProject = Readonly<{
  id: SourceProjectId;
  canonicalOrder: null;
}> &
  SourceIndexFields;
export type NewSourceProject = Readonly<{ canonicalOrder: null }> &
  SourceIndexFields;

export type SourceContext = Readonly<{ id: SourceContextId }> &
  SourceIndexFields;
export type NewSourceContext = SourceIndexFields;

export type SourceLesson = Readonly<{ id: SourceLessonId }> & SourceIndexFields;
export type NewSourceLesson = SourceIndexFields;

// --- Errores de importación (AC-1.13) ---------------------------------------

export const SOURCE_IMPORT_ERROR_KINDS = [
  "repository-resolution-failed",
  "commit-resolution-failed",
  "tree-truncated",
  "tree-read-failed",
  "file-read-failed",
  "file-hash-mismatch",
  "file-decode-failed",
  "storage-write-failed",
  "unexpected-error",
] as const;

export type SourceImportErrorKind = (typeof SOURCE_IMPORT_ERROR_KINDS)[number];

export type SourceImportError = Readonly<{
  id: SourceImportErrorId;
  snapshotId: SourceSnapshotId;
  sourcePath: SourcePath | null;
  errorKind: SourceImportErrorKind;
  message: string;
  detail: SourceJsonValue | null;
  createdAt: SourceTimestamp;
}>;

/** Error a registrar (el store asigna `id` y `createdAt`). */
export type NewSourceImportError = Readonly<
  Omit<SourceImportError, "id" | "createdAt">
>;

// --- Inventario del árbol ---------------------------------------------------

export type SourceTreeBlobEntry = Readonly<{
  type: "blob";
  path: SourcePath;
  blobSha: SourceBlobSha;
  size: number;
  mode: "100644" | "100755" | "120000";
}>;

export type SourceTreeReferenceEntry = Readonly<{
  type: "tree" | "commit";
  path: SourcePath;
  objectSha: string;
  mode: "040000" | "160000";
}>;

export type SourceTreeEntry = SourceTreeBlobEntry | SourceTreeReferenceEntry;

export type SourceTree = Readonly<{
  commitSha: SourceCommitSha;
  truncated: boolean;
  entries: readonly SourceTreeEntry[];
}>;

export type ResolvedSourceCommit = Readonly<{
  sha: SourceCommitSha;
  committedAt: SourceTimestamp | null;
}>;

// --- Puertos inyectables ----------------------------------------------------

/**
 * Lector del repositorio fuente. Se configura con owner/name (o el repo por
 * defecto) y permite inyectar una implementación de fixtures en tests.
 * `getTree` debe exponer el flag `truncated`; la ingesta falla de forma
 * explícita si es `true`.
 */
export interface SourceReader {
  getRepository(): Promise<SourceRepositoryDescriptor>;
  resolveCommit(ref: string): Promise<ResolvedSourceCommit>;
  getTree(commitSha: SourceCommitSha): Promise<SourceTree>;
  readFile(commitSha: SourceCommitSha, path: SourcePath): Promise<Uint8Array>;
}

/**
 * Persistencia de snapshots SOURCE. Debe respetar:
 * - `UNIQUE(repositoryId, commitSha)` en snapshots y `UNIQUE(snapshotId, path)`
 *   en archivos (AC-1.11);
 * - inmutabilidad: nunca actualizar filas de otro snapshot;
 * - exactamente uno de `rawContent`/`binaryReference` por archivo.
 */
export interface SourceStore {
  upsertRepository(
    repository: SourceRepositoryDescriptor,
  ): Promise<SourceRepositoryId>;
  findSnapshotByCommit(
    repositoryId: SourceRepositoryId,
    commitSha: SourceCommitSha,
  ): Promise<SourceSnapshot | null>;
  createSnapshot(snapshot: NewSourceSnapshot): Promise<SourceSnapshot>;
  upsertFiles(files: readonly NewSourceFile[]): Promise<void>;
  upsertProjects(projects: readonly NewSourceProject[]): Promise<void>;
  upsertContexts(contexts: readonly NewSourceContext[]): Promise<void>;
  upsertLessons(lessons: readonly NewSourceLesson[]): Promise<void>;
  insertImportErrors(errors: readonly NewSourceImportError[]): Promise<void>;
  setSnapshotStatus(
    snapshotId: SourceSnapshotId,
    status: SourceSnapshotStatus,
  ): Promise<void>;
}
