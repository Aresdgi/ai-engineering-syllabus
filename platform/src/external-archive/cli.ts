/**
 * CLI de captura idempotente del material externo (AC-2.5.7, plan §5.2 + §8):
 * `pnpm --dir platform archive:external [opciones]`.
 *
 * Flags:
 * - `--dry-run`: inventario + plan, sin red y sin escrituras.
 * - `--resolve` (con `--dry-run`): valida resolubilidad con GETs, sin escribir.
 * - `--only lessons|tools`, `--from-dir <content>`, `--limit N`,
 *   `--report json|text`, `--inventory-out <path>`.
 *
 * Flujo de captura:
 * 1. Inventario: SELECT del snapshot activo (o `--from-dir`).
 * 2. Lecciones: registro BreatheCode → commit pinneado → raw de GitHub →
 *    `sha256` → imágenes → `upsertItem`/`upsertAsset`/`linkItemAsset`.
 * 3. Alias del usuario (§8.3): `status='alias'`, `method='user-alias'`,
 *    `alias_of_canonical_url` sin contenido propio; el destino debe quedar
 *    `captured` o el CLI falla.
 * 4. Herramientas: metadatos de disponibilidad Wayback
 *    (`method='wayback-metadata'`); nunca Save Page Now.
 * 5. Marketing: solo informe, nunca base de datos.
 *
 * Aislamiento SOURCE: solo se ejecuta `SELECT` sobre `source_files`; todas las
 * escrituras van a `external_archive_*`. Los errores se imprimen redactados
 * con `src/lib/redact.ts`.
 *
 * Códigos de salida: 0 sin errores, 1 con errores de captura, 2 error fatal
 * (configuración, base, alias no resoluble).
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import { describeError, redactSecrets, type RedactEnv } from "../lib/redact";
import {
  AliasValidationError,
  loadAliasDecision,
  planAliases,
} from "./aliases";
import { GithubClient, parseGithubFileUrl, pinGithubUrl } from "./github";
import { HttpClient, type FetchLike } from "./http";
import { ImageDownloader, extractImageReferences, sha256Hex } from "./images";
import {
  loadInventoryWithSourceFromDirectory,
  loadInventoryWithSourceFromSnapshot,
  type InventoryEntry,
  type InventoryLoadResult,
  type LinkInventory,
} from "./inventory";
import { RegistryClient, resolveLessonSource } from "./registry";
import { RobotsGate } from "./robots";
import { PostgresExternalArchiveStore } from "./store";
import type {
  ExternalArchiveMethod,
  ExternalArchiveStore,
  ExternalArchiveUpsertResult,
  NewExternalArchiveItem,
} from "./types";
import { lessonUrlLanguage } from "./urls";
import { WaybackClient } from "./wayback";

/** Base Drizzle admitida (node-postgres y PGlite comparten el contrato). */
export type ExternalArchiveDatabase = PgDatabase<
  PgQueryResultHKT,
  Record<string, never>
>;

export type ExternalArchiveCliEnv = RedactEnv;

export type ExternalArchiveReportFormat = "json" | "text";

export type ExternalArchiveOnly = "lessons" | "tools";

export type ExternalArchiveCliOptions = Readonly<{
  help: boolean;
  dryRun: boolean;
  resolve: boolean;
  only: ExternalArchiveOnly | null;
  fromDir: string | null;
  limit: number | null;
  report: ExternalArchiveReportFormat;
  inventoryOut: string | null;
}>;

export const EXTERNAL_ARCHIVE_USAGE = [
  "Uso: pnpm --dir platform archive:external [opciones]",
  "",
  "Opciones:",
  "  --dry-run               Inventario y plan, sin red y sin escrituras.",
  "  --resolve               Con --dry-run: valida con GETs (registro/GitHub/Wayback) sin escribir.",
  "  --only lessons|tools    Procesa solo una clase archivable.",
  "  --from-dir <content>    Inventario desde un árbol content/ local (sin base de datos).",
  "  --limit N               Limita las URLs procesadas por clase (ordenadas).",
  "  --report json|text      Formato del informe final (por defecto text).",
  "  --inventory-out <path>  Escribe el inventario completo en JSON.",
  "  --help                  Muestra esta ayuda.",
].join("\n");

