/**
 * Esquema Drizzle (PostgreSQL) del store SOURCE del Hito 1.
 *
 * Invariantes que codifica este esquema:
 *
 * - Trazabilidad e inmutabilidad: `source_snapshots` es único por
 *   `(repository_id, commit_sha)` (AC-1.11) y todas las FK usan
 *   `ON DELETE RESTRICT`, de modo que un snapshot con contenido o errores
 *   nunca se borra en cascada (ARCHITECTURE.md, "Inmutabilidad").
 * - Fidelidad de archivos: `source_files` guarda `path` posix, `blob_sha` y
 *   exactamente uno de `raw_content` (texto) o `binary_reference` (binario).
 * - Idioma sin inferencia (AC-1.10): `language`/`language_evidence` solo
 *   admiten las combinaciones declaradas en `source/types.ts` (`"es"` +
 *   `"suffix"`, `"en"` + `"pair-convention"`) o `NULL` + `NULL`.
 * - Errores sin sustitutos (AC-1.13): `source_import_errors` registra los
 *   fallos; jamás se rellena contenido educativo ausente.
 * - Autonomía de assets (M2, ADR-018): `source_blobs` guarda los bytes de los
 *   binarios direccionados por el SHA-1 git del blob (`blob_sha`), de modo que
 *   la app puede servirlos sin depender de `raw.githubusercontent.com`. Es una
 *   tabla direccionada por contenido: la misma fila sirve a varios snapshots y
 *   no tiene FK a `source_snapshots`; la procedencia textual sigue en
 *   `source_files` (`path`, `blob_sha`, `binary_reference`).
 *
 * Seguridad (Supabase): todas las tablas llevan `ENABLE ROW LEVEL SECURITY`
 * sin políticas, de modo que la Data API pública (roles `anon`/`authenticated`
 * con la anon key) no expone ninguna fila. El servidor y los scripts de
 * ingesta usan la conexión Postgres directa como owner, y el owner de una
 * tabla bypassa RLS mientras no se aplique `FORCE ROW LEVEL SECURITY`.
 */

import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type CheckBuilder,
} from "drizzle-orm/pg-core";

import {
  SOURCE_IMPORT_ERROR_KINDS,
  SOURCE_SNAPSHOT_STATUSES,
  type SourceJsonValue,
  type SourceLanguageAssignment,
  type SourceMetadata,
} from "../types";

/**
 * Combinaciones válidas de idioma/evidencia. Refleja la unión
 * `SourceLanguageAssignment` de `source/types.ts`; el `CHECK` se genera a
 * partir de esta lista para no duplicar literales.
 */
const SOURCE_LANGUAGE_ASSIGNMENTS = [
  { language: "es", languageEvidence: "suffix" },
  { language: "en", languageEvidence: "suffix" },
  { language: "en", languageEvidence: "pair-convention" },
] as const satisfies readonly SourceLanguageAssignment[];

/**
 * Literal SQL inmutable para listas de `CHECK`: drizzle-kit no debe convertir
 * estos valores en parámetros (`$1`), porque el DDL no admite placeholders.
 * Los valores provienen de constantes del contrato, nunca de entrada externa.
 */
function sqlStringLiteral(value: string): SQL {
  return sql.raw(`'${value.replaceAll("'", "''")}'`);
}

function sqlStringList(values: readonly string[]): SQL {
  return sql.join(
    values.map((value) => sqlStringLiteral(value)),
    sql`, `,
  );
}

/**
 * Columna `bytea` con contrato `Uint8Array` (el driver `pg` devuelve `Buffer`,
 * que es un `Uint8Array`; PGlite devuelve `Uint8Array`). Drizzle no trae un
 * tipo `bytea` nativo, así que se declara con `customType` (contrato de M2).
 */
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    throw new Error(
      "bytea: el driver devolvió un valor que no es Uint8Array/Buffer",
    );
  },
});

function languageEvidenceCheck(
  name: string,
  language: SQLWrapper,
  languageEvidence: SQLWrapper,
): CheckBuilder {
  const assignments = sql.join(
    SOURCE_LANGUAGE_ASSIGNMENTS.map(
      ({ language: value, languageEvidence: evidence }) =>
        sql`(${language} = ${sqlStringLiteral(value)} and ${languageEvidence} = ${sqlStringLiteral(evidence)})`,
    ),
    sql` or `,
  );
  return check(
    name,
    sql`(${language} is null and ${languageEvidence} is null) or (${language} is not null and ${languageEvidence} is not null and (${assignments}))`,
  );
}

