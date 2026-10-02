/**
 * Migrador programático del esquema SOURCE (M1).
 *
 * Se ejecuta con `pnpm --dir platform db:migrate`, que carga `.env.local`
 * (si existe) mediante `tsx --env-file-if-exists` y aplica las migraciones
 * versionadas de `platform/drizzle/` a `DATABASE_URL` con el migrador de
 * `drizzle-orm/node-postgres`.
 *
 * `DATABASE_URL` debe ser la URI del Session pooler de Supabase (conexión
 * Postgres directa como owner de las tablas; el owner bypassa RLS). No se
 * aplica ninguna migración remota desde tests: los tests usan PGlite.
 *
 * Los fallos se imprimen redactados (`describeError`): nunca se vuelca el error
 * crudo, porque sus propiedades (`input`, `cause`, stack) pueden contener la
 * contraseña de `DATABASE_URL`.
 */

import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { describeError } from "../../lib/redact";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "Falta DATABASE_URL. Copia platform/.env.example a platform/.env.local y define la URI del Session pooler de Supabase (requerida para db:migrate e ingest).",
    );
    return 2;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Migraciones aplicadas.");
    return 0;
  } finally {
    await pool.end();
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(describeError(error, process.env));
    process.exitCode = 1;
  });
