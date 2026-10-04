/**
 * Contratos de la clase `EXTERNAL_ARCHIVE` (Hito 2.5, ADR-020 propuesto en
 * `docs/milestones/M2B_AUDIT_PLAN.md` §5.5 y ajustes de la §8).
 *
 * Solo tipos, constantes y uniones cerradas: sin I/O, sin red y sin lógica de
 * inventario (eso vive en el CLI de W1). Este archivo es el contrato compartido
 * entre el esquema Drizzle (`schema.ts`), el store (`store.ts`) y los
 * consumidores de W1/W2/W3.
 *
 * Invariantes del modelo (plan §5.1 + §8):
 * - `canonical_url` es la PK natural de idempotencia del item; `sha256` la del
 *   asset (direccionado por contenido).
 * - `status = 'alias'` es el único caso con `aliasOfCanonicalUrl` no nulo
 *   (decisión explícita del usuario para las lecciones retiradas): la fila no
 *   tiene copia propia y apunta a la lección equivalente archivada.
 * - El material archivado es literal: `content`/`contentSha256` solo se
 *   rellenan con bytes capturados de la fuente, nunca generados.
 */

// --- Constantes de la clase EXTERNAL_ARCHIVE --------------------------------

export const EXTERNAL_ARCHIVE_KINDS = ["lesson", "tool"] as const;

export type ExternalArchiveKind = (typeof EXTERNAL_ARCHIVE_KINDS)[number];

export const EXTERNAL_ARCHIVE_STATUSES = [
  "captured",
  "unavailable",
  "error",
  "alias",
] as const;

export type ExternalArchiveStatus = (typeof EXTERNAL_ARCHIVE_STATUSES)[number];

export const EXTERNAL_ARCHIVE_METHODS = [
  "registry-api+github-raw",
  "wayback-metadata",
  "manual",
  "user-alias",
] as const;

export type ExternalArchiveMethod = (typeof EXTERNAL_ARCHIVE_METHODS)[number];

/** Idiomas declarados por la URL/captura; nunca se traduce contenido. */
export const EXTERNAL_ARCHIVE_LANGUAGES = ["es", "en"] as const;

export type ExternalArchiveLanguage =
  (typeof EXTERNAL_ARCHIVE_LANGUAGES)[number];

export const EXTERNAL_ARCHIVE_CONTENT_FORMATS = ["markdown"] as const;

export type ExternalArchiveContentFormat =
  (typeof EXTERNAL_ARCHIVE_CONTENT_FORMATS)[number];

// --- Primitivos -------------------------------------------------------------

export type ExternalArchiveItemId = string;

/** SHA-256 en hex del contenido o de los bytes de un asset. */
export type ExternalArchiveSha256 = string;

/** Fecha ISO-8601 (p. ej. `2026-10-02T12:00:00.000Z`). */
export type ExternalArchiveTimestamp = string;

// --- Items ------------------------------------------------------------------

export type ExternalArchiveItem = Readonly<{
  id: ExternalArchiveItemId;
  /** URL tal cual aparece en el corpus (sin normalizar). */
  originalUrl: string;
  /** URL normalizada (host en minúsculas, sin barra final); clave única. */
  canonicalUrl: string;
  kind: ExternalArchiveKind;
  host: string;
  language: ExternalArchiveLanguage | null;
  /** Título literal de la fuente (frontmatter/H1/API); nunca generado. */
  title: string | null;
  /** Markdown literal (solo lecciones capturadas); nunca resumido/traducido. */
  content: string | null;
  contentSha256: ExternalArchiveSha256 | null;
  contentFormat: ExternalArchiveContentFormat | null;
  /** Procedencia: p. ej. `breatheco-de/knowledge-base`. */
  sourceRepository: string | null;
  sourceCommit: string | null;
  sourcePath: string | null;
  capturedAt: ExternalArchiveTimestamp;
  method: ExternalArchiveMethod;
  httpStatus: number | null;
  waybackUrl: string | null;
  waybackCapturedAt: ExternalArchiveTimestamp | null;
  waybackHttpStatus: number | null;
  status: ExternalArchiveStatus;
  /** Error de captura redactado; nunca contiene secretos. */
  lastError: string | null;
  /** FK lógica a `canonical_url` de la lección destino (solo `status='alias'`). */
  aliasOfCanonicalUrl: string | null;
  createdAt: ExternalArchiveTimestamp;
  updatedAt: ExternalArchiveTimestamp;
}>;

