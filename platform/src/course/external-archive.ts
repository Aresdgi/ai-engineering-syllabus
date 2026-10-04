/**
 * Lectura de la clase EXTERNAL_ARCHIVE desde la capa `course/` (Hito 2.5,
 * plan `docs/milestones/M2B_AUDIT_PLAN.md` §5.3/§6.3 + §8).
 *
 * - Solo lectura: usa las lecturas del store de W0
 *   (`platform/src/external-archive/store.ts`) sobre `getCourseDb()`; sin base
 *   devuelve `[]`/`null`. Ninguna función escribe ni hace red (AC-2.5.8).
 * - El índice (URL canónica → item) y los assets de cada item se cargan una
 *   vez por lector (`createExternalArchiveReader`). Las funciones congeladas
 *   comparten un lector por request con `cache()` de React (T-01): las tablas
 *   `external_archive_*` son mutables (el CLI captura desde otro proceso) y un
 *   memo de proceso dejaría la vista desactualizada hasta reiniciar; entre
 *   requests se relee. El `CourseReader` no memoiza el índice con el snapshot.
 * - `createExternalArchiveResolver(item)` es síncrono (contrato congelado):
 *   usa el índice y los assets ya cargados para ese item. Por eso las funciones
 *   async que devuelven un item (`getArchivedItemByHref`, `listArchivedItems`,
 *   …) cargan antes su índice de assets. Sin índice cargado, las imágenes
 *   quedan como enlaces externos (degradación segura, nunca inventa).
 * - Literalidad (AC-2.5.10): aquí no se genera contenido; solo se mapean las
 *   URLs literales del Markdown a rutas internas o externas.
 */

import "server-only";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { cache } from "react";

import type { MarkdownUrl } from "../lib/markdown/types";
import { PostgresExternalArchiveStore } from "../external-archive/store";
import type { ExternalArchiveItem as StoredExternalArchiveItem } from "../external-archive/types";
import { canonicalizeUrl } from "../external-archive/urls";
import { getCourseDb } from "./database";
import { externalArchiveMarkdownUrl } from "./links";
import { archiveAssetHref, archiveHref, parseArchiveTarget } from "./routes";
import type {
  CourseLanguage,
  ExternalArchiveItem,
  ExternalArchiveLink,
} from "./types";

/** Resultado de elegir la variante de idioma de un item archivado. */
export type ResolvedArchiveVariant = {
  item: ExternalArchiveItem;
  isFallback: boolean;
};

/** Bytes de un asset archivado servido por `/archive-assets/<sha256>`. */
export type ArchivedAssetBytes = {
  bytes: Uint8Array;
  contentType: string;
};

/**
 * Puerto de lectura de EXTERNAL_ARCHIVE para la capa `course/`. El contrato
 * congelado de §6.3 son las funciones sueltas exportadas al final del módulo;
 * esta interfaz permite inyectar la base (tests con PGlite, `CourseReader`) y
 * aislar las cachés por instancia.
 */
export interface ExternalArchiveReader {
  listArchivedItems(): Promise<ExternalArchiveItem[]>;
  getArchivedItemByCanonicalUrl(
    canonicalUrl: string,
  ): Promise<ExternalArchiveItem | null>;
  getArchivedItemByHref(href: string): Promise<ExternalArchiveItem | null>;
  resolveArchivedAlias(
    item: ExternalArchiveItem,
  ): Promise<ExternalArchiveItem | null>;
  resolveArchivedVariant(
    item: ExternalArchiveItem,
    lang: CourseLanguage,
  ): Promise<ResolvedArchiveVariant>;
  createExternalArchiveResolver(
    item: ExternalArchiveItem,
  ): (rawHref: string) => MarkdownUrl;
  getArchivedAsset(sha256: string): Promise<ArchivedAssetBytes | null>;
  createExternalArchiveIndex(): Promise<
    ReadonlyMap<string, ExternalArchiveLink>
  >;
}

type ArchiveIndex = {
  items: ExternalArchiveItem[];
  byCanonicalUrl: Map<string, ExternalArchiveItem>;
  links: Map<string, ExternalArchiveLink>;
};

function emptyIndex(): ArchiveIndex {
  return {
    items: [],
    byCanonicalUrl: new Map(),
    links: new Map(),
  };
}

/**
 * Ruta interna del item si tiene copia propia. Las lecciones `captured` y los
 * alias (`status = "alias"`, §8) abren `/archive/<host>/<path…>`; el resto
 * (herramientas, `unavailable`, `error`) no tiene página propia.
 */
function archivePageHref(item: StoredExternalArchiveItem): string | null {
  if (item.kind !== "lesson") {
    return null;
  }
  if (item.status !== "captured" && item.status !== "alias") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(item.canonicalUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    path = url.pathname;
  }
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return archiveHref(url.host.toLowerCase(), path);
}