type ParseResult =
  | { ok: true; options: ExternalArchiveCliOptions }
  | { ok: false; message: string };

function valueAfter(
  argv: readonly string[],
  index: number,
  flag: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    return { ok: false, message: `falta el valor de ${flag}` };
  }
  return { ok: true, value };
}

export function parseExternalArchiveArgs(argv: readonly string[]): ParseResult {
  let help = false;
  let dryRun = false;
  let resolve = false;
  let only: ExternalArchiveOnly | null = null;
  let fromDir: string | null = null;
  let limit: number | null = null;
  let report: ExternalArchiveReportFormat = "text";
  let inventoryOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--resolve") {
      resolve = true;
      continue;
    }
    if (arg === "--only") {
      const parsed = valueAfter(argv, index, "--only");
      if (!parsed.ok) {
        return parsed;
      }
      if (parsed.value !== "lessons" && parsed.value !== "tools") {
        return {
          ok: false,
          message: `valor inválido para --only: "${parsed.value}" (usa lessons|tools)`,
        };
      }
      only = parsed.value;
      index += 1;
      continue;
    }
    if (arg === "--from-dir") {
      const parsed = valueAfter(argv, index, "--from-dir");
      if (!parsed.ok) {
        return parsed;
      }
      fromDir = parsed.value;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      const parsed = valueAfter(argv, index, "--limit");
      if (!parsed.ok) {
        return parsed;
      }
      if (!/^\d+$/.test(parsed.value) || Number(parsed.value) < 1) {
        return {
          ok: false,
          message: `valor inválido para --limit: "${parsed.value}"`,
        };
      }
      limit = Number(parsed.value);
      index += 1;
      continue;
    }
    if (arg === "--report") {
      const parsed = valueAfter(argv, index, "--report");
      if (!parsed.ok) {
        return parsed;
      }
      if (parsed.value !== "json" && parsed.value !== "text") {
        return {
          ok: false,
          message: `valor inválido para --report: "${parsed.value}" (usa json|text)`,
        };
      }
      report = parsed.value;
      index += 1;
      continue;
    }
    if (arg === "--inventory-out") {
      const parsed = valueAfter(argv, index, "--inventory-out");
      if (!parsed.ok) {
        return parsed;
      }
      inventoryOut = parsed.value;
      index += 1;
      continue;
    }
    return { ok: false, message: `opción desconocida: "${arg}"` };
  }

  return {
    ok: true,
    options: {
      help,
      dryRun,
      resolve,
      only,
      fromDir,
      limit,
      report,
      inventoryOut,
    },
  };
}

// --- Estructuras del informe -------------------------------------------------

export type ExternalArchiveItemStatus =
  | "planned"
  | "captured"
  | "unavailable"
  | "alias"
  | "error";

export type ExternalArchiveItemOutcome = {
  canonicalUrl: string;
  kind: "lesson" | "tool";
  status: ExternalArchiveItemStatus;
  method: ExternalArchiveMethod;
  result: ExternalArchiveUpsertResult | null;
  contentSha256: string | null;
  title: string | null;
  httpStatus: number | null;
  error: string | null;
};

export type ExternalArchiveCounts = {
  planned: number;
  /** Items con estado `captured` (incluye los que no escribieron nada). */
  captured: number;
  inserted: number;
  updated: number;
  unchanged: number;
  unavailable: number;
  alias: number;
  errors: number;
};

function emptyCounts(): ExternalArchiveCounts {
  return {
    planned: 0,
    captured: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    unavailable: 0,
    alias: 0,
    errors: 0,
  };
}

function countOutcome(
  counts: ExternalArchiveCounts,
  outcome: ExternalArchiveItemOutcome,
): void {
  switch (outcome.status) {
    case "planned":
      counts.planned += 1;
      break;
    case "alias":
      counts.alias += 1;
      break;
    case "unavailable":
      counts.unavailable += 1;
      break;
    case "error":
      counts.errors += 1;
      break;
    case "captured":
      counts.captured += 1;
      if (outcome.result === "inserted") counts.inserted += 1;
      else if (outcome.result === "updated") counts.updated += 1;
      else if (outcome.result === "unchanged") counts.unchanged += 1;
      break;
  }
}

