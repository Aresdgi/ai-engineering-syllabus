import { defineConfig } from "drizzle-kit";

/**
 * Configuración de drizzle-kit para el esquema SOURCE (M1).
 *
 * - `db:generate` no necesita conexión: solo lee `schema.ts` y escribe SQL
 *   versionado en `platform/drizzle/`.
 * - `db:migrate` aplica esas migraciones a `DATABASE_URL` mediante el
 *   migrador programático de `src/source/store/migrate.ts`
 *   (`drizzle-orm/node-postgres/migrator`); por eso aquí no hay
 *   `dbCredentials`: la URL solo se lee en tiempo de migración, nunca se
 *   persiste en esta configuración.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/source/store/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