function toCourseItem(row: StoredExternalArchiveItem): ExternalArchiveItem {
  return {
    id: row.id,
    canonicalUrl: row.canonicalUrl,
    kind: row.kind,
    language: row.language,
    status: row.status,
    href: archivePageHref(row),
    waybackUrl: row.waybackUrl,
    waybackCapturedAt: row.waybackCapturedAt,
    aliasOfCanonicalUrl: row.aliasOfCanonicalUrl,
    originalUrl: row.originalUrl,
    host: row.host,
    title: row.title,
    content: row.content,
    contentSha256: row.contentSha256,
    sourceRepository: row.sourceRepository,
    sourceCommit: row.sourceCommit,
    sourcePath: row.sourcePath,
    capturedAt: row.capturedAt,
    method: row.method,
    httpStatus: row.httpStatus,
  };
}

function toLink(item: ExternalArchiveItem): ExternalArchiveLink {
  return {
    id: item.id,
    canonicalUrl: item.canonicalUrl,
    kind: item.kind,
    language: item.language,
    status: item.status,
    href: item.href,
    waybackUrl: item.waybackUrl,
    waybackCapturedAt: item.waybackCapturedAt,
    aliasOfCanonicalUrl: item.aliasOfCanonicalUrl,
  };
}

/**
 * Clave literal de par de idioma: mismo `source_repository` y `source_path`
 * sin el sufijo de idioma (`.es.md`/`.en.md` → `.md`). `null` si falta
 * procedencia (sin ella no se relacionan items: nunca se inventa).
 */
function sourcePathPairKey(
  item: ExternalArchiveItem,
): { repository: string; path: string } | null {
  if (item.sourceRepository === null || item.sourcePath === null) {
    return null;
  }
  const path = item.sourcePath
    .replace(/\.(?:es|en)\.md$/i, ".md")
    .replace(/\.md$/i, "");
  return { repository: item.sourceRepository, path };
}

function samePairKey(
  a: { repository: string; path: string },
  b: { repository: string; path: string },
): boolean {
  return a.repository === b.repository && a.path === b.path;
}

class CourseExternalArchiveReader<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> implements ExternalArchiveReader {
  private index: Promise<ArchiveIndex> | null = null;

  private readonly links = new Map<string, ExternalArchiveLink>();

  private readonly assetsByItemId = new Map<string, Map<string, string>>();

  constructor(
    private readonly db: PgDatabase<TQueryResult, TFullSchema> | null,
  ) {}

  private async load(): Promise<ArchiveIndex> {
    if (this.index === null) {
      this.index = this.buildIndex();
    }
    return this.index;
  }

  private async buildIndex(): Promise<ArchiveIndex> {
    const db = this.db;
    if (db === null) {
      return emptyIndex();
    }
    const store = new PostgresExternalArchiveStore(db);
    const items = (await store.listItems()).map(toCourseItem);
    const byCanonicalUrl = new Map<string, ExternalArchiveItem>();
    for (const item of items) {
      byCanonicalUrl.set(item.canonicalUrl, item);
      this.links.set(item.canonicalUrl, toLink(item));
    }
    await Promise.all(
      items.map(async (item) => {
        const links = await store.listItemAssets(item.id);
        const byOriginalUrl = new Map<string, string>();
        for (const link of links) {
          byOriginalUrl.set(link.originalUrl, link.assetSha256);
        }
        this.assetsByItemId.set(item.id, byOriginalUrl);
      }),
    );
    return { items, byCanonicalUrl, links: this.links };
  }

  async listArchivedItems(): Promise<ExternalArchiveItem[]> {
    return [...(await this.load()).items];
  }

  async getArchivedItemByCanonicalUrl(
    canonicalUrl: string,
  ): Promise<ExternalArchiveItem | null> {
    return (await this.load()).byCanonicalUrl.get(canonicalUrl) ?? null;
  }

  async getArchivedItemByHref(
    href: string,
  ): Promise<ExternalArchiveItem | null> {
    const path = href.split("#")[0]!.split("?")[0]!;
    const segments = path.split("/").filter((segment) => segment.length > 0);
    if (segments[0] === "archive") {
      segments.shift();
    }
    const target = parseArchiveTarget(segments);
    if (target === null) {
      return null;
    }
    const canonicalUrl =
      target.path === ""
        ? `https://${target.host}`
        : `https://${target.host}/${target.path}`;
    return this.getArchivedItemByCanonicalUrl(canonicalUrl);
  }

  async resolveArchivedAlias(
    item: ExternalArchiveItem,
  ): Promise<ExternalArchiveItem | null> {
    if (item.status !== "alias" || item.aliasOfCanonicalUrl === null) {
      return null;
    }
    return this.getArchivedItemByCanonicalUrl(item.aliasOfCanonicalUrl);
  }

  async resolveArchivedVariant(
    item: ExternalArchiveItem,
    lang: CourseLanguage,
  ): Promise<ResolvedArchiveVariant> {
    let base = item;
    if (base.status === "alias") {
      const target = await this.resolveArchivedAlias(base);
      if (target !== null) {
        base = target;
      }
    }
    if (base.language === lang) {
      return { item: base, isFallback: false };
    }
    const pairKey = sourcePathPairKey(base);
    if (pairKey !== null) {
      const index = await this.load();
      const candidate = index.items.find((entry) => {
        if (
          entry.status !== "captured" ||
          entry.kind !== base.kind ||
          entry.language !== lang
        ) {
          return false;
        }
        const entryKey = sourcePathPairKey(entry);
        return entryKey !== null && samePairKey(entryKey, pairKey);
      });
      if (candidate !== undefined) {
        return { item: candidate, isFallback: false };
      }
    }
    return { item: base, isFallback: base.language !== lang };
  }