export type ExternalArchiveAssetCounts = {
  inserted: number;
  unchanged: number;
  linked: number;
  failed: number;
};

export type ExternalArchiveCliReport = {
  generatedAt: string;
  mode: {
    dryRun: boolean;
    resolve: boolean;
    only: ExternalArchiveOnly | null;
    limit: number | null;
    inventorySource: "snapshot" | "directory";
  };
  inventory: {
    files: number;
    occurrences: number;
    documents: number;
    urls: number;
    byHost: Record<string, number>;
    byClass: LinkInventory["byClass"];
  };
  marketing: {
    occurrences: number;
    urls: number;
    entries: { canonicalUrl: string; occurrences: number; documents: number }[];
  };
  lessons: ExternalArchiveCounts;
  tools: ExternalArchiveCounts;
  assets: ExternalArchiveAssetCounts;
  aliases: {
    /** Alias escritos en la captura real (`upsertItem` con `status='alias'`). */
    applied: number;
    /** Alias que se aplicarían pero no se escriben (dry-run/--resolve). */
    planned: number;
    skipped: number;
    targets: string[];
  };
  outcomes: ExternalArchiveItemOutcome[];
};

// --- Dependencias inyectables ------------------------------------------------

export type ExternalArchiveCliDeps = Readonly<{
  env?: ExternalArchiveCliEnv;
  fetch?: FetchLike;
  now?: () => Date;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  /** Base ya construida (tests con PGlite); `null` prohíbe escribir. */
  db?: ExternalArchiveDatabase | null;
  /** Store ya construido (tests); si falta, se construye desde `db`. */
  store?: ExternalArchiveStore;
  /** Cierra la base al terminar (la inyecta el arranque real). */
  closeDb?: () => Promise<void>;
  /** Ruta alternativa de aliases.json (tests). */
  aliasesPath?: string;
  /** Sobrescribe la base del registro (tests con fixtures). */
  registryBaseUrl?: string;
  /** Sobrescribe la API de Wayback (tests). */
  waybackBaseUrl?: string;
  /** Sobrescribe la API de commits de GitHub (tests). */
  githubApiBaseUrl?: string;
}>;

type Writers = Readonly<{
  out: (line: string) => void;
  err: (line: string) => void;
}>;

function summarizeInventory(inventory: LinkInventory) {
  return {
    files: inventory.files,
    occurrences: inventory.occurrences,
    documents: inventory.documents,
    urls: inventory.entries.length,
    byHost: { ...inventory.byHost },
    byClass: inventory.byClass,
  };
}

function firstOriginalUrl(entry: InventoryEntry): string {
  return entry.rawUrls[0] ?? entry.canonicalUrl;
}

function buildItemInput(
  entry: InventoryEntry,
  status: NewExternalArchiveItem["status"],
  capturedAt: string,
  method: ExternalArchiveMethod,
  extra: Partial<NewExternalArchiveItem> = {},
): NewExternalArchiveItem {
  return {
    originalUrl: firstOriginalUrl(entry),
    canonicalUrl: entry.canonicalUrl,
    kind: entry.className === "tool" ? "tool" : "lesson",
    host: entry.host,
    language:
      entry.className === "lesson"
        ? lessonUrlLanguage(entry.canonicalUrl)
        : null,
    capturedAt,
    method,
    status,
    ...extra,
  };
}

// --- Captura -----------------------------------------------------------------

type CaptureContext = Readonly<{
  store: ExternalArchiveStore | null;
  registry: RegistryClient;
  github: GithubClient;
  wayback: WaybackClient;
  images: ImageDownloader;
  dryRun: boolean;
  resolve: boolean;
  capturedAt: string;
  env: ExternalArchiveCliEnv;
  err: (line: string) => void;
  assets: ExternalArchiveAssetCounts;
}>;

