/**
 * Inventario reproducible de enlaces del snapshot SOURCE hacia hosts de
 * 4Geeks (AC-2.5.1, plan §2).
 *
 * `buildLinkInventory` es una función pura: recibe los documentos del snapshot
 * (`path` + texto + idioma ADR-012) y devuelve el inventario agrupado por URL
 * canónica, con ocurrencias, documentos de origen e idioma. No toca red ni
 * base de datos.
 *
 * Los cargadores hacen SOLO `SELECT`:
 * - `loadInventoryFromSnapshot(db)` lee el snapshot activo con los helpers ya
 *   existentes de `source/store` (sin modificarlos).
 * - `loadInventoryFromDirectory(dir)` lee un árbol de `content/` local
 *   (`--from-dir`), sin base de datos.
 *
 * Los documentos se declaran con su path relativo al repositorio
 * (`content/projects/…/README.md`); el idioma sale de la columna `language`
 * (base) o de la evidencia de path (`resolveSourceLanguage`, directorio).
 */

import { and, eq, isNotNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { resolveSourceLanguage } from "../source/classify/paths";
import { sourceFiles } from "../source/store/schema";
import { PostgresSourceStore } from "../source/store/postgres-store";
import type { SourceLanguage } from "../source/types";
import {
  canonicalizeUrl,
  canonicalUrlHost,
  classifyUrl,
  EXTERNAL_URL_CLASSES,
  type ExternalUrlClass,
} from "./urls";

/** Extensiones textuales del corpus que se inspeccionan (plan §2.1). */
export const INVENTORY_TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".md",
  ".json",
  ".csv",
  ".html",
  ".css",
  ".js",
  ".sql",
  ".txt",
  ".ipynb",
]);

/**
 * Captura una URL absoluta sin espacios ni delimitadores de Markdown/HTML
 * (`<`, `>`, comillas, backtick, paréntesis y corchetes). Evita que el enlace
 * malformado `[https://…/docs](https://…/docs)` se una en un solo match y
 * separa la primera URL de su `]` (plan §2.8).
 */
