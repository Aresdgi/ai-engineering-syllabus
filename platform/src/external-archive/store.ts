/**
 * Implementación PostgreSQL de `ExternalArchiveStore` (contrato en
 * `external-archive/types.ts`).
 *
 * Funciona sobre una instancia Drizzle genérica de dialecto pg, de modo que
 * sirve tanto para `drizzle-orm/node-postgres` (producción/Supabase) como para
 * `drizzle-orm/pglite` (tests sin nube). No abre conexiones ni lee
 * `DATABASE_URL`: recibe la base ya construida, igual que
 * `source/store/postgres-store.ts`.
 *
 * Reglas del Hito 2.5 (plan §5.1/§5.2 y §8):
 * - Idempotencia (AC-2.5.7): `upsertItem` es un no-op cuando
 *   `content_sha256`, `status`, `alias_of_canonical_url` y los metadatos
 *   Wayback no cambian; en ese caso no toca `captured_at` ni `updated_at`.
 *   Solo `"inserted" | "updated" | "unchanged"` describen lo ocurrido.
 * - Assets direccionados por contenido: `upsertAsset` no reescribe bytes de un
 *   sha256 existente (`ON CONFLICT DO NOTHING`), como `source_blobs`.
 * - Aislamiento SOURCE: este módulo solo escribe en `external_archive_*`.
 */

import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  externalArchiveAssets,
  externalArchiveItemAssets,
  externalArchiveItems,
} from "./schema";
import type {
  ExternalArchiveAsset,
  ExternalArchiveAssetUpsertResult,
  ExternalArchiveItem,
  ExternalArchiveItemAsset,
  ExternalArchiveItemId,
  ExternalArchiveSha256,
  ExternalArchiveStore,
  ExternalArchiveTimestamp,
  ExternalArchiveUpsertResult,
  NewExternalArchiveAsset,
  NewExternalArchiveItem,
  NewExternalArchiveItemAsset,
} from "./types";

type ExternalArchiveItemRow = typeof externalArchiveItems.$inferSelect;
type ExternalArchiveItemInsert = typeof externalArchiveItems.$inferInsert;
type ExternalArchiveAssetRow = typeof externalArchiveAssets.$inferSelect;
type ExternalArchiveItemAssetRow =
  typeof externalArchiveItemAssets.$inferSelect;

