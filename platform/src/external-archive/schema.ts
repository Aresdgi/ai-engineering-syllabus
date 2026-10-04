/**
 * Esquema Drizzle (PostgreSQL) de la clase EXTERNAL_ARCHIVE del Hito 2.5
 * (`docs/milestones/M2B_AUDIT_PLAN.md` §5.1 + §8).
 *
 * Invariantes que codifica este esquema:
 *
 * - Separación de SOURCE (ADR-020): tablas propias para el material externo
 *   enlazado por el corpus; nada aquí toca ni referencia `source_*`.
 * - Idempotencia (AC-2.5.7): `canonical_url` es único por item y `sha256` es la
 *   PK del asset direccionado por contenido; la relación item↔asset deduplica
 *   una misma imagen entre items e idiomas ((`item_id`, `original_url`)).
 * - Alias de lecciones retiradas (decisión del usuario, §8): `status` admite
 *   `'alias'` y `method` admite `'user-alias'`; `alias_of_canonical_url` es una
 *   FK lógica a `canonical_url` (sin constraint, para no ordenar inserciones ni
 *   bloquear borrados) con check bidireccional: no nula si y solo si
 *   `status = 'alias'`.
 * - Literalidad (AC-2.5.10): `content`/`content_sha256` solo guardan bytes
 *   capturados; `content_format` se restringe a `'markdown'` y admite `NULL`.
 *
 * Seguridad (Supabase): las tres tablas llevan `ENABLE ROW LEVEL SECURITY` sin
 * políticas, de modo que la Data API pública (roles `anon`/`authenticated` con
 * la anon key) no expone ninguna fila. El servidor y el CLI usan la conexión
 * Postgres directa como owner (bypassa RLS mientras no se aplique
 * `FORCE ROW LEVEL SECURITY`).
 */

import { sql, type SQL } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { bytea } from "../source/store/schema";
import {
  EXTERNAL_ARCHIVE_CONTENT_FORMATS,
  EXTERNAL_ARCHIVE_KINDS,
  EXTERNAL_ARCHIVE_LANGUAGES,
  EXTERNAL_ARCHIVE_METHODS,
  EXTERNAL_ARCHIVE_STATUSES,
} from "./types";

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

export const externalArchiveItems = pgTable(
  "external_archive_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalUrl: text("original_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    kind: text("kind").notNull(),
    host: text("host").notNull(),
    language: text("language"),
    title: text("title"),
    content: text("content"),
    contentSha256: text("content_sha256"),
    contentFormat: text("content_format"),
    sourceRepository: text("source_repository"),
    sourceCommit: text("source_commit"),
    sourcePath: text("source_path"),
    capturedAt: timestamp("captured_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    method: text("method").notNull(),
    httpStatus: integer("http_status"),
    waybackUrl: text("wayback_url"),
    waybackCapturedAt: timestamp("wayback_captured_at", {
      withTimezone: true,
      mode: "date",
    }),
    waybackHttpStatus: integer("wayback_http_status"),
    status: text("status").notNull(),
    lastError: text("last_error"),
    aliasOfCanonicalUrl: text("alias_of_canonical_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("external_archive_items_canonical_url_unique").on(t.canonicalUrl),
    check(
      "external_archive_items_kind_allowed",
      sql`${t.kind} in (${sqlStringList(EXTERNAL_ARCHIVE_KINDS)})`,
    ),
    check(
      "external_archive_items_status_allowed",
      sql`${t.status} in (${sqlStringList(EXTERNAL_ARCHIVE_STATUSES)})`,
    ),
    check(
      "external_archive_items_method_allowed",
      sql`${t.method} in (${sqlStringList(EXTERNAL_ARCHIVE_METHODS)})`,
    ),
    check(
      "external_archive_items_language_allowed",
      sql`${t.language} in (${sqlStringList(EXTERNAL_ARCHIVE_LANGUAGES)})`,
    ),
    check(
      "external_archive_items_content_format_allowed",
      sql`${t.contentFormat} in (${sqlStringList(EXTERNAL_ARCHIVE_CONTENT_FORMATS)})`,
    ),
    check(
      "external_archive_items_alias_iff_status",
      sql`(${t.status} = 'alias') = (${t.aliasOfCanonicalUrl} is not null)`,
    ),
    index("external_archive_items_kind_idx").on(t.kind),
    index("external_archive_items_status_idx").on(t.status),
    index("external_archive_items_host_idx").on(t.host),
    index("external_archive_items_language_idx").on(t.language),
  ],
).enableRLS();

/**
 * Bytes de las imágenes descargadas del material archivado. Direccionado por
 * contenido (SHA-256, no el SHA-1 git de `source_blobs`): la misma imagen sirve
 * a varios items/idiomas y nunca se reescribe (`ON CONFLICT DO NOTHING`).
 */
export const externalArchiveAssets = pgTable("external_archive_assets", {
  sha256: text("sha256").primaryKey(),
  bytes: bytea("bytes").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  sourceUrl: text("source_url").notNull(),
  capturedAt: timestamp("captured_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
}).enableRLS();

/** Relación item ↔ imagen, con la URL y el `alt` literales del Markdown. */
export const externalArchiveItemAssets = pgTable(
  "external_archive_item_assets",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => externalArchiveItems.id, { onDelete: "cascade" }),
    assetSha256: text("asset_sha256")
      .notNull()
      .references(() => externalArchiveAssets.sha256, { onDelete: "restrict" }),
    originalUrl: text("original_url").notNull(),
    alt: text("alt"),
  },
  (t) => [
    primaryKey({
      name: "external_archive_item_assets_pk",
      columns: [t.itemId, t.originalUrl],
    }),
  ],
).enableRLS();
