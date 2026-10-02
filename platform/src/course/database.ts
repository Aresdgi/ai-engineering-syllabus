/**
 * Conexión perezosa del Hito 2 a la base SOURCE (misma DATABASE_URL que M1).
 *
 * - El import de este módulo NUNCA conecta: el pool se crea en la primera
 *   llamada a `getCourseDb()`, así `next build` funciona sin `DATABASE_URL`.
 * - El pool se reutiliza en `globalThis` para sobrevivir al HMR de desarrollo.
 * - `max` pequeño: la UI solo hace lecturas cortas y la ingesta ya tiene su
 *   propio cliente.
 * - Este módulo y todo `course/` son server-only (nunca llegan al cliente).
 */

import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { describeError } from "../lib/redact";

const GLOBAL_POOL_KEY = "__courseLazyPgPool" as const;

type CourseGlobalState = typeof globalThis & {
  [GLOBAL_POOL_KEY]?: {
    pool: Pool;
    db: NodePgDatabase<Record<string, never>>;
  };
};

/** `DATABASE_URL` normalizada; `null` si no hay configuración. */
export function getCourseDatabaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value === undefined || value === "" ? null : value;
}

/**
 * Devuelve el cliente Drizzle del curso o `null` sin `DATABASE_URL`.
 * La primera llamada crea el pool; las siguientes lo reutilizan.
 */
export function getCourseDb(): NodePgDatabase<Record<string, never>> | null {
  const url = getCourseDatabaseUrl();
  if (url === null) {
    return null;
  }
  const globalState = globalThis as CourseGlobalState;
  const existing = globalState[GLOBAL_POOL_KEY];
  if (existing) {
    return existing.db;
  }
  const pool = new Pool({ connectionString: url, max: 3 });
  pool.on("error", (error) => {
    console.error(
      `[course] error de conexión PostgreSQL: ${describeError(error, process.env)}`,
    );
  });
  const db = drizzle(pool);
  globalState[GLOBAL_POOL_KEY] = { pool, db };
  return db;
}
