// @vitest-environment node
/**
 * Tests de integración de la ingesta (M1-W4) sin red ni nube:
 * `FixtureSourceReader` + `PostgresSourceStore` sobre PGlite con las
 * migraciones reales de `platform/drizzle/`.
 *
 * Los caminos de los fixtures se derivan en runtime del manifiesto
 * (`fixtures/source/manifest.json`), nunca de literales del catálogo (AC-0.10).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  computeGitBlobSha,
  type SourceFixtureManifest,
} from "../../test/source-fixtures";
import {
  fixtureAbsolutePath,
  loadFixtureManifest,
} from "../classify/fixture-tree.test-helper";
import {
  FixtureSourceReader,
  type FixtureFileOverride,
} from "../fixture-reader";
import { SourceReaderError } from "../github/errors";
import { PostgresSourceStore } from "../store/postgres-store";
import type { SourceSnapshotId } from "../types";
import { SourceIngestError } from "./errors";
import { ingestSnapshot } from "./ingest";

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

const COMMIT_B = "f".repeat(40);

const manifest: SourceFixtureManifest = loadFixtureManifest();

function findFixturePath(pattern: RegExp): string {
  const found = manifest.fixtures.find((fixture) => pattern.test(fixture.path));
  if (!found) {
    throw new Error(
      `El manifiesto de fixtures no contiene ningún path que cumpla ${String(pattern)}`,
    );
  }
  return found.path;
}

const PROJECT_README_ES = findFixturePath(
  /^content\/projects\/[^/]+\/README\.es\.md$/,
);
const PROJECT_DIR = PROJECT_README_ES.replace(/\/README\.es\.md$/, "");
const PROJECT_README = `${PROJECT_DIR}/README.md`;
const PROJECT_LEARN = `${PROJECT_DIR}/learn.json`;
const PROJECT_PNG = findFixturePath(
  /^content\/projects\/[^/]+\/\.learn\/preview\.png$/,
);
const SOLUTION_README = findFixturePath(
  /^content\/projects\/[^/]+\/\.learn\/solution\/README\.md$/,
);
const CONTEXT_ES = findFixturePath(
  /^content\/contexts\/[^/]+\/CONTEXT-[^/]+\.es\.md$/,
);
const CONTEXT_PAIR = CONTEXT_ES.replace(/\.es\.md$/, ".md");
const CONTEXT_EN_SUFFIX = findFixturePath(
  /^content\/contexts\/.+\/[^/]+\.en\.md$/,
);
const PDF = findFixturePath(/^content\/contexts\/.+\.pdf$/);
const LESSON_ES = findFixturePath(/^content\/lessons\/[^/]+\/[^/]+\.es\.md$/);
const LESSON_DIR = LESSON_ES.replace(/\/[^/]+\.es\.md$/, "");
const LESSON_PAIR = LESSON_ES.replace(/\.es\.md$/, ".md");

function firstLevelDirectory(path: string, root: string): string {
  return `${root}/${path.slice(root.length + 1).split("/")[0]}`;
}

const EXPECTED_PROJECT_DIRS = new Set([
  PROJECT_DIR,
  firstLevelDirectory(PROJECT_PNG, "content/projects"),
  firstLevelDirectory(SOLUTION_README, "content/projects"),
]);

const EXPECTED_CONTEXT_DIRS = new Set([
  firstLevelDirectory(CONTEXT_ES, "content/contexts"),
  firstLevelDirectory(CONTEXT_EN_SUFFIX, "content/contexts"),
  firstLevelDirectory(PDF, "content/contexts"),
]);

async function setupTestContext() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const store = new PostgresSourceStore(db);
  return { client, db, store };
}

type TestContext = Awaited<ReturnType<typeof setupTestContext>>;

type FileRow = {
  path: string;
  blob_sha: string;
  media_type: string;
  language: string | null;
  language_evidence: string | null;
  raw_content: string | null;
  binary_reference: string | null;
};

function fixtureBytes(path: string): Uint8Array {
  const fixture = manifest.fixtures.find((entry) => entry.path === path);
  if (!fixture) {
    throw new Error(`"${path}" no está en el manifiesto`);
  }
  return new Uint8Array(readFileSync(fixtureAbsolutePath(fixture)));
}

async function selectFileRows(
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

async function dumpTables(
  context: TestContext,
): Promise<Record<string, readonly unknown[]>> {
  const dump: Record<string, readonly unknown[]> = {};
  for (const table of TABLE_NAMES) {
    const result = await context.client.query(
      `select * from ${table} order by 1`,
    );
    dump[table] = result.rows;
  }
  return dump;
}

async function selectSnapshotStatus(
  context: TestContext,
  snapshotId: SourceSnapshotId,
): Promise<string | null> {
  const result = await context.client.query<{ status: string }>(
    "select status from source_snapshots where id = $1",
    [snapshotId],
  );
  return result.rows[0]?.status ?? null;
}

async function snapshotRows(
  context: TestContext,
  snapshotId: SourceSnapshotId,
): Promise<Record<string, readonly unknown[]>> {
  const result: Record<string, readonly unknown[]> = {};
  for (const table of [
    "source_files",
    "source_projects",
    "source_contexts",
    "source_lessons",
    "source_import_errors",
  ] as const) {
    result[table] = (
      await context.client.query(
        `select * from ${table} where snapshot_id = $1 order by 1`,
        [snapshotId],
      )
    ).rows;
  }
  result.source_snapshots = (
    await context.client.query("select * from source_snapshots where id = $1", [
      snapshotId,
    ])
  ).rows;
  return result;
}

describe("ingestSnapshot sobre PGlite con los fixtures reales", () => {
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

  it("importa los 11 fixtures verbatim, clasifica idioma/media y construye índices mínimos (AC-1.1..AC-1.10)", async () => {
    const result = await ingestSnapshot({
      reader: new FixtureSourceReader(),
      store: context.store,
      repo: manifest.repository,
    });

    expect(result.status).toBe("complete");
    expect(result.noop).toBe(false);
    expect(result.ref).toBe("main");
    expect(result.commitSha).toBe(manifest.fixtures[0]?.commit);
    expect(result.errors).toEqual([]);
    expect(result.counts).toEqual({
      files: {
        total: 11,
        text: 9,
        binary: 2,
        byRoot: { projects: 5, contexts: 4, lessons: 2 },
      },
      indexes: { projects: 3, contexts: 3, lessons: 1 },
      errors: 0,
    });
    expect(await selectSnapshotStatus(context, result.snapshot.id)).toBe(
      "complete",
    );

    const rows = await selectFileRows(context, result.snapshot.id);
    expect(rows).toHaveLength(11);
    const byPath = new Map(rows.map((row) => [row.path, row]));

    for (const fixture of manifest.fixtures) {
      const row = byPath.get(fixture.path);
      expect(row, `falta la fila de ${fixture.path}`).toBeDefined();
      expect(row?.blob_sha).toBe(fixture.blob_sha);

      const bytes = fixtureBytes(fixture.path);
      if (row?.raw_content === null) {
        expect(row.binary_reference).toBe(
          `https://raw.githubusercontent.com/${manifest.repository}/${fixture.commit}/${fixture.path}`,
        );
      } else {
        expect(row?.binary_reference).toBeNull();
        expect(
          Buffer.from(row?.raw_content ?? "", "utf8").equals(bytes),
          `raw_content no es byte-idéntico en ${fixture.path}`,
        ).toBe(true);
      }
    }

    const expectedLanguage = new Map<string, string>([
      [PROJECT_README_ES, "es/suffix"],
      [PROJECT_README, "en/pair-convention"],
      [PROJECT_LEARN, "null/null"],
      [PROJECT_PNG, "null/null"],
      [SOLUTION_README, "null/null"],
      [CONTEXT_ES, "es/suffix"],
      [CONTEXT_PAIR, "en/pair-convention"],
      [CONTEXT_EN_SUFFIX, "en/suffix"],
      [PDF, "null/null"],
      [LESSON_ES, "es/suffix"],
      [LESSON_PAIR, "en/pair-convention"],
    ]);
    for (const [path, expected] of expectedLanguage) {
      const row = byPath.get(path);
      expect(
        `${row?.language}/${row?.language_evidence}`,
        `idioma inesperado en ${path}`,
      ).toBe(expected);
    }

    const expectedMedia = new Map<string, string>([
      [PROJECT_README_ES, "text/markdown"],
      [PROJECT_README, "text/markdown"],
      [PROJECT_LEARN, "application/json"],
      [PROJECT_PNG, "image/png"],
      [SOLUTION_README, "text/markdown"],
      [CONTEXT_ES, "text/markdown"],
      [CONTEXT_PAIR, "text/markdown"],
      [CONTEXT_EN_SUFFIX, "text/markdown"],
      [PDF, "application/pdf"],
      [LESSON_ES, "text/markdown"],
      [LESSON_PAIR, "text/markdown"],
    ]);
    for (const [path, expected] of expectedMedia) {
      expect(byPath.get(path)?.media_type, `media_type en ${path}`).toBe(
        expected,
      );
    }

    const projects = await context.client.query<{
      source_path: string;
      title: string | null;
      canonical_order: number | null;
      preferred_readme_path: string | null;
      language: string | null;
      language_evidence: string | null;
    }>(
      `select source_path, title, canonical_order, preferred_readme_path, language, language_evidence
       from source_projects where snapshot_id = $1 order by source_path`,
      [result.snapshot.id],
    );
    expect(new Set(projects.rows.map((row) => row.source_path))).toEqual(
      EXPECTED_PROJECT_DIRS,
    );
    expect(
      projects.rows.every(
        (row) => row.title === null && row.canonical_order === null,
      ),
    ).toBe(true);
    const project = projects.rows.find(
      (row) => row.source_path === PROJECT_DIR,
    );
    expect(project?.preferred_readme_path).toBe(PROJECT_README_ES);
    expect(project?.language).toBe("es");
    expect(project?.language_evidence).toBe("suffix");

    const contexts = await context.client.query<{
      source_path: string;
      title: string | null;
      preferred_readme_path: string | null;
    }>(
      `select source_path, title, preferred_readme_path from source_contexts
       where snapshot_id = $1 order by source_path`,
      [result.snapshot.id],
    );
    expect(new Set(contexts.rows.map((row) => row.source_path))).toEqual(
      EXPECTED_CONTEXT_DIRS,
    );
    expect(contexts.rows.every((row) => row.title === null)).toBe(true);
    const preferredContext = contexts.rows.find(
      (row) => row.preferred_readme_path === CONTEXT_ES,
    );
    expect(preferredContext).toBeDefined();

    const lessons = await context.client.query<{
      source_path: string;
      title: string | null;
      preferred_readme_path: string | null;
    }>(
      `select source_path, title, preferred_readme_path from source_lessons
       where snapshot_id = $1 order by source_path`,
      [result.snapshot.id],
    );
    expect(lessons.rows).toHaveLength(1);
    expect(lessons.rows[0]).toMatchObject({
      source_path: LESSON_DIR,
      title: null,
      preferred_readme_path: LESSON_ES,
    });
  });

  it("la segunda ingesta del mismo commit es un no-op con el mismo snapshot y sin cambios en la base (AC-1.11)", async () => {
    const reader = new FixtureSourceReader();
    const first = await ingestSnapshot({ reader, store: context.store });
    const before = await dumpTables(context);

    const second = await ingestSnapshot({ reader, store: context.store });

    expect(second.noop).toBe(true);
    expect(second.snapshot.id).toBe(first.snapshot.id);
    expect(second.status).toBe("complete");
    expect(second.counts).toBeNull();
    expect(second.errors).toEqual([]);
    expect(await countRows(context, "source_snapshots")).toBe(1);
    expect(await countRows(context, "source_files")).toBe(11);
    expect(await dumpTables(context)).toEqual(before);
  });

  it("un commit distinto crea otro snapshot sin tocar el anterior (AC-1.11)", async () => {
    const first = await ingestSnapshot({
      reader: new FixtureSourceReader(),
      store: context.store,
    });
    const rowsBefore = await snapshotRows(context, first.snapshot.id);

    const second = await ingestSnapshot({
      reader: new FixtureSourceReader({ commitSha: COMMIT_B }),
      store: context.store,
    });

    expect(second.snapshot.id).not.toBe(first.snapshot.id);
    expect(second.commitSha).toBe(COMMIT_B);
    expect(second.status).toBe("complete");
    expect(second.counts?.files.total).toBe(11);
    expect(await countRows(context, "source_snapshots")).toBe(2);

    expect(await snapshotRows(context, first.snapshot.id)).toEqual(rowsBefore);
  });

  it("AC-1.13: registra fallos por archivo, termina complete_with_errors y no crea contenido sustituto", async () => {
    const mismatchPath = PROJECT_README;
    const readErrorPath = PROJECT_LEARN;
    const decodeErrorPath = CONTEXT_PAIR;
    const invalidBytes = new Uint8Array([0xff, 0xfe, 0x80, 0x81]);
    const fileOverrides = new Map<string, FixtureFileOverride>([
      [
        readErrorPath,
        {
          error: new SourceReaderError({
            kind: "file-read-failed",
            message: "fallo de lectura inyectado",
          }),
        },
      ],
      [
        decodeErrorPath,
        { bytes: invalidBytes, treeBlobSha: computeGitBlobSha(invalidBytes) },
      ],
    ]);

    const reader = new FixtureSourceReader({
      fileOverrides,
      transformTree: (tree) => ({
        ...tree,
        entries: tree.entries.map((entry) =>
          entry.type === "blob" && entry.path === mismatchPath
            ? { ...entry, blobSha: "0".repeat(40) }
            : entry,
        ),
      }),
    });

    const result = await ingestSnapshot({ reader, store: context.store });

    expect(result.status).toBe("complete_with_errors");
    expect(result.counts?.errors).toBe(3);
    expect(result.counts?.files.total).toBe(8);
    expect(result.counts?.indexes).toEqual({
      projects: 3,
      contexts: 3,
      lessons: 1,
    });

    const errorKeys = result.errors
      .map((error) => `${error.errorKind}:${error.sourcePath}`)
      .sort();
    expect(errorKeys).toEqual(
      [
        `file-decode-failed:${decodeErrorPath}`,
        `file-hash-mismatch:${mismatchPath}`,
        `file-read-failed:${readErrorPath}`,
      ].sort(),
    );

    const rows = await selectFileRows(context, result.snapshot.id);
    expect(rows).toHaveLength(8);
    const importedPaths = new Set(rows.map((row) => row.path));
    for (const failedPath of [mismatchPath, readErrorPath, decodeErrorPath]) {
      expect(importedPaths.has(failedPath)).toBe(false);
    }

    const storedErrors = await context.client.query<{
      source_path: string | null;
      error_kind: string;
    }>(
      `select source_path, error_kind from source_import_errors
       where snapshot_id = $1 order by error_kind, source_path`,
      [result.snapshot.id],
    );
    expect(storedErrors.rows).toHaveLength(3);
    expect(storedErrors.rows.map((row) => row.error_kind).sort()).toEqual(
      ["file-decode-failed", "file-hash-mismatch", "file-read-failed"].sort(),
    );
    expect(await selectSnapshotStatus(context, result.snapshot.id)).toBe(
      "complete_with_errors",
    );
  });

  it("un árbol truncado termina en failed con error registrado y sin archivos", async () => {
    const reader = new FixtureSourceReader({
      transformTree: (tree) => ({ ...tree, truncated: true }),
    });

    const result = await ingestSnapshot({ reader, store: context.store });

    expect(result.status).toBe("failed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      errorKind: "tree-truncated",
      sourcePath: null,
    });
    expect(result.noop).toBe(false);
    expect(await countRows(context, "source_files")).toBe(0);
    expect(await selectSnapshotStatus(context, result.snapshot.id)).toBe(
      "failed",
    );
    expect(await countRows(context, "source_import_errors")).toBe(1);
  });

  it("un fallo global al leer el árbol termina en failed", async () => {
    const reader = new FixtureSourceReader({
      treeError: new SourceReaderError({
        kind: "tree-read-failed",
        message: "fallo de red inyectado al leer el árbol",
      }),
    });

    const result = await ingestSnapshot({ reader, store: context.store });

    expect(result.status).toBe("failed");
    expect(result.errors[0]?.errorKind).toBe("tree-read-failed");
    expect(await selectSnapshotStatus(context, result.snapshot.id)).toBe(
      "failed",
    );
  });

  it("un repo pedido distinto del servido por el reader falla sin crear snapshot (AC-1.1)", async () => {
    await expect(
      ingestSnapshot({
        reader: new FixtureSourceReader(),
        store: context.store,
        repo: "otra-org/otro-repo",
      }),
    ).rejects.toBeInstanceOf(SourceIngestError);

    expect(await countRows(context, "source_snapshots")).toBe(0);
    expect(await countRows(context, "source_files")).toBe(0);
  });

  it("usa el reloj inyectado para startedAt, finishedAt y duración", async () => {
    const times = [
      new Date("2026-10-02T10:00:00.000Z"),
      new Date("2026-10-02T10:00:01.500Z"),
    ];
    let index = 0;

    const result = await ingestSnapshot({
      reader: new FixtureSourceReader(),
      store: context.store,
      now: () => times[Math.min(index++, times.length - 1)] ?? times[0]!,
    });

    expect(result.startedAt).toBe("2026-10-02T10:00:00.000Z");
    expect(result.finishedAt).toBe("2026-10-02T10:00:01.500Z");
    expect(result.durationMs).toBe(1500);
  });
});