async function captureLesson(
  entry: InventoryEntry,
  context: CaptureContext,
): Promise<ExternalArchiveItemOutcome> {
  const outcome: ExternalArchiveItemOutcome = {
    canonicalUrl: entry.canonicalUrl,
    kind: "lesson",
    status: "error",
    method: "registry-api+github-raw",
    result: null,
    contentSha256: null,
    title: null,
    httpStatus: null,
    error: null,
  };
  try {
    const source = await resolveLessonSource(
      context.registry,
      entry.canonicalUrl,
    );
    if (source === null) {
      outcome.status = "unavailable";
      outcome.httpStatus = 404;
      if (context.store !== null && !context.resolve) {
        outcome.result = await context.store.upsertItem(
          buildItemInput(
            entry,
            "unavailable",
            context.capturedAt,
            outcome.method,
            {
              httpStatus: 404,
            },
          ),
        );
      }
      return outcome;
    }
    if (source.fileUrl === null) {
      throw new Error(
        "El registro no declara fichero fuente (url/readme_url) para la lección",
      );
    }
    const location = parseGithubFileUrl(source.fileUrl);
    if (location === null) {
      throw new Error(
        `El registro declara una fuente GitHub no reconocible: ${source.fileUrl}`,
      );
    }
    const commit = await context.github.pinBranchCommit(
      location.owner,
      location.repo,
    );
    const download = await context.github.downloadFile({
      ...location,
      ref: commit,
    });
    const contentSha256 = sha256Hex(download.bytes);
    outcome.status = "captured";
    outcome.contentSha256 = contentSha256;
    outcome.title = source.asset.title;
    outcome.httpStatus = download.status;
    const itemInput = buildItemInput(
      entry,
      "captured",
      context.capturedAt,
      outcome.method,
      {
        language: source.language ?? lessonUrlLanguage(entry.canonicalUrl),
        title: source.asset.title,
        content: download.text,
        contentSha256,
        contentFormat: "markdown",
        sourceRepository: `${location.owner}/${location.repo}`,
        sourceCommit: commit,
        sourcePath: location.path,
        httpStatus: download.status,
      },
    );
    if (context.store === null || context.resolve) {
      return outcome;
    }
    outcome.result = await context.store.upsertItem(itemInput);
    const stored = await context.store.getItemByCanonicalUrl(
      entry.canonicalUrl,
    );
    if (stored === null) {
      throw new Error("El item capturado no se encontró tras el upsert");
    }
    await captureLessonImages(
      context,
      stored.id,
      download.text,
      location.owner,
      location.repo,
      commit,
    );
    return outcome;
  } catch (error) {
    outcome.status = "error";
    outcome.error = redactSecrets(
      describeError(error, context.env),
      context.env,
    );
    if (context.store !== null && !context.resolve) {
      try {
        outcome.result = await context.store.upsertItem(
          buildItemInput(entry, "error", context.capturedAt, outcome.method, {
            lastError: outcome.error.slice(0, 2000),
          }),
        );
      } catch {
        // El error original ya está registrado; no se enmascara con el fallo del upsert.
      }
    }
    return outcome;
  }
}

async function captureLessonImages(
  context: CaptureContext,
  itemId: string,
  markdown: string,
  owner: string,
  repo: string,
  commit: string,
): Promise<void> {
  const store = context.store;
  if (store === null) {
    return;
  }
  const references = extractImageReferences(markdown);
  const seen = new Set<string>();
  for (const reference of references) {
    if (seen.has(reference.originalUrl)) {
      continue;
    }
    seen.add(reference.originalUrl);
    try {
      const pinnedUrl = pinGithubUrl(reference.originalUrl, {
        owner,
        repo,
        commit,
      });
      const image = await context.images.download(pinnedUrl);
      const assetResult = await store.upsertAsset({
        sha256: image.sha256,
        bytes: image.bytes,
        contentType: image.contentType,
        byteSize: image.byteSize,
        sourceUrl: reference.originalUrl,
        capturedAt: context.capturedAt,
      });
      if (assetResult === "inserted") {
        context.assets.inserted += 1;
      } else {
        context.assets.unchanged += 1;
      }
      await store.linkItemAsset({
        itemId,
        assetSha256: image.sha256,
        originalUrl: reference.originalUrl,
        alt: reference.alt,
      });
      context.assets.linked += 1;
    } catch (error) {
      context.assets.failed += 1;
      context.err(
        `  imagen omitida (${redactSecrets(describeError(error, context.env), context.env)})`,
      );
    }
  }
}