export const sourceRepositories = pgTable(
  "source_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    defaultBranch: text("default_branch").notNull(),
  },
  (t) => [unique("source_repositories_owner_name_unique").on(t.owner, t.name)],
).enableRLS();

export const sourceSnapshots = pgTable(
  "source_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => sourceRepositories.id, { onDelete: "restrict" }),
    ref: text("ref").notNull(),
    commitSha: text("commit_sha").notNull(),
    importedAt: timestamp("imported_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("importing"),
  },
  (t) => [
    unique("source_snapshots_repository_commit_unique").on(
      t.repositoryId,
      t.commitSha,
    ),
    check(
      "source_snapshots_status_allowed",
      sql`${t.status} in (${sqlStringList(SOURCE_SNAPSHOT_STATUSES)})`,
    ),
  ],
).enableRLS();

export const sourceFiles = pgTable(
  "source_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "restrict" }),
    path: text("path").notNull(),
    blobSha: text("blob_sha").notNull(),
    mediaType: text("media_type").notNull(),
    language: text("language"),
    languageEvidence: text("language_evidence"),
    rawContent: text("raw_content"),
    binaryReference: text("binary_reference"),
  },
  (t) => [
    unique("source_files_snapshot_path_unique").on(t.snapshotId, t.path),
    check(
      "source_files_content_exactly_one",
      sql`(${t.rawContent} is null) <> (${t.binaryReference} is null)`,
    ),
    languageEvidenceCheck(
      "source_files_language_evidence_allowed",
      t.language,
      t.languageEvidence,
    ),
  ],
).enableRLS();

/**
 * Bytes de los binarios, direccionados por contenido (ADR-018): la clave es el
 * SHA-1 git del blob, de modo que un mismo binario importado en varios
 * snapshots comparte una sola fila. La ingesta y el backfill verifican
 * `gitBlobSha(bytes) === blob_sha` antes de escribir; el store nunca sustituye
 * bytes de una fila existente (`ON CONFLICT DO NOTHING`).
 */
export const sourceBlobs = pgTable("source_blobs", {
  blobSha: text("blob_sha").primaryKey(),
  bytes: bytea("bytes").notNull(),
  byteSize: integer("byte_size").notNull(),
}).enableRLS();

export const sourceProjects = pgTable(
  "source_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "restrict" }),
    sourcePath: text("source_path").notNull(),
    canonicalOrder: integer("canonical_order"),
    title: text("title"),
    preferredReadmePath: text("preferred_readme_path"),
    language: text("language"),
    languageEvidence: text("language_evidence"),
    metadata: jsonb("metadata")
      .$type<SourceMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    unique("source_projects_snapshot_source_path_unique").on(
      t.snapshotId,
      t.sourcePath,
    ),
    languageEvidenceCheck(
      "source_projects_language_evidence_allowed",
      t.language,
      t.languageEvidence,
    ),
  ],
).enableRLS();

export const sourceContexts = pgTable(
  "source_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "restrict" }),
    sourcePath: text("source_path").notNull(),
    title: text("title"),
    preferredReadmePath: text("preferred_readme_path"),
    language: text("language"),
    languageEvidence: text("language_evidence"),
    metadata: jsonb("metadata")
      .$type<SourceMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    unique("source_contexts_snapshot_source_path_unique").on(
      t.snapshotId,
      t.sourcePath,
    ),
    languageEvidenceCheck(
      "source_contexts_language_evidence_allowed",
      t.language,
      t.languageEvidence,
    ),
  ],
).enableRLS();

export const sourceLessons = pgTable(
  "source_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "restrict" }),
    sourcePath: text("source_path").notNull(),
    title: text("title"),
    preferredReadmePath: text("preferred_readme_path"),
    language: text("language"),
    languageEvidence: text("language_evidence"),
    metadata: jsonb("metadata")
      .$type<SourceMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    unique("source_lessons_snapshot_source_path_unique").on(
      t.snapshotId,
      t.sourcePath,
    ),
    languageEvidenceCheck(
      "source_lessons_language_evidence_allowed",
      t.language,
      t.languageEvidence,
    ),
  ],
).enableRLS();

export const sourceImportErrors = pgTable(
  "source_import_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "restrict" }),
    sourcePath: text("source_path"),
    errorKind: text("error_kind").notNull(),
    message: text("message").notNull(),
    detail: jsonb("detail").$type<SourceJsonValue>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "source_import_errors_kind_allowed",
      sql`${t.errorKind} in (${sqlStringList(SOURCE_IMPORT_ERROR_KINDS)})`,
    ),
    index("source_import_errors_snapshot_id_idx").on(t.snapshotId),
  ],
).enableRLS();