  async getArchivedAsset(sha256: string): Promise<ArchivedAssetBytes | null> {
    const db = this.db;
    if (db === null) {
      return null;
    }
    const store = new PostgresExternalArchiveStore(db);
    const asset = await store.getAsset(sha256);
    if (asset === null) {
      return null;
    }
    return { bytes: asset.bytes, contentType: asset.contentType };
  }

  async createExternalArchiveIndex(): Promise<
    ReadonlyMap<string, ExternalArchiveLink>
  > {
    return (await this.load()).links;
  }

  createExternalArchiveResolver(
    item: ExternalArchiveItem,
  ): (rawHref: string) => MarkdownUrl {
    return (rawHref) => this.resolveArchivedHref(item, rawHref);
  }

  private resolveArchivedHref(
    item: ExternalArchiveItem,
    rawHref: string,
  ): MarkdownUrl {
    if (!/^https?:/i.test(rawHref)) {
      return { kind: "external", href: rawHref };
    }
    const assetSha256 = this.assetSha256For(item, rawHref);
    if (assetSha256 !== null) {
      return {
        kind: "archive-asset",
        href: archiveAssetHref(assetSha256),
        sha256: assetSha256,
      };
    }
    const canonical = canonicalizeUrl(rawHref);
    if (canonical !== null) {
      const link =
        this.links.get(canonical) ??
        (canonical === item.canonicalUrl ? toLink(item) : undefined);
      if (link !== undefined) {
        return externalArchiveMarkdownUrl(rawHref, link);
      }
    }
    return { kind: "external", href: rawHref };
  }

  private assetSha256For(
    item: ExternalArchiveItem,
    rawHref: string,
  ): string | null {
    const byOriginalUrl = this.assetsByItemId.get(item.id);
    if (byOriginalUrl === undefined) {
      return null;
    }
    const direct = byOriginalUrl.get(rawHref);
    if (direct !== undefined) {
      return direct;
    }
    const canonical = canonicalizeUrl(rawHref);
    return canonical === null ? null : (byOriginalUrl.get(canonical) ?? null);
  }
}

/**
 * Crea un lector de EXTERNAL_ARCHIVE sobre una base ya construida (o `null`,
 * que degrada a `[]`/`null`). Es la vía de inyección de tests y del
 * `CourseReader`; las funciones congeladas de §6.3 usan la base del curso.
 */
export function createExternalArchiveReader<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
>(db: PgDatabase<TQueryResult, TFullSchema> | null): ExternalArchiveReader {
  return new CourseExternalArchiveReader(db);
}

/**
 * Lector de la base del curso memoizado por request con `cache()` de React
 * (T-01): dentro de una request todas las funciones congeladas comparten un
 * único índice; entre requests se reconstruye. Fuera de una request (tests,
 * scripts, client components) React no memoiza y cada llamada relee. Nunca se
 * guarda en el módulo: `external_archive_items` es mutable.
 */
const currentExternalArchiveReader = cache(
  (): ExternalArchiveReader => createExternalArchiveReader(getCourseDb()),
);

// --- Contrato congelado §6.3 (base del curso, sin parámetros) ----------------

export async function listArchivedItems(): Promise<ExternalArchiveItem[]> {
  return currentExternalArchiveReader().listArchivedItems();
}

export async function getArchivedItemByCanonicalUrl(
  canonicalUrl: string,
): Promise<ExternalArchiveItem | null> {
  return currentExternalArchiveReader().getArchivedItemByCanonicalUrl(
    canonicalUrl,
  );
}

export async function getArchivedItemByHref(
  href: string,
): Promise<ExternalArchiveItem | null> {
  return currentExternalArchiveReader().getArchivedItemByHref(href);
}

export async function resolveArchivedAlias(
  item: ExternalArchiveItem,
): Promise<ExternalArchiveItem | null> {
  return currentExternalArchiveReader().resolveArchivedAlias(item);
}

export async function resolveArchivedVariant(
  item: ExternalArchiveItem,
  lang: CourseLanguage,
): Promise<ResolvedArchiveVariant> {
  return currentExternalArchiveReader().resolveArchivedVariant(item, lang);
}

export function createExternalArchiveResolver(
  item: ExternalArchiveItem,
): (rawHref: string) => MarkdownUrl {
  return currentExternalArchiveReader().createExternalArchiveResolver(item);
}

export async function getArchivedAsset(
  sha256: string,
): Promise<ArchivedAssetBytes | null> {
  return currentExternalArchiveReader().getArchivedAsset(sha256);
}

export async function createExternalArchiveIndex(): Promise<
  ReadonlyMap<string, ExternalArchiveLink>
> {
  return currentExternalArchiveReader().createExternalArchiveIndex();
}