export const URL_EXTRACTION_PATTERN = /https?:\/\/[^\s<>"'`\]\[()]+/gi;

export type InventoryLanguage = "es" | "en";

export type InventoryInputFile = Readonly<{
  /** Path relativo al repositorio (p. ej. `content/projects/x/README.md`). */
  path: string;
  text: string;
  /** Idioma ADR-012 del documento; `null` si no se conoce. */
  language: InventoryLanguage | null;
}>;

export type InventoryDocument = Readonly<{
  path: string;
  language: InventoryLanguage | null;
  occurrences: number;
}>;

export type InventoryEntry = Readonly<{
  canonicalUrl: string;
  host: string;
  className: ExternalUrlClass;
  occurrences: number;
  /** Documentos donde aparece la URL, ordenados por path. */
  documents: readonly InventoryDocument[];
  /** Strings literales distintos del corpus que canonicalizan a esta URL. */
  rawUrls: readonly string[];
}>;

export type InventoryClassSummary = Readonly<{
  occurrences: number;
  urls: number;
  documents: number;
}>;

export type LinkInventory = Readonly<{
  /** Documentos textuales inspeccionados. */
  files: number;
  /** Ocurrencias totales de URLs de hosts de 4Geeks (incluye out-of-scope). */
  occurrences: number;
  /**
   * Documentos únicos con al menos una ocurrencia de las clases archivables
   * (lección, herramienta o marketing), como en el plan §2.3; los documentos
   * que solo citan hosts out-of-scope se cuentan en `byClass`.
   */
  documents: number;
  /** Entradas ordenadas por URL canónica. */
  entries: readonly InventoryEntry[];
  /** Ocurrencias por host (solo hosts de 4Geeks). */
  byHost: Readonly<Record<string, number>>;
  /** Resumen por clase, con las cuatro clases siempre presentes. */
  byClass: Readonly<Record<ExternalUrlClass, InventoryClassSummary>>;
}>;

export function extractUrls(text: string): string[] {
  return text.match(URL_EXTRACTION_PATTERN) ?? [];
}

function isInventoryLanguage(value: string | null): value is InventoryLanguage {
  return value === "es" || value === "en";
}

export function buildLinkInventory(
  files: readonly InventoryInputFile[],
): LinkInventory {
  type MutableEntry = {
    canonicalUrl: string;
    host: string;
    className: ExternalUrlClass;
    occurrences: number;
    documents: Map<
      string,
      { language: InventoryLanguage | null; count: number }
    >;
    rawUrls: Set<string>;
  };

  const entries = new Map<string, MutableEntry>();
  const byHost = new Map<string, number>();
  const byClass = new Map<
    ExternalUrlClass,
    { occurrences: number; urls: number; documents: Set<string> }
  >();
  for (const className of EXTERNAL_URL_CLASSES) {
    byClass.set(className, { occurrences: 0, urls: 0, documents: new Set() });
  }
  const documentsWithLinks = new Set<string>();
  let occurrences = 0;

  for (const file of files) {
    for (const rawUrl of extractUrls(file.text)) {
      const canonicalUrl = canonicalizeUrl(rawUrl);
      if (canonicalUrl === null) {
        continue;
      }
      const className = classifyUrl(canonicalUrl);
      if (className === null) {
        continue;
      }
      const host = canonicalUrlHost(canonicalUrl) ?? "";
      occurrences += 1;
      if (className !== "out-of-scope") {
        documentsWithLinks.add(file.path);
      }
      byHost.set(host, (byHost.get(host) ?? 0) + 1);

      let entry = entries.get(canonicalUrl);
      if (entry === undefined) {
        entry = {
          canonicalUrl,
          host,
          className,
          occurrences: 0,
          documents: new Map(),
          rawUrls: new Set(),
        };
        entries.set(canonicalUrl, entry);
      }
      entry.occurrences += 1;
      entry.rawUrls.add(rawUrl);
      const document = entry.documents.get(file.path);
      if (document === undefined) {
        entry.documents.set(file.path, {
          language: file.language,
          count: 1,
        });
      } else {
        document.count += 1;
      }

      const classSummary = byClass.get(className);
      if (classSummary !== undefined) {
        classSummary.occurrences += 1;
        classSummary.documents.add(file.path);
      }
    }
  }

  const sortedEntries: InventoryEntry[] = [...entries.values()]
    .sort((a, b) => (a.canonicalUrl < b.canonicalUrl ? -1 : 1))
    .map((entry) => ({
      canonicalUrl: entry.canonicalUrl,
      host: entry.host,
      className: entry.className,
      occurrences: entry.occurrences,
      documents: [...entry.documents.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([documentPath, document]) => ({
          path: documentPath,
          language: document.language,
          occurrences: document.count,
        })),
      rawUrls: [...entry.rawUrls].sort(),
    }));

  const classSummaryRecord = Object.fromEntries(
    EXTERNAL_URL_CLASSES.map((className) => {
      const summary = byClass.get(className) ?? {
        occurrences: 0,
        urls: 0,
        documents: new Set<string>(),
      };
      const urls = sortedEntries.filter(
        (entry) => entry.className === className,
      ).length;
      return [
        className,
        {
          occurrences: summary.occurrences,
          urls,
          documents: summary.documents.size,
        },
      ];
    }),
  ) as Record<ExternalUrlClass, InventoryClassSummary>;

  return {
    files: files.length,
    occurrences,
    documents: documentsWithLinks.size,
    entries: sortedEntries,
    byHost: Object.fromEntries(
      [...byHost.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
    byClass: classSummaryRecord,
  };
}

/** Path de inventario de un archivo de `--from-dir` (relativo al repo). */
export function inventoryPathForDirectoryFile(
  directory: string,
  file: string,
): string {
  const relative = path.relative(directory, file).split(path.sep).join("/");
  return path.basename(directory) === "content"
    ? `content/${relative}`
    : relative;
}

/** Procedencia del inventario cargado (snapshot o directorio local). */
export type InventorySource =
  | Readonly<{
      kind: "snapshot";
      snapshotId: string;
      commitSha: string;
      repository: string;
    }>
  | Readonly<{ kind: "directory"; directory: string }>;

export type InventoryLoadResult = Readonly<{
  inventory: LinkInventory;
  source: InventorySource;
}>;

/**
 * Carga el inventario desde un árbol de `content/` local (`--from-dir`), sin
 * base de datos. El idioma se resuelve por evidencia de path (ADR-012).
 */
export function loadInventoryWithSourceFromDirectory(
  directory: string,
): InventoryLoadResult {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        INVENTORY_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(fullPath);
      }
    }
  };
  walk(directory);

  const knownPaths = new Set(
    files.map((file) => inventoryPathForDirectoryFile(directory, file)),
  );
  const inputs: InventoryInputFile[] = files.map((file) => {
    const inventoryPath = inventoryPathForDirectoryFile(directory, file);
    const { language } = resolveSourceLanguage(inventoryPath, knownPaths);
    return {
      path: inventoryPath,
      text: readFileSync(file, "utf8"),
      language: isInventoryLanguage(language) ? language : null,
    };
  });

  return {
    inventory: buildLinkInventory(inputs),
    source: { kind: "directory", directory },
  };
}

export function loadInventoryFromDirectory(directory: string): LinkInventory {
  return loadInventoryWithSourceFromDirectory(directory).inventory;
}

/**
 * Carga el inventario del snapshot activo con un `SELECT` de solo lectura.
 * Reutiliza `PostgresSourceStore.findActiveSnapshot` sin modificarlo.
 */
export async function loadInventoryWithSourceFromSnapshot<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
>(db: PgDatabase<TQueryResult, TFullSchema>): Promise<InventoryLoadResult> {
  const active = await new PostgresSourceStore(db).findActiveSnapshot();
  if (active === null) {
    throw new Error(
      "No hay snapshot SOURCE activo: importa el repositorio antes de inventariar (o usa --from-dir).",
    );
  }

  const rows = await db
    .select({
      path: sourceFiles.path,
      rawContent: sourceFiles.rawContent,
      language: sourceFiles.language,
    })
    .from(sourceFiles)
    .where(
      and(
        eq(sourceFiles.snapshotId, active.snapshotId),
        isNotNull(sourceFiles.rawContent),
      ),
    )
    .orderBy(sourceFiles.path);

  const inputs: InventoryInputFile[] = [];
  for (const row of rows) {
    if (row.rawContent === null) {
      continue;
    }
    const language = (row.language as SourceLanguage | null) ?? null;
    inputs.push({
      path: row.path,
      text: row.rawContent,
      language: isInventoryLanguage(language) ? language : null,
    });
  }

  return {
    inventory: buildLinkInventory(inputs),
    source: {
      kind: "snapshot",
      snapshotId: active.snapshotId,
      commitSha: active.commitSha,
      repository: `${active.owner}/${active.name}`,
    },
  };
}

export async function loadInventoryFromSnapshot<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
>(db: PgDatabase<TQueryResult, TFullSchema>): Promise<LinkInventory> {
  return (await loadInventoryWithSourceFromSnapshot(db)).inventory;
}
