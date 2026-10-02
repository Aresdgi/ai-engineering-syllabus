/**
 * Parseo no interactivo de los argumentos de `pnpm ingest` (M1-W4).
 *
 * Sin dependencias: un parser puro y testeable. Las mismas opciones valen para
 * el modo real y para `--dry-run`.
 */

import { SOURCE_DEFAULT_REPOSITORY } from "../types";

export const INGEST_USAGE = [
  "Uso: pnpm --dir platform ingest [opciones]",
  "",
  "Opciones:",
  `  --repo <owner/name>  Repositorio fuente (por defecto ${SOURCE_DEFAULT_REPOSITORY})`,
  "  --ref <branch>       Rama/ref a resolver (por defecto la default branch del repo)",
  "  --commit <sha>       Commit exacto a importar (tiene prioridad sobre --ref)",
  "  --dry-run            Ingesta completa contra un PGlite en memoria; no escribe en la base real",
  "  --json               Emite el resumen como JSON",
  "  -h, --help           Muestra esta ayuda",
].join("\n");

export type IngestCliOptions = Readonly<{
  repo: string | null;
  ref: string | null;
  commit: string | null;
  dryRun: boolean;
  json: boolean;
  help: boolean;
}>;

export type IngestCliParseResult =
  | Readonly<{ ok: true; options: IngestCliOptions }>
  | Readonly<{ ok: false; message: string }>;

const VALUE_FLAGS = new Set(["--repo", "--ref", "--commit"]);

function defaultOptions(): {
  repo: string | null;
  ref: string | null;
  commit: string | null;
  dryRun: boolean;
  json: boolean;
  help: boolean;
} {
  return {
    repo: null,
    ref: null,
    commit: null,
    dryRun: false,
    json: false,
    help: false,
  };
}

export function parseIngestArgs(argv: readonly string[]): IngestCliParseResult {
  const options = defaultOptions();

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
    if (arg === "--json") {
      options.json = true;
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

    if (name === "--repo") {
      options.repo = value;
    } else if (name === "--ref") {
      options.ref = value;
    } else {
      options.commit = value;
    }
  }

  return { ok: true, options };
}