async function captureTool(
  entry: InventoryEntry,
  context: CaptureContext,
): Promise<ExternalArchiveItemOutcome> {
  const outcome: ExternalArchiveItemOutcome = {
    canonicalUrl: entry.canonicalUrl,
    kind: "tool",
    status: "error",
    method: "wayback-metadata",
    result: null,
    contentSha256: null,
    title: null,
    httpStatus: null,
    error: null,
  };
  try {
    const availability = await context.wayback.available(entry.canonicalUrl);
    if (availability.available) {
      outcome.status = "captured";
      outcome.httpStatus = availability.httpStatus;
      if (context.store !== null && !context.resolve) {
        outcome.result = await context.store.upsertItem(
          buildItemInput(
            entry,
            "captured",
            context.capturedAt,
            outcome.method,
            {
              waybackUrl: availability.snapshotUrl,
              waybackCapturedAt: availability.capturedAt,
              waybackHttpStatus: availability.httpStatus,
            },
          ),
        );
      }
    } else {
      outcome.status = "unavailable";
      if (context.store !== null && !context.resolve) {
        outcome.result = await context.store.upsertItem(
          buildItemInput(
            entry,
            "unavailable",
            context.capturedAt,
            outcome.method,
          ),
        );
      }
    }
    return outcome;
  } catch (error) {
    outcome.status = "error";
    outcome.error = redactSecrets(
      describeError(error, context.env),
      context.env,
    );
    if (context.store !== null && !context.resolve) {
      try {
        outcome.result = await context.store.upsertItem(
          buildItemInput(entry, "error", context.capturedAt, outcome.method, {
            lastError: outcome.error.slice(0, 2000),
          }),
        );
      } catch {
        // El error original ya está registrado.
      }
    }
    return outcome;
  }
}

function aliasOutcome(source: InventoryEntry): ExternalArchiveItemOutcome {
  return {
    canonicalUrl: source.canonicalUrl,
    kind: "lesson",
    status: "alias",
    method: "user-alias",
    result: null,
    contentSha256: null,
    title: null,
    httpStatus: null,
    error: null,
  };
}

/** Índice de resultados por URL canónica (para validar destinos de alias). */
function outcomeIndex(
  outcomes: readonly ExternalArchiveItemOutcome[],
): ReadonlyMap<string, ExternalArchiveItemOutcome> {
  return new Map(outcomes.map((outcome) => [outcome.canonicalUrl, outcome]));
}

async function targetStatus(
  aliasTo: string,
  outcomes: ReadonlyMap<string, ExternalArchiveItemOutcome>,
  store: ExternalArchiveStore | null,
): Promise<string | null> {
  const outcome = outcomes.get(aliasTo);
  if (outcome !== undefined) {
    return outcome.status;
  }
  if (store !== null) {
    const stored = await store.getItemByCanonicalUrl(aliasTo);
    return stored?.status ?? null;
  }
  return null;
}

// --- Informe -----------------------------------------------------------------

function formatCounts(label: string, counts: ExternalArchiveCounts): string {
  return `${label}: capturadas ${counts.captured}, insertadas ${counts.inserted}, actualizadas ${counts.updated}, sin cambios ${counts.unchanged}, unavailable ${counts.unavailable}, alias ${counts.alias}, errores ${counts.errors}, planificadas ${counts.planned}`;
}

