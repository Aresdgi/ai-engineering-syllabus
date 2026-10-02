// @vitest-environment node
/**
 * Utilidades solo-para-tests de la capa `course/`: PGlite con las migraciones
 * reales de `platform/drizzle/` (mismo patrón que el store de M1) y semillas
 * neutras. Ningún test conecta a Supabase ni escribe en la base real.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import type { PgliteDatabase } from "drizzle-orm/pglite";

import {
  sourceFiles,
  sourceImportErrors,
  sourceRepositories,
  sourceSnapshots,
} from "../source/store/schema";
import type { SourceLanguage, SourceLanguageEvidence } from "../source/types";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export const TEST_COMMIT = "a".repeat(40);

export const TEST_REPOSITORY = {
  owner: "example-org",
  name: "example-syllabus",
  canonicalUrl: "https://github.com/example-org/example-syllabus",
  defaultBranch: "main",
} as const;

export async function createCourseTestDatabase(options?: {
  /** Observa el SQL enviado a PGlite (para asserts de consultas). */
  onQuery?: (sql: string) => void;
}): Promise<{
  client: PGlite;
  db: PgliteDatabase<Record<string, never>>;
}> {
  const client = new PGlite();
  if (options?.onQuery) {
    const onQuery = options.onQuery;
    const originalQuery = client.query.bind(client);
    client.query = ((
      query: unknown,
      params?: unknown,
      queryOptions?: unknown,
    ) => {
      onQuery(typeof query === "string" ? query : String(query));
      return originalQuery(
        query as never,
        params as never,
        queryOptions as never,
      );
    }) as typeof client.query;
  }
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { client, db };
}

type TestDatabase = PgliteDatabase<Record<string, never>>;

export async function seedRepository(db: TestDatabase): Promise<string> {
  const [row] = await db
    .insert(sourceRepositories)
    .values(TEST_REPOSITORY)
    .returning({ id: sourceRepositories.id });
  return row!.id;
}

export async function seedSnapshot(
  db: TestDatabase,
  repositoryId: string,
  options: {
    commitSha?: string;
    status: "importing" | "complete" | "complete_with_errors" | "failed";
    importedAt: Date;
    ref?: string;
  },
): Promise<string> {
  const [row] = await db
    .insert(sourceSnapshots)
    .values({
      repositoryId,
      ref: options.ref ?? "main",
      commitSha: options.commitSha ?? TEST_COMMIT,
      status: options.status,
      importedAt: options.importedAt,
    })
    .returning({ id: sourceSnapshots.id });
  return row!.id;
}

function languageAssignment(
  language: SourceLanguage,
  languageEvidence: SourceLanguageEvidence,
): { language: SourceLanguage; languageEvidence: SourceLanguageEvidence } {
  return { language, languageEvidence };
}

export function textFile(
  snapshotId: string,
  path: string,
  options: {
    rawContent?: string;
    blobSha?: string;
    mediaType?: string;
    language?: SourceLanguage;
    languageEvidence?: SourceLanguageEvidence;
  } = {},
): typeof sourceFiles.$inferInsert {
  return {
    snapshotId,
    path,
    blobSha: options.blobSha ?? "c".repeat(40),
    mediaType: options.mediaType ?? "text/markdown",
    ...languageAssignment(
      options.language ?? null,
      options.languageEvidence ?? null,
    ),
    rawContent: options.rawContent ?? "# Contenido de prueba\n",
    binaryReference: null,
  };
}

export function binaryFile(
  snapshotId: string,
  path: string,
  options: {
    blobSha?: string;
    mediaType?: string;
    binaryReference?: string;
  } = {},
): typeof sourceFiles.$inferInsert {
  return {
    snapshotId,
    path,
    blobSha: options.blobSha ?? "d".repeat(40),
    mediaType: options.mediaType ?? "image/png",
    language: null,
    languageEvidence: null,
    rawContent: null,
    binaryReference:
      options.binaryReference ??
      `https://raw.githubusercontent.com/example-org/example-syllabus/${TEST_COMMIT}/${path}`,
  };
}

export async function seedImportErrors(
  db: TestDatabase,
  snapshotId: string,
  count: number,
): Promise<void> {
  if (count === 0) {
    return;
  }
  await db.insert(sourceImportErrors).values(
    Array.from({ length: count }, (_, index) => ({
      snapshotId,
      sourcePath: null,
      errorKind: "unexpected-error" as const,
      message: `error sintético ${index + 1}`,
      detail: null,
    })),
  );
}