/**
 * Item antes de persistir (el store asigna `id`, `createdAt` y `updatedAt`).
 * Los campos opcionales se normalizan a `NULL` al escribir.
 */
export type NewExternalArchiveItem = Readonly<{
  originalUrl: string;
  canonicalUrl: string;
  kind: ExternalArchiveKind;
  host: string;
  capturedAt: ExternalArchiveTimestamp;
  method: ExternalArchiveMethod;
  status: ExternalArchiveStatus;
  language?: ExternalArchiveLanguage | null;
  title?: string | null;
  content?: string | null;
  contentSha256?: ExternalArchiveSha256 | null;
  contentFormat?: ExternalArchiveContentFormat | null;
  sourceRepository?: string | null;
  sourceCommit?: string | null;
  sourcePath?: string | null;
  httpStatus?: number | null;
  waybackUrl?: string | null;
  waybackCapturedAt?: ExternalArchiveTimestamp | null;
  waybackHttpStatus?: number | null;
  lastError?: string | null;
  aliasOfCanonicalUrl?: string | null;
}>;

/**
 * Resultado de un upsert idempotente:
 * - `"inserted"`: no existía la clave natural y se creó.
 * - `"updated"`: existía y cambió alguno de los campos de cambio
 *   (`content_sha256`, `status`, `alias_of_canonical_url` o metadatos Wayback).
 * - `"unchanged"`: existía y no se escribió nada (ni `captured_at` ni
 *   `updated_at`).
 */
export type ExternalArchiveUpsertResult = "inserted" | "updated" | "unchanged";

// --- Assets -----------------------------------------------------------------

/** Bytes de una imagen archivada; direccionado por contenido (`sha256`). */
export type ExternalArchiveAsset = Readonly<{
  sha256: ExternalArchiveSha256;
  bytes: Uint8Array;
  contentType: string;
  byteSize: number;
  /** URL de la que se descargó (la del Markdown literal). */
  sourceUrl: string;
  capturedAt: ExternalArchiveTimestamp;
}>;

export type NewExternalArchiveAsset = Readonly<{
  sha256: ExternalArchiveSha256;
  bytes: Uint8Array;
  contentType: string;
  byteSize: number;
  sourceUrl: string;
  capturedAt: ExternalArchiveTimestamp;
}>;

/** Los assets nunca se reescriben: `"updated"` no existe para ellos. */
export type ExternalArchiveAssetUpsertResult = "inserted" | "unchanged";

// --- Relación item ↔ asset --------------------------------------------------

export type ExternalArchiveItemAsset = Readonly<{
  itemId: ExternalArchiveItemId;
  assetSha256: ExternalArchiveSha256;
  /** URL de la imagen tal cual aparece en el Markdown. */
  originalUrl: string;
  /** Texto `alt` literal; `null` si no lo tiene. */
  alt: string | null;
}>;

export type NewExternalArchiveItemAsset = Readonly<{
  itemId: ExternalArchiveItemId;
  assetSha256: ExternalArchiveSha256;
  originalUrl: string;
  alt?: string | null;
}>;

// --- Puerto inyectable ------------------------------------------------------

/**
 * Persistencia de la clase EXTERNAL_ARCHIVE. Las implementaciones reciben la
 * base ya construida (nunca leen `DATABASE_URL` al importar) para que el CLI
 * y los tests usen el mismo contrato.
 */
export interface ExternalArchiveStore {
  upsertItem(
    item: NewExternalArchiveItem,
  ): Promise<ExternalArchiveUpsertResult>;
  upsertAsset(
    asset: NewExternalArchiveAsset,
  ): Promise<ExternalArchiveAssetUpsertResult>;
  linkItemAsset(
    link: NewExternalArchiveItemAsset,
  ): Promise<ExternalArchiveUpsertResult>;
  listItems(): Promise<readonly ExternalArchiveItem[]>;
  getItemByCanonicalUrl(
    canonicalUrl: string,
  ): Promise<ExternalArchiveItem | null>;
  getAsset(sha256: ExternalArchiveSha256): Promise<ExternalArchiveAsset | null>;
  listItemAssets(
    itemId: ExternalArchiveItemId,
  ): Promise<readonly ExternalArchiveItemAsset[]>;
}