/** Convierte una fecha ISO-8601 del contrato a `Date` para el driver. */
function parseTimestamp(value: ExternalArchiveTimestamp, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha ISO-8601 inválida en "${field}": "${value}"`);
  }
  return date;
}

/** Compara fechas del driver admitiendo `null`/`undefined` como ausencia. */
function sameTimestamp(
  existing: Date | null | undefined,
  desired: Date | null | undefined,
): boolean {
  const left = existing ?? null;
  const right = desired ?? null;
  if (left === null || right === null) {
    return left === right;
  }
  return left.getTime() === right.getTime();
}

/**
 * Valida las dos direcciones del check `alias_iff_status` con un error claro
 * (la base lo vuelve a imponer como última línea de defensa).
 */
function assertAliasConsistency(item: NewExternalArchiveItem): void {
  const aliasOf = item.aliasOfCanonicalUrl ?? null;
  if ((item.status === "alias") !== (aliasOf !== null)) {
    throw new Error(
      "Un item solo puede tener alias_of_canonical_url si status = 'alias' (y viceversa)",
    );
  }
}

function itemToRowValues(
  item: NewExternalArchiveItem,
): ExternalArchiveItemInsert {
  return {
    originalUrl: item.originalUrl,
    canonicalUrl: item.canonicalUrl,
    kind: item.kind,
    host: item.host,
    language: item.language ?? null,
    title: item.title ?? null,
    content: item.content ?? null,
    contentSha256: item.contentSha256 ?? null,
    contentFormat: item.contentFormat ?? null,
    sourceRepository: item.sourceRepository ?? null,
    sourceCommit: item.sourceCommit ?? null,
    sourcePath: item.sourcePath ?? null,
    capturedAt: parseTimestamp(item.capturedAt, "capturedAt"),
    method: item.method,
    httpStatus: item.httpStatus ?? null,
    waybackUrl: item.waybackUrl ?? null,
    waybackCapturedAt:
      item.waybackCapturedAt === undefined || item.waybackCapturedAt === null
        ? null
        : parseTimestamp(item.waybackCapturedAt, "waybackCapturedAt"),
    waybackHttpStatus: item.waybackHttpStatus ?? null,
    status: item.status,
    lastError: item.lastError ?? null,
    aliasOfCanonicalUrl: item.aliasOfCanonicalUrl ?? null,
  };
}

/**
 * Campos cuyo cambio obliga a escribir (§5.2): hash del contenido, estado,
 * alias y metadatos Wayback. El resto de metadatos no dispara escritura por sí
 * solo, para no romper la idempotencia del CLI.
 */
function itemNeedsUpdate(
  existing: ExternalArchiveItemRow,
  desired: ExternalArchiveItemInsert,
): boolean {
  return (
    existing.contentSha256 !== (desired.contentSha256 ?? null) ||
    existing.status !== desired.status ||
    existing.aliasOfCanonicalUrl !== (desired.aliasOfCanonicalUrl ?? null) ||
    existing.waybackUrl !== (desired.waybackUrl ?? null) ||
    !sameTimestamp(existing.waybackCapturedAt, desired.waybackCapturedAt) ||
    existing.waybackHttpStatus !== (desired.waybackHttpStatus ?? null)
  );
}

function toExternalArchiveItem(
  row: ExternalArchiveItemRow,
): ExternalArchiveItem {
  return {
    id: row.id,
    originalUrl: row.originalUrl,
    canonicalUrl: row.canonicalUrl,
    kind: row.kind as ExternalArchiveItem["kind"],
    host: row.host,
    language: row.language as ExternalArchiveItem["language"],
    title: row.title,
    content: row.content,
    contentSha256: row.contentSha256,
    contentFormat: row.contentFormat as ExternalArchiveItem["contentFormat"],
    sourceRepository: row.sourceRepository,
    sourceCommit: row.sourceCommit,
    sourcePath: row.sourcePath,
    capturedAt: row.capturedAt.toISOString(),
    method: row.method as ExternalArchiveItem["method"],
    httpStatus: row.httpStatus,
    waybackUrl: row.waybackUrl,
    waybackCapturedAt: row.waybackCapturedAt?.toISOString() ?? null,
    waybackHttpStatus: row.waybackHttpStatus,
    status: row.status as ExternalArchiveItem["status"],
    lastError: row.lastError,
    aliasOfCanonicalUrl: row.aliasOfCanonicalUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toExternalArchiveAsset(
  row: ExternalArchiveAssetRow,
): ExternalArchiveAsset {
  return {
    sha256: row.sha256,
    bytes: row.bytes,
    contentType: row.contentType,
    byteSize: row.byteSize,
    sourceUrl: row.sourceUrl,
    capturedAt: row.capturedAt.toISOString(),
  };
}

function toExternalArchiveItemAsset(
  row: ExternalArchiveItemAssetRow,
): ExternalArchiveItemAsset {
  return {
    itemId: row.itemId,
    assetSha256: row.assetSha256,
    originalUrl: row.originalUrl,
    alt: row.alt,
  };
}

export class PostgresExternalArchiveStore<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> implements ExternalArchiveStore {
  constructor(private readonly db: PgDatabase<TQueryResult, TFullSchema>) {}

  /**
   * Inserta o actualiza el item por `canonical_url`. Devuelve `"unchanged"`
   * sin escribir nada cuando hash, estado, alias y metadatos Wayback coinciden.
   */
  async upsertItem(
    item: NewExternalArchiveItem,
  ): Promise<ExternalArchiveUpsertResult> {
    assertAliasConsistency(item);
    const desired = itemToRowValues(item);

    const [existing] = await this.db
      .select()
      .from(externalArchiveItems)
      .where(eq(externalArchiveItems.canonicalUrl, item.canonicalUrl))
      .limit(1);

    if (!existing) {
      const [inserted] = await this.db
        .insert(externalArchiveItems)
        .values(desired)
        .onConflictDoNothing({
          target: externalArchiveItems.canonicalUrl,
        })
        .returning({ id: externalArchiveItems.id });

      if (inserted) {
        return "inserted";
      }

      const [concurrent] = await this.db
        .select()
        .from(externalArchiveItems)
        .where(eq(externalArchiveItems.canonicalUrl, item.canonicalUrl))
        .limit(1);
      if (!concurrent) {
        throw new Error(
          `No se pudo insertar ni encontrar el item archivado "${item.canonicalUrl}"`,
        );
      }
      return (await this.writeItemUpdate(concurrent, desired))
        ? "updated"
        : "unchanged";
    }

    return (await this.writeItemUpdate(existing, desired))
      ? "updated"
      : "unchanged";
  }

  private async writeItemUpdate(
    existing: ExternalArchiveItemRow,
    desired: ExternalArchiveItemInsert,
  ): Promise<boolean> {
    if (!itemNeedsUpdate(existing, desired)) {
      return false;
    }
    await this.db
      .update(externalArchiveItems)
      .set({ ...desired, updatedAt: new Date() })
      .where(eq(externalArchiveItems.id, existing.id));
    return true;
  }

  /**
   * Inserta los bytes de una imagen con `ON CONFLICT (sha256) DO NOTHING`
   * (idempotente y direccionado por contenido; nunca reescribe bytes).
   */
  async upsertAsset(
    asset: NewExternalArchiveAsset,
  ): Promise<ExternalArchiveAssetUpsertResult> {
    if (asset.bytes.byteLength !== asset.byteSize) {
      throw new Error(
        `byte_size incoherente para el asset ${asset.sha256}: declarado ${asset.byteSize}, real ${asset.bytes.byteLength}`,
      );
    }
    const [inserted] = await this.db
      .insert(externalArchiveAssets)
      .values({
        sha256: asset.sha256,
        bytes: asset.bytes,
        contentType: asset.contentType,
        byteSize: asset.byteSize,
        sourceUrl: asset.sourceUrl,
        capturedAt: parseTimestamp(asset.capturedAt, "capturedAt"),
      })
      .onConflictDoNothing({ target: externalArchiveAssets.sha256 })
      .returning({ sha256: externalArchiveAssets.sha256 });

    return inserted ? "inserted" : "unchanged";
  }

  /**
   * Enlaza un item con un asset por (`item_id`, `original_url`). Es idempotente
   * y solo actualiza la fila si cambia el sha256 o el `alt` literal.
   */
  async linkItemAsset(
    link: NewExternalArchiveItemAsset,
  ): Promise<ExternalArchiveUpsertResult> {
    const alt = link.alt ?? null;
    const [existing] = await this.db
      .select()
      .from(externalArchiveItemAssets)
      .where(
        and(
          eq(externalArchiveItemAssets.itemId, link.itemId),
          eq(externalArchiveItemAssets.originalUrl, link.originalUrl),
        ),
      )
      .limit(1);

    if (!existing) {
      const [inserted] = await this.db
        .insert(externalArchiveItemAssets)
        .values({
          itemId: link.itemId,
          assetSha256: link.assetSha256,
          originalUrl: link.originalUrl,
          alt,
        })
        .onConflictDoNothing({
          target: [
            externalArchiveItemAssets.itemId,
            externalArchiveItemAssets.originalUrl,
          ],
        })
        .returning({ itemId: externalArchiveItemAssets.itemId });

      if (inserted) {
        return "inserted";
      }

      const [concurrent] = await this.db
        .select()
        .from(externalArchiveItemAssets)
        .where(
          and(
            eq(externalArchiveItemAssets.itemId, link.itemId),
            eq(externalArchiveItemAssets.originalUrl, link.originalUrl),
          ),
        )
        .limit(1);
      if (!concurrent) {
        throw new Error(
          `No se pudo enlazar ni encontrar el asset "${link.originalUrl}" del item ${link.itemId}`,
        );
      }
      return (await this.writeLinkUpdate(concurrent, link.assetSha256, alt))
        ? "updated"
        : "unchanged";
    }

    return (await this.writeLinkUpdate(existing, link.assetSha256, alt))
      ? "updated"
      : "unchanged";
  }

  private async writeLinkUpdate(
    existing: ExternalArchiveItemAssetRow,
    assetSha256: ExternalArchiveSha256,
    alt: string | null,
  ): Promise<boolean> {
    if (existing.assetSha256 === assetSha256 && existing.alt === alt) {
      return false;
    }
    await this.db
      .update(externalArchiveItemAssets)
      .set({ assetSha256, alt })
      .where(
        and(
          eq(externalArchiveItemAssets.itemId, existing.itemId),
          eq(externalArchiveItemAssets.originalUrl, existing.originalUrl),
        ),
      );
    return true;
  }

  /** Todos los items ordenados por `canonical_url` (orden estable para índices). */
  async listItems(): Promise<readonly ExternalArchiveItem[]> {
    const rows = await this.db
      .select()
      .from(externalArchiveItems)
      .orderBy(externalArchiveItems.canonicalUrl);
    return rows.map(toExternalArchiveItem);
  }

  /** Búsqueda exacta por URL canónica; la normalización es responsabilidad del llamador. */
  async getItemByCanonicalUrl(
    canonicalUrl: string,
  ): Promise<ExternalArchiveItem | null> {
    const [row] = await this.db
      .select()
      .from(externalArchiveItems)
      .where(eq(externalArchiveItems.canonicalUrl, canonicalUrl))
      .limit(1);
    return row ? toExternalArchiveItem(row) : null;
  }

  async getAsset(
    sha256: ExternalArchiveSha256,
  ): Promise<ExternalArchiveAsset | null> {
    const [row] = await this.db
      .select()
      .from(externalArchiveAssets)
      .where(eq(externalArchiveAssets.sha256, sha256))
      .limit(1);
    return row ? toExternalArchiveAsset(row) : null;
  }

  /** Assets de un item ordenados por URL original (para resolver imágenes). */
  async listItemAssets(
    itemId: ExternalArchiveItemId,
  ): Promise<readonly ExternalArchiveItemAsset[]> {
    const rows = await this.db
      .select()
      .from(externalArchiveItemAssets)
      .where(eq(externalArchiveItemAssets.itemId, itemId))
      .orderBy(externalArchiveItemAssets.originalUrl);
    return rows.map(toExternalArchiveItemAsset);
  }
}
