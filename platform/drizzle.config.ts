import { defineConfig } from "drizzle-kit";

/**
 * Configuración de drizzle-kit para los esquemas SOURCE (M1) y
 * EXTERNAL_ARCHIVE (M2.5).
 *
 * - `db:generate` no necesita conexión: solo lee los `schema.ts` y escribe SQL
 *   versionado en `platform/drizzle/`. Los dos esquemas comparten una única
 *   secuencia de migraciones para que los tests PGlite y `db:migrate` apliquen
 *   exactamente el mismo histórico.
 * - `db:migrate` aplica esas migraciones a `DATABASE_URL` mediante el
 *   migrador programático de `src/source/store/migrate.ts`
 *   (`drizzle-orm/node-postgres/migrator`); por eso aquí no hay
 *   `dbCredentials`: la URL solo se lee en tiempo de migración, nunca se
 *   persiste en esta configuración.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/source/store/schema.ts", "./src/external-archive/schema.ts"],
  out: "./drizzle",
  strict: true,
  verbose: true,
});