export function formatExternalArchiveTextReport(
  report: ExternalArchiveCliReport,
): string {
  const lines: string[] = [];
  const mode = report.mode;
  const modeLabel = mode.dryRun
    ? mode.resolve
      ? "dry-run --resolve (GETs, sin escrituras)"
      : "dry-run (sin red, sin escrituras)"
    : "captura real";
  lines.push(`archivo externo: ${modeLabel}`);
  lines.push(
    `inventario (${mode.inventorySource}): ${report.inventory.files} archivos, ${report.inventory.occurrences} ocurrencias, ${report.inventory.urls} URLs canónicas, ${report.inventory.documents} documentos`,
  );
  const hosts = Object.entries(report.inventory.byHost)
    .map(([host, count]) => `${host}=${count}`)
    .join(", ");
  lines.push(`  hosts: ${hosts}`);
  const classes = (
    Object.keys(report.inventory.byClass) as Array<
      keyof LinkInventory["byClass"]
    >
  )
    .map((className) => {
      const summary = report.inventory.byClass[className];
      return `${className}=${summary.occurrences} occ/${summary.urls} urls`;
    })
    .join(", ");
  lines.push(`  clases: ${classes}`);
  lines.push(
    `marketing: ${report.marketing.urls} URLs, ${report.marketing.occurrences} ocurrencias (solo informe, nunca base de datos)`,
  );
  lines.push(formatCounts("lecciones", report.lessons));
  for (const outcome of report.outcomes.filter(
    (entry) => entry.kind === "lesson",
  )) {
    const details = [
      outcome.status,
      outcome.result ?? "-",
      outcome.contentSha256 === null ? null : `sha256=${outcome.contentSha256}`,
      outcome.title === null ? null : `titulo=${JSON.stringify(outcome.title)}`,
      outcome.error === null ? null : `error=${outcome.error.split("\n")[0]}`,
    ]
      .filter((value): value is string => value !== null)
      .join(" | ");
    lines.push(`  ${outcome.canonicalUrl} ${details}`);
  }
  lines.push(formatCounts("herramientas", report.tools));
  for (const outcome of report.outcomes.filter(
    (entry) => entry.kind === "tool",
  )) {
    lines.push(
      `  ${outcome.canonicalUrl} ${outcome.status} | ${outcome.result ?? "-"}`,
    );
  }
  lines.push(
    `assets: insertados ${report.assets.inserted}, sin cambios ${report.assets.unchanged}, enlaces ${report.assets.linked}, fallos ${report.assets.failed}`,
  );
  lines.push(
    report.mode.dryRun || report.mode.resolve
      ? `alias: planificados ${report.aliases.planned}, omitidos ${report.aliases.skipped}`
      : `alias: aplicados ${report.aliases.applied}, omitidos ${report.aliases.skipped}`,
  );
  const errors = report.outcomes.filter(
    (outcome) => outcome.status === "error",
  );
  if (errors.length > 0) {
    lines.push(`errores (${errors.length}):`);
    for (const error of errors) {
      lines.push(
        `  ${error.canonicalUrl}: ${error.error?.split("\n")[0] ?? "error"}`,
      );
    }
  }
  return lines.join("\n");
}

// --- Flujo principal ----------------------------------------------------------

