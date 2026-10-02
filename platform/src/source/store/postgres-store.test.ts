// @vitest-environment node
/**
 * Tests de integración del store PostgreSQL contra PGlite (Postgres en WASM),
 * aplicando las migraciones reales de `platform/drizzle/`. No hay nube, red
 * ni DATABASE_URL: el mismo esquema que se aplicará a Supabase se ejecuta
 * aquí.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";

import type {
  NewSourceContext,
  NewSourceFile,
  NewSourceImportError,
  NewSourceLesson,
  NewSourceProject,
  SourceLanguage,
  SourceLanguageAssignment,
  SourceLanguageEvidence,
  SourceSnapshotId,
} from "../types";
import { PostgresSourceStore } from "./postgres-store";
import {
  sourceFiles,
  sourceImportErrors,
  sourceProjects,
  sourceSnapshots,
} from "./schema";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

const TABLE_NAMES = [
  "source_contexts",
  "source_files",
  "source_import_errors",
  "source_lessons",
  "source_projects",
  "source_repositories",
  "source_snapshots",
] as const;

const TRUNCATE_ALL = `truncate table ${TABLE_NAMES.join(", ")} restart identity cascade`;

const TEST_REPOSITORY = {
  owner: "example-org",
  name: "example-syllabus",
  canonicalUrl: "https://github.com/example-org/example-syllabus",
  defaultBranch: "main",
} as const;

const COMMIT_A = "a".repeat(40);
const COMMIT_B = "b".repeat(40);
const BLOB_A = "c".repeat(40);
const BLOB_B = "d".repeat(40);

const PROJECT_README = "content/projects/sample-project/README.md";
const PROJECT_README_ES = "content/projects/sample-project/README.es.md";
const PROJECT_BINARY = "content/projects/sample-project/preview.png";

async function setupTestContext() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const store = new PostgresSourceStore(db);
  return { client, db, store };
}

type TestContext = Awaited<ReturnType<typeof setupTestContext>>;

/** Construye una asignación válida del contrato a partir del par pedido. */
function languageAssignment(
  language: SourceLanguage,
  languageEvidence: SourceLanguageEvidence,
): SourceLanguageAssignment {
  if (language === null && languageEvidence === null) {
    return { language: null, languageEvidence: null };
  }
  if (language === "es" && languageEvidence === "suffix") {
    return { language, languageEvidence };
  }
  if (language === "en" && languageEvidence === "suffix") {
    return { language, languageEvidence };
  }
  if (language === "en" && languageEvidence === "pair-convention") {
    return { language, languageEvidence };
  }
  throw new Error(
    `Combinación de idioma no contemplada: ${language}/${languageEvidence}`,
  );
}

function textFile(
  snapshotId: SourceSnapshotId,
  path: string,
  options: {
    blobSha?: string;
    rawContent?: string;
    language?: SourceLanguage;
    languageEvidence?: SourceLanguageEvidence;
  } = {},
): NewSourceFile {
  return {
    snapshotId,
    path,
    blobSha: options.blobSha ?? BLOB_A,
    mediaType: "text/markdown",
    ...languageAssignment(
      options.language ?? null,
      options.languageEvidence ?? null,
    ),
    rawContent: options.rawContent ?? "# Contenido de prueba\n",
    binaryReference: null,
  };
}

function binaryFile(
  snapshotId: SourceSnapshotId,
  path: string,
  blobSha = BLOB_B,
): NewSourceFile {
  return {
    snapshotId,
    path,
    blobSha,
    mediaType: "image/png",
    language: null,
    languageEvidence: null,
    rawContent: null,
    binaryReference: `https://raw.githubusercontent.com/example-org/example-syllabus/${COMMIT_A}/${path}`,
  };
}

async function createRepositorySnapshot(
  context: TestContext,
  commitSha: string,
  ref = "main",
) {
  const repositoryId = await context.store.upsertRepository(TEST_REPOSITORY);
  return context.store.createSnapshot({ repositoryId, ref, commitSha });
}

type FileRow = {
  path: string;
  blob_sha: string;
  media_type: string;
  language: string | null;
  language_evidence: string | null;
  raw_content: string | null;
  binary_reference: string | null;
};

