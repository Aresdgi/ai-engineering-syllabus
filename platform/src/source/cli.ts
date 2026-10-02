/**
 * CLI de ingesta (M1-W4): `pnpm --dir platform ingest [opciones]`.
 *
 * - Carga `.env.local` si existe (lo hace el script `ingest` de
 *   `platform/package.json` vía `tsx --env-file-if-exists=.env.local`).
 * - Modo real: `DATABASE_URL` (Postgres gestionado / Supabase) y escritura del
 *   snapshot. Sin `--dry-run`, este CLI es el único punto de escritura real.
 * - `--dry-run`: ingesta completa contra un PGlite en memoria con las
 *   migraciones aplicadas; no toca la base de datos real. PGlite se carga con
 *   `import()` dinámico solo en este camino (F-08): el modo real no necesita
 *   esa devDependency.
 * - `--json`: resumen estable para scripts; en texto, conteos y errores uno a
 *   uno. Nunca imprime `DATABASE_URL` ni `GITHUB_TOKEN`.
 *
 * Códigos de salida: 0 `complete` (o no-op), 1 `complete_with_errors`,
 * 2 `failed` o error de resolución/arranque.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { describeError, redactSecrets, type RedactEnv } from "../lib/redact";
import { createGithubSourceReader } from "./github/reader";
import { ingestSnapshot, type IngestSnapshotResult } from "./ingest/ingest";
import {
  INGEST_USAGE,
  parseIngestArgs,
  type IngestCliOptions,
} from "./ingest/options";
import {
  buildIngestJsonSummary,
  formatIngestHumanSummary,
} from "./ingest/summary";
import { PostgresSourceStore } from "./store/postgres-store";
import type { SourceSnapshotStatus, SourceStore } from "./types";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export type IngestCliEnv = RedactEnv;

export function exitCodeForStatus(status: SourceSnapshotStatus): number {
  if (status === "complete") {
    return 0;
  }
  if (status === "complete_with_errors") {
    return 1;
  }
  return 2;
}

async function createDryRunStore(): Promise<{
  store: SourceStore;
  close: () => Promise<void>;
}> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    store: new PostgresSourceStore(db),
    close: () => client.close(),
  };
}

async function createPostgresStore(databaseUrl: string): Promise<{
  store: SourceStore;
  close: () => Promise<void>;
}> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  return {
    store: new PostgresSourceStore(drizzleNodePostgres(pool)),
    close: () => pool.end(),
  };
}

function printSummary(
  result: IngestSnapshotResult,
  options: IngestCliOptions,
  env: IngestCliEnv,
): void {
  const line = options.json
    ? JSON.stringify(buildIngestJsonSummary(result, options.dryRun), null, 2)
    : formatIngestHumanSummary(result, options.dryRun);
  // Defensa en profundidad: los mensajes de `source_import_errors` llegan a la
  // fuente y podrían contener credenciales; nunca se imprimen en crudo.
  console.log(redactSecrets(line, env));
}

export async function runIngestCli(
  argv: readonly string[],
  env: IngestCliEnv = process.env,
): Promise<number> {
  const parsed = parseIngestArgs(argv);
  if (!parsed.ok) {
    console.error(`ingest: ${parsed.message}`);
    console.error(INGEST_USAGE);
    return 2;
  }
  const options = parsed.options;
  if (options.help) {
    console.log(INGEST_USAGE);
    return 0;
  }

  let closeStore: (() => Promise<void>) | null = null;
  try {
    const reader = createGithubSourceReader(
      options.repo !== null ? { repo: options.repo } : {},
      env,
    );

    let store: SourceStore;
    if (options.dryRun) {
      const dryRun = await createDryRunStore();
      store = dryRun.store;
      closeStore = dryRun.close;
    } else {
      const databaseUrl = env.DATABASE_URL?.trim();
      if (databaseUrl === undefined || databaseUrl === "") {
        console.error(
          "ingest: falta DATABASE_URL. Copia platform/.env.example a platform/.env.local y define la URI del Session pooler de Supabase; o usa --dry-run para no escribir en la base real.",
        );
        return 2;
      }
      const postgres = await createPostgresStore(databaseUrl);
      store = postgres.store;
      closeStore = postgres.close;
    }

    const result = await ingestSnapshot({
      reader,
      store,
      ...(options.repo !== null ? { repo: options.repo } : {}),
      ...(options.ref !== null ? { ref: options.ref } : {}),
      ...(options.commit !== null ? { commit: options.commit } : {}),
    });

    printSummary(result, options, env);
    return exitCodeForStatus(result.status);
  } catch (error) {
    console.error(`ingest: ${describeError(error, env)}`);
    return 2;
  } finally {
    if (closeStore !== null) {
      await closeStore().catch(() => undefined);
    }
  }
}

const entryPoint = process.argv[1];
const isDirectRun =
  entryPoint !== undefined &&
  path.resolve(entryPoint) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runIngestCli(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(`ingest: ${describeError(error, process.env)}`);
      process.exitCode = 2;
    });
}