async function createRealDatabase(env: ExternalArchiveCliEnv): Promise<{
  db: ExternalArchiveDatabase;
  close: () => Promise<void>;
}> {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error(
      "falta DATABASE_URL. Copia platform/.env.example a platform/.env.local o usa --from-dir.",
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  return {
    db: drizzleNodePostgres(pool) as unknown as ExternalArchiveDatabase,
    close: () => pool.end(),
  };
}

function selectEntries(
  inventory: LinkInventory,
  options: ExternalArchiveCliOptions,
): {
  lessons: InventoryEntry[];
  tools: InventoryEntry[];
} {
  const lessons =
    options.only === "tools"
      ? []
      : inventory.entries.filter((entry) => entry.className === "lesson");
  const tools =
    options.only === "lessons"
      ? []
      : inventory.entries.filter((entry) => entry.className === "tool");
  return {
    lessons: options.limit === null ? lessons : lessons.slice(0, options.limit),
    tools: options.limit === null ? tools : tools.slice(0, options.limit),
  };
}

export async function runExternalArchiveCli(
  argv: readonly string[],
  deps: ExternalArchiveCliDeps = {},
): Promise<number> {
  const parsed = parseExternalArchiveArgs(argv);
  if (!parsed.ok) {
    console.error(`archive:external: ${parsed.message}`);
    console.error(EXTERNAL_ARCHIVE_USAGE);
    return 2;
  }
  const options = parsed.options;
  const env = deps.env ?? process.env;
  const writers: Writers = {
    out:
      deps.stdout ??
      ((line: string) => {
        console.log(redactSecrets(line, env));
      }),
    err:
      deps.stderr ??
      ((line: string) => {
        console.error(redactSecrets(line, env));
      }),
  };
  if (options.help) {
    writers.out(EXTERNAL_ARCHIVE_USAGE);
    return 0;
  }

  let closeDb: (() => Promise<void>) | null = deps.closeDb ?? null;
  let db: ExternalArchiveDatabase | null = deps.db ?? null;

  try {
    if (db === null && options.fromDir === null) {
      const real = await createRealDatabase(env);
      db = real.db;
      closeDb = real.close;
    }

    // 1. Inventario (solo lectura / ficheros).
    let loaded: InventoryLoadResult;
    if (options.fromDir !== null) {
      loaded = loadInventoryWithSourceFromDirectory(options.fromDir);
    } else if (db !== null) {
      loaded = await loadInventoryWithSourceFromSnapshot(db);
    } else {
      throw new Error("No hay base de datos ni --from-dir para inventariar");
    }
    const inventory = loaded.inventory;

    if (options.inventoryOut !== null) {
      writeFileSync(
        options.inventoryOut,
        `${JSON.stringify(
          {
            generated_at: (deps.now?.() ?? new Date()).toISOString(),
            source: loaded.source,
            inventory,
          },
          null,
          2,
        )}\n`,
      );
    }

    const selected = selectEntries(inventory, options);
    const aliasDecision = loadAliasDecision(deps.aliasesPath);
    const aliasPlan = planAliases(aliasDecision, inventory);
    const aliasByFrom = new Map(
      aliasPlan.applicable.map((alias) => [alias.from, alias]),
    );

    const report: ExternalArchiveCliReport = {
      generatedAt: (deps.now?.() ?? new Date()).toISOString(),
      mode: {
        dryRun: options.dryRun,
        resolve: options.resolve,
        only: options.only,
        limit: options.limit,
        inventorySource: loaded.source.kind,
      },
      inventory: summarizeInventory(inventory),
      marketing: {
        occurrences: inventory.byClass.marketing.occurrences,
        urls: inventory.byClass.marketing.urls,
        entries: inventory.entries
          .filter((entry) => entry.className === "marketing")
          .map((entry) => ({
            canonicalUrl: entry.canonicalUrl,
            occurrences: entry.occurrences,
            documents: entry.documents.length,
          })),
      },
      lessons: emptyCounts(),
      tools: emptyCounts(),
      assets: { inserted: 0, unchanged: 0, linked: 0, failed: 0 },
      aliases: {
        applied: 0,
        planned: 0,
        skipped: aliasPlan.skipped.length,
        targets: aliasPlan.applicable.map((alias) => alias.to),
      },
      outcomes: [],
    };

    // 2. Plan sin red: no se procesa ninguna URL.
    if (options.dryRun && !options.resolve) {
      for (const entry of selected.lessons) {
        if (aliasByFrom.has(entry.canonicalUrl)) {
          const outcome = aliasOutcome(entry);
          report.outcomes.push(outcome);
          countOutcome(report.lessons, outcome);
        } else {
          const outcome: ExternalArchiveItemOutcome = {
            canonicalUrl: entry.canonicalUrl,
            kind: "lesson",
            status: "planned",
            method: "registry-api+github-raw",
            result: null,
            contentSha256: null,
            title: null,
            httpStatus: null,
            error: null,
          };
          report.outcomes.push(outcome);
          countOutcome(report.lessons, outcome);
        }
      }
      for (const entry of selected.tools) {
        const outcome: ExternalArchiveItemOutcome = {
          canonicalUrl: entry.canonicalUrl,
          kind: "tool",
          status: "planned",
          method: "wayback-metadata",
          result: null,
          contentSha256: null,
          title: null,
          httpStatus: null,
          error: null,
        };
        report.outcomes.push(outcome);
        countOutcome(report.tools, outcome);
      }
      report.aliases.planned = aliasPlan.applicable.filter((alias) =>
        selected.lessons.some((entry) => entry.canonicalUrl === alias.from),
      ).length;
      printReport(report, options, writers);
      return 0;
    }

    // 3. Resolución/captura.
    const http = new HttpClient({
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
    });
    const robots = new RobotsGate(http);
    const registry = new RegistryClient(http, {
      robots,
      ...(deps.registryBaseUrl !== undefined
        ? { baseUrl: deps.registryBaseUrl }
        : {}),
    });
    const github = new GithubClient(http, {
      robots,
      ...(deps.githubApiBaseUrl !== undefined
        ? { apiBaseUrl: deps.githubApiBaseUrl }
        : {}),
    });
    const wayback = new WaybackClient(http, {
      robots,
      ...(deps.waybackBaseUrl !== undefined
        ? { baseUrl: deps.waybackBaseUrl }
        : {}),
    });
    const images = new ImageDownloader(http, { robots });

    const store =
      deps.store ??
      (options.dryRun || options.resolve
        ? null
        : db !== null
          ? new PostgresExternalArchiveStore(db)
          : null);
    if (!options.dryRun && store === null) {
      throw new Error("No hay base de datos para escribir el archivo externo");
    }

    const context: CaptureContext = {
      store,
      registry,
      github,
      wayback,
      images,
      dryRun: options.dryRun,
      resolve: options.resolve,
      capturedAt: (deps.now?.() ?? new Date()).toISOString(),
      env,
      err: writers.err,
      assets: report.assets,
    };

    for (const entry of selected.lessons) {
      const alias = aliasByFrom.get(entry.canonicalUrl);
      if (alias !== undefined) {
        const outcome = aliasOutcome(entry);
        report.outcomes.push(outcome);
        countOutcome(report.lessons, outcome);
        continue;
      }
      const outcome = await captureLesson(entry, context);
      report.outcomes.push(outcome);
      countOutcome(report.lessons, outcome);
    }

    for (const entry of selected.tools) {
      const outcome = await captureTool(entry, context);
      report.outcomes.push(outcome);
      countOutcome(report.tools, outcome);
    }

    // 4. Alias: el destino debe existir y quedar captured.
    const outcomes = outcomeIndex(report.outcomes);
    for (const alias of aliasPlan.applicable) {
      if (
        !selected.lessons.some((entry) => entry.canonicalUrl === alias.from)
      ) {
        continue;
      }
      const status = await targetStatus(alias.to, outcomes, store);
      if (status !== "captured") {
        throw new AliasValidationError(
          `aliases.json: el destino ${alias.to} no quedó captured (estado: ${status ?? "desconocido"}); no se registra el alias ${alias.from}`,
        );
      }
      if (options.dryRun || options.resolve) {
        report.aliases.planned += 1;
        continue;
      }
      if (store === null) {
        throw new Error("No hay store para escribir los alias");
      }
      await store.upsertItem(
        buildItemInput(
          alias.fromEntry,
          "alias",
          context.capturedAt,
          "user-alias",
          {
            aliasOfCanonicalUrl: alias.to,
            httpStatus: 404,
          },
        ),
      );
      report.aliases.applied += 1;
    }

    printReport(report, options, writers);
    return report.outcomes.some((outcome) => outcome.status === "error")
      ? 1
      : 0;
  } catch (error) {
    writers.err(`archive:external: ${describeError(error, env)}`);
    return 2;
  } finally {
    if (closeDb !== null) {
      await closeDb().catch(() => undefined);
    }
  }
}

function printReport(
  report: ExternalArchiveCliReport,
  options: ExternalArchiveCliOptions,
  writers: Writers,
): void {
  if (options.report === "json") {
    writers.out(JSON.stringify(report, null, 2));
    return;
  }
  writers.out(formatExternalArchiveTextReport(report));
}

// --- Arranque directo ---------------------------------------------------------

const entryPoint = process.argv[1];
const isDirectRun =
  entryPoint !== undefined &&
  path.resolve(entryPoint) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runExternalArchiveCli(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(`archive:external: ${describeError(error, process.env)}`);
      process.exitCode = 2;
    });
}