async function selectFiles(
  context: TestContext,
  snapshotId: SourceSnapshotId,
): Promise<FileRow[]> {
  const result = await context.client.query<FileRow>(
    `select path, blob_sha, media_type, language, language_evidence, raw_content, binary_reference
     from source_files where snapshot_id = $1 order by path`,
    [snapshotId],
  );
  return result.rows;
}

async function countRows(
  context: TestContext,
  table: (typeof TABLE_NAMES)[number],
): Promise<number> {
  const result = await context.client.query<{ count: number }>(
    `select count(*)::int as count from ${table}`,
  );
  return result.rows[0]?.count ?? -1;
}

/**
 * Drizzle envuelve los errores de Postgres en `DrizzleQueryError` ("Failed
 * query: ...") y deja el mensaje real del constraint en la cadena de
 * `cause`; este helper busca el patrón en toda la cadena.
 */
async function expectDbFailure(
  operation: PromiseLike<unknown>,
  pattern: RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught, "se esperaba un error de base de datos").toBeInstanceOf(Error);

  const messages: string[] = [];
  let current: unknown = caught;
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }
  expect(messages.join("\n")).toMatch(pattern);
}

describe("PostgresSourceStore sobre PGlite con las migraciones reales", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  afterAll(async () => {
    await context.client.close();
  });

  beforeEach(async () => {
    await context.client.exec(TRUNCATE_ALL);
  });

  it("aplica las migraciones y crea las 7 tablas del modelo M1", async () => {
    const result = await context.client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual(TABLE_NAMES);
  });

  it("habilita RLS en todas las tablas y no define ninguna política", async () => {
    const tables = await context.client.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'
       order by relname`,
    );

    expect(tables.rows).toHaveLength(TABLE_NAMES.length);
    for (const row of tables.rows) {
      expect(row.relrowsecurity, `RLS deshabilitado en ${row.relname}`).toBe(
        true,
      );
    }

    const policies = await context.client.query<{ count: number }>(
      `select count(*)::int as count from pg_policies where schemaname = 'public'`,
    );
    expect(policies.rows[0]?.count).toBe(0);
  });

  it("upsertRepository es idempotente por owner+name y refresca metadatos", async () => {
    const first = await context.store.upsertRepository(TEST_REPOSITORY);
    const second = await context.store.upsertRepository({
      ...TEST_REPOSITORY,
      canonicalUrl: `${TEST_REPOSITORY.canonicalUrl}/`,
    });

    expect(second).toBe(first);
    expect(await countRows(context, "source_repositories")).toBe(1);

    const stored = await context.client.query<{ canonical_url: string }>(
      "select canonical_url from source_repositories where id = $1",
      [first],
    );
    expect(stored.rows[0]?.canonical_url).toBe(
      `${TEST_REPOSITORY.canonicalUrl}/`,
    );
  });

  it("createSnapshot registra el commit y findSnapshotByCommit lo recupera", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);

    expect(snapshot.commitSha).toBe(COMMIT_A);
    expect(snapshot.ref).toBe("main");
    expect(snapshot.status).toBe("importing");
    expect(snapshot.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const found = await context.store.findSnapshotByCommit(
      snapshot.repositoryId,
      COMMIT_A,
    );
    expect(found).toEqual(snapshot);

    expect(
      await context.store.findSnapshotByCommit(snapshot.repositoryId, COMMIT_B),
    ).toBeNull();
  });

  it("createSnapshot del mismo commit es un no-op que no toca el snapshot ni su estado", async () => {
    const first = await createRepositorySnapshot(context, COMMIT_A);
    await context.store.setSnapshotStatus(first.id, "complete");

    const again = await context.store.createSnapshot({
      repositoryId: first.repositoryId,
      ref: "refs/heads/otra",
      commitSha: COMMIT_A,
    });

    expect(again.id).toBe(first.id);
    expect(again.status).toBe("complete");
    expect(again.ref).toBe("main");
    expect(await countRows(context, "source_snapshots")).toBe(1);
  });

  it("upsertFiles inserta texto y binario por lotes respetando el contrato", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);

    await context.store.upsertFiles([
      textFile(snapshot.id, PROJECT_README_ES, {
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshot.id, PROJECT_README, {
        language: "en",
        languageEvidence: "pair-convention",
      }),
      binaryFile(snapshot.id, PROJECT_BINARY),
    ]);

    const rows = await selectFiles(context, snapshot.id);
    expect(rows).toHaveLength(3);

    const readmeEs = rows.find((row) => row.path === PROJECT_README_ES);
    expect(readmeEs).toMatchObject({
      language: "es",
      language_evidence: "suffix",
      binary_reference: null,
    });
    expect(readmeEs?.raw_content).toBe("# Contenido de prueba\n");

    const binary = rows.find((row) => row.path === PROJECT_BINARY);
    expect(binary).toMatchObject({
      language: null,
      language_evidence: null,
      raw_content: null,
    });
    expect(binary?.binary_reference).toContain(`${COMMIT_A}/${PROJECT_BINARY}`);
  });

  it("doble upsert del mismo lote mantiene conteos y contenido (idempotencia)", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);
    const files = [
      textFile(snapshot.id, PROJECT_README),
      binaryFile(snapshot.id, PROJECT_BINARY),
    ];

    await context.store.upsertFiles(files);
    const firstRead = await selectFiles(context, snapshot.id);

    await context.store.upsertFiles(files);
    const secondRead = await selectFiles(context, snapshot.id);

    expect(await countRows(context, "source_files")).toBe(2);
    expect(secondRead).toEqual(firstRead);
  });

  it("UNIQUE(snapshot_id, path) rechaza duplicados directos", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);
    await context.store.upsertFiles([textFile(snapshot.id, PROJECT_README)]);

    await expectDbFailure(
      context.db.insert(sourceFiles).values({
        snapshotId: snapshot.id,
        path: PROJECT_README,
        blobSha: BLOB_B,
        mediaType: "text/markdown",
        rawContent: "# otro\n",
        binaryReference: null,
      }),
      /source_files_snapshot_path_unique/,
    );
  });

  it("CHECK de contenido exige exactamente uno de raw_content/binary_reference", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);

    await expectDbFailure(
      context.db.insert(sourceFiles).values({
        snapshotId: snapshot.id,
        path: "content/projects/sample-project/vacio.md",
        blobSha: BLOB_A,
        mediaType: "text/markdown",
        rawContent: null,
        binaryReference: null,
      }),
      /source_files_content_exactly_one/,
    );

    await expectDbFailure(
      context.db.insert(sourceFiles).values({
        snapshotId: snapshot.id,
        path: "content/projects/sample-project/ambos.md",
        blobSha: BLOB_A,
        mediaType: "text/markdown",
        rawContent: "# texto\n",
        binaryReference: "https://example.com/binario",
      }),
      /source_files_content_exactly_one/,
    );
  });

  it("CHECK de idioma solo admite es+suffix, en+suffix, en+pair-convention o null+null", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);

    await context.store.upsertFiles([
      textFile(snapshot.id, PROJECT_README_ES, {
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshot.id, PROJECT_README, {
        language: "en",
        languageEvidence: "pair-convention",
      }),
      textFile(snapshot.id, "content/projects/sample-project/README.en.md", {
        language: "en",
        languageEvidence: "suffix",
      }),
      textFile(snapshot.id, "content/projects/sample-project/notes.md"),
    ]);
    expect(await countRows(context, "source_files")).toBe(4);

    const invalidCombinations: ReadonlyArray<{
      language: string | null;
      languageEvidence: string | null;
    }> = [
      { language: "es", languageEvidence: null },
      { language: null, languageEvidence: "suffix" },
      { language: "es", languageEvidence: "pair-convention" },
      { language: "fr", languageEvidence: "suffix" },
    ];

    for (const [index, combination] of invalidCombinations.entries()) {
      await expectDbFailure(
        context.db.insert(sourceFiles).values({
          snapshotId: snapshot.id,
          path: `content/projects/sample-project/invalido-${index}.md`,
          blobSha: BLOB_A,
          mediaType: "text/markdown",
          rawContent: "# x\n",
          binaryReference: null,
          ...combination,
        }),
        /language_evidence_allowed/,
      );
    }
  });

  it("CHECK de estado de snapshot rechaza estados fuera de los cuatro válidos", async () => {
    const repositoryId = await context.store.upsertRepository(TEST_REPOSITORY);

    await expectDbFailure(
      context.db.insert(sourceSnapshots).values({
        repositoryId,
        ref: "main",
        commitSha: COMMIT_B,
        status: "done",
      }),
      /source_snapshots_status_allowed/,
    );
  });

  it("un commit nuevo crea otro snapshot sin tocar el anterior", async () => {
    const snapshotA = await createRepositorySnapshot(context, COMMIT_A);
    await context.store.upsertFiles([
      textFile(snapshotA.id, PROJECT_README, { rawContent: "# A\n" }),
    ]);
    await context.store.insertImportErrors([
      {
        snapshotId: snapshotA.id,
        sourcePath: PROJECT_BINARY,
        errorKind: "file-read-failed",
        message: "no se pudo leer el binario",
        detail: { attempt: 1 },
      },
    ]);
    await context.store.setSnapshotStatus(snapshotA.id, "complete_with_errors");

    const filesBefore = await selectFiles(context, snapshotA.id);
    const errorsBefore = await context.client.query(
      "select * from source_import_errors where snapshot_id = $1",
      [snapshotA.id],
    );

    const snapshotB = await createRepositorySnapshot(context, COMMIT_B);
    await context.store.upsertFiles([
      textFile(snapshotB.id, PROJECT_README, {
        blobSha: BLOB_B,
        rawContent: "# B\n",
      }),
    ]);
    await context.store.setSnapshotStatus(snapshotB.id, "complete");

    expect(snapshotB.id).not.toBe(snapshotA.id);
    expect(await countRows(context, "source_snapshots")).toBe(2);

    expect(await selectFiles(context, snapshotA.id)).toEqual(filesBefore);
    expect(
      await context.client.query(
        "select * from source_import_errors where snapshot_id = $1",
        [snapshotA.id],
      ),
    ).toEqual(errorsBefore);

    const foundA = await context.store.findSnapshotByCommit(
      snapshotA.repositoryId,
      COMMIT_A,
    );
    expect(foundA).toMatchObject({
      id: snapshotA.id,
      status: "complete_with_errors",
    });

    const filesB = await selectFiles(context, snapshotB.id);
    expect(filesB).toHaveLength(1);
    expect(filesB[0]?.raw_content).toBe("# B\n");
  });

  it("persiste errores de importación con path, tipo, mensaje y detalle jsonb", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);
    const errors: NewSourceImportError[] = [
      {
        snapshotId: snapshot.id,
        sourcePath: PROJECT_README,
        errorKind: "file-hash-mismatch",
        message: "hash local distinto del árbol",
        detail: { expected: BLOB_A, actual: BLOB_B },
      },
      {
        snapshotId: snapshot.id,
        sourcePath: null,
        errorKind: "tree-truncated",
        message: "árbol truncado",
        detail: null,
      },
    ];

    await context.store.insertImportErrors(errors);

    const rows = await context.client.query<{
      source_path: string | null;
      error_kind: string;
      message: string;
      detail: unknown;
      created_at: string;
    }>(
      `select source_path, error_kind, message, detail, created_at::text as created_at
       from source_import_errors where snapshot_id = $1 order by error_kind`,
      [snapshot.id],
    );

    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toMatchObject({
      source_path: PROJECT_README,
      error_kind: "file-hash-mismatch",
      message: "hash local distinto del árbol",
      detail: { expected: BLOB_A, actual: BLOB_B },
    });
    expect(rows.rows[1]).toMatchObject({
      source_path: null,
      error_kind: "tree-truncated",
      detail: null,
    });
    expect(rows.rows[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} /);

    await expectDbFailure(
      context.db.insert(sourceImportErrors).values({
        snapshotId: snapshot.id,
        sourcePath: null,
        errorKind: "invented-kind",
        message: "no permitido",
        detail: null,
      }),
      /source_import_errors_kind_allowed/,
    );
  });

  it("las FK usan ON DELETE RESTRICT: no se borra un snapshot con archivos o errores", async () => {
    const withFiles = await createRepositorySnapshot(context, COMMIT_A);
    await context.store.upsertFiles([textFile(withFiles.id, PROJECT_README)]);

    await expect(
      context.client.exec(
        `delete from source_snapshots where id = '${withFiles.id}'`,
      ),
    ).rejects.toThrow(/foreign key|violates/i);

    const withErrors = await createRepositorySnapshot(context, COMMIT_B);
    await context.store.insertImportErrors([
      {
        snapshotId: withErrors.id,
        sourcePath: null,
        errorKind: "unexpected-error",
        message: "fallo inesperado",
        detail: null,
      },
    ]);

    await expect(
      context.client.exec(
        `delete from source_snapshots where id = '${withErrors.id}'`,
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("setSnapshotStatus solo cambia el estado y falla si el snapshot no existe", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);
    await context.store.upsertFiles([textFile(snapshot.id, PROJECT_README)]);

    const before = (
      await context.client.query<Record<string, unknown>>(
        "select * from source_snapshots where id = $1",
        [snapshot.id],
      )
    ).rows[0];
    expect(before?.status).toBe("importing");

    await context.store.setSnapshotStatus(snapshot.id, "complete_with_errors");

    const after = (
      await context.client.query<Record<string, unknown>>(
        "select * from source_snapshots where id = $1",
        [snapshot.id],
      )
    ).rows[0];
    expect(after).toEqual({ ...before, status: "complete_with_errors" });
    expect(await countRows(context, "source_files")).toBe(1);

    await expect(
      context.store.setSnapshotStatus(
        "11111111-1111-1111-1111-111111111111",
        "complete",
      ),
    ).rejects.toThrow(/No existe el snapshot/);
  });

  it("upsertProjects, upsertContexts y upsertLessons respetan unique; title null y canonical_order solo en proyectos (H2)", async () => {
    const snapshot = await createRepositorySnapshot(context, COMMIT_A);

    const project: NewSourceProject = {
      snapshotId: snapshot.id,
      sourcePath: "content/projects/sample-project",
      title: null,
      canonicalOrder: null,
      preferredReadmePath: PROJECT_README_ES,
      language: "es",
      languageEvidence: "suffix",
      metadata: { readmeCount: 2, hasLearnJson: true },
    };
    const contextEntry: NewSourceContext = {
      snapshotId: snapshot.id,
      sourcePath: "content/contexts/sample-context",
      title: null,
      preferredReadmePath:
        "content/contexts/sample-context/CONTEXT-sample-topic.md",
      language: null,
      languageEvidence: null,
      metadata: { contextFiles: 1 },
    };
    const lesson: NewSourceLesson = {
      snapshotId: snapshot.id,
      sourcePath: "content/lessons/sample-lesson",
      title: null,
      preferredReadmePath: "content/lessons/sample-lesson/sample-lesson.es.md",
      language: "es",
      languageEvidence: "suffix",
      metadata: { documents: 2 },
    };

    await context.store.upsertProjects([project]);
    await context.store.upsertContexts([contextEntry]);
    await context.store.upsertLessons([lesson]);
    await context.store.upsertProjects([project]);
    await context.store.upsertContexts([contextEntry]);
    await context.store.upsertLessons([lesson]);

    expect(await countRows(context, "source_projects")).toBe(1);
    expect(await countRows(context, "source_contexts")).toBe(1);
    expect(await countRows(context, "source_lessons")).toBe(1);

    const storedProjects = await context.client.query<{
      source_path: string;
      canonical_order: number | null;
      title: string | null;
      preferred_readme_path: string | null;
      language: string | null;
      language_evidence: string | null;
      metadata: unknown;
    }>("select * from source_projects where snapshot_id = $1", [snapshot.id]);
    expect(storedProjects.rows[0]).toMatchObject({
      source_path: "content/projects/sample-project",
      canonical_order: null,
      title: null,
      preferred_readme_path: PROJECT_README_ES,
      language: "es",
      language_evidence: "suffix",
      metadata: { readmeCount: 2, hasLearnJson: true },
    });

    await expectDbFailure(
      context.db.insert(sourceProjects).values({
        snapshotId: snapshot.id,
        sourcePath: "content/projects/sample-project",
        metadata: {},
      }),
      /source_projects_snapshot_source_path_unique/,
    );
  });

  it("el store acepta una base node-postgres (comprobación de tipos)", () => {
    const createStoreForNodePostgres = (database: NodePgDatabase) =>
      new PostgresSourceStore(database);

    expectTypeOf(createStoreForNodePostgres).toBeFunction();
  });
});
