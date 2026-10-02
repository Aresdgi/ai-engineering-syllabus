// @vitest-environment node
/**
 * Tests del backfill de `source_blobs` (M2, ADR-018) sin red ni nube:
 * `PostgresSourceStore` sobre PGlite con las migraciones reales y
 * `FixtureSourceReader` para los 2 binarios del manifiesto (ADR-009). Los
 * paths se derivan del manifiesto en runtime, nunca de literales del catálogo
 * (AC-0.10).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  FIXTURES_SOURCE_ROOT,
  fixtureAbsolutePath,
  loadFixtureManifest,
} from "./classify/fixture-tree.test-helper";
import { classifySourceMedia } from "./classify/media";
import {
  backfillSourceBlobs,
  buildBlobBackfillHumanSummary,
  createDirectoryBytesFetcher,
  exitCodeForBackfill,
  parseBlobBackfillArgs,
} from "./blobs-backfill";
import { FixtureSourceReader } from "./fixture-reader";
import { ingestSnapshot } from "./ingest/ingest";
import { PostgresSourceStore } from "./store/postgres-store";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

const TABLE_NAMES = [
  "source_blobs",
  "source_contexts",
  "source_files",
  "source_import_errors",
  "source_lessons",
  "source_projects",
  "source_repositories",
  "source_snapshots",
] as const;

const TRUNCATE_ALL = `truncate table ${TABLE_NAMES.join(", ")} restart identity cascade`;

const manifest = loadFixtureManifest();
const COMMIT = manifest.fixtures[0]?.commit ?? "";

const BINARY_FIXTURES = manifest.fixtures.filter(
  (fixture) =>
    classifySourceMedia(
      fixture.path,
      new Uint8Array(readFileSync(fixtureAbsolutePath(fixture))),
    ).isBinary,
);

const UNIQUE_BINARY_SHAS = [
  ...new Set(BINARY_FIXTURES.map((fixture) => fixture.blob_sha)),
];

async function setupTestContext() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const store = new PostgresSourceStore(db);
  return { client, db, store };
}

type TestContext = Awaited<ReturnType<typeof setupTestContext>>;

/** Importa los fixtures reales y borra `source_blobs` para simular un snapshot de M1. */
async function seedSnapshotWithoutBlobs(context: TestContext): Promise<void> {
  const result = await ingestSnapshot({
    reader: new FixtureSourceReader(),
    store: context.store,
    repo: manifest.repository,
  });
  expect(result.status).toBe("complete");
  await context.client.exec("truncate table source_blobs");
}

async function countBlobs(context: TestContext): Promise<number> {
  const result = await context.client.query<{ count: number }>(
    "select count(*)::int as count from source_blobs",
  );
  return result.rows[0]?.count ?? -1;
}

function fixtureBytesByBlobSha(): Map<string, Uint8Array> {
  const bySha = new Map<string, Uint8Array>();
  for (const fixture of BINARY_FIXTURES) {
    bySha.set(
      fixture.blob_sha,
      new Uint8Array(readFileSync(fixtureAbsolutePath(fixture))),
    );
  }
  return bySha;
}

const FIXTURE_READER = new FixtureSourceReader();

function fixtureFetcher(): (
  file: { path: string; blobSha: string },
  snapshot: { commitSha: string },
) => Promise<Uint8Array> {
  return (file, snapshot) =>
    FIXTURE_READER.readFile(snapshot.commitSha, file.path);
}

describe("backfillSourceBlobs sobre PGlite con los binarios reales", () => {
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

  it("dry-run lee y verifica los binarios pendientes sin escribir en la base", async () => {
    await seedSnapshotWithoutBlobs(context);

    const result = await backfillSourceBlobs({
      store: context.store,
      dryRun: true,
      fetchBytes: fixtureFetcher(),
    });

    expect(result.dryRun).toBe(true);
    expect(result.repository).toBe(manifest.repository);
    expect(result.commitSha).toBe(COMMIT);
    expect(result.binaryFiles).toBe(BINARY_FIXTURES.length);
    expect(result.uniqueBlobs).toBe(UNIQUE_BINARY_SHAS.length);
    expect(result.alreadyPresent).toBe(0);
    expect(result.pending).toBe(UNIQUE_BINARY_SHAS.length);
    expect(result.verified).toBe(UNIQUE_BINARY_SHAS.length);
    expect(result.inserted).toBe(0);
    expect(result.failures).toEqual([]);
    expect(await countBlobs(context)).toBe(0);
  });

  it("inserta los bytes fieles, verifica sha/byte_size y la segunda ejecución es idempotente", async () => {
    await seedSnapshotWithoutBlobs(context);

    const first = await backfillSourceBlobs({
      store: context.store,
      fetchBytes: fixtureFetcher(),
    });

    expect(first.failures).toEqual([]);
    expect(first.inserted).toBe(UNIQUE_BINARY_SHAS.length);
    expect(await countBlobs(context)).toBe(UNIQUE_BINARY_SHAS.length);

    const bytesBySha = fixtureBytesByBlobSha();
    const rows = await context.client.query<{
      blob_sha: string;
      byte_size: number;
      bytes: Uint8Array;
    }>("select blob_sha, byte_size, bytes from source_blobs order by blob_sha");
    expect(rows.rows.map((row) => row.blob_sha)).toEqual(
      [...UNIQUE_BINARY_SHAS].sort(),
    );
    for (const row of rows.rows) {
      const expected = bytesBySha.get(row.blob_sha);
      expect(row.byte_size).toBe(expected?.byteLength);
      expect(Buffer.from(row.bytes).equals(Buffer.from(expected ?? []))).toBe(
        true,
      );
    }

    const second = await backfillSourceBlobs({
      store: context.store,
      fetchBytes: fixtureFetcher(),
    });

    expect(second.inserted).toBe(0);
    expect(second.alreadyPresent).toBe(UNIQUE_BINARY_SHAS.length);
    expect(second.pending).toBe(0);
    expect(second.verified).toBe(0);
    expect(second.failures).toEqual([]);
    expect(await countBlobs(context)).toBe(UNIQUE_BINARY_SHAS.length);
  });

  it("--from-dir lee los bytes de un checkout local y verifica el blob_sha", async () => {
    await seedSnapshotWithoutBlobs(context);
    const checkoutRoot = path.join(FIXTURES_SOURCE_ROOT, COMMIT);

    const result = await backfillSourceBlobs({
      store: context.store,
      fetchBytes: createDirectoryBytesFetcher(checkoutRoot),
    });

    expect(result.failures).toEqual([]);
    expect(result.inserted).toBe(UNIQUE_BINARY_SHAS.length);
    expect(await countBlobs(context)).toBe(UNIQUE_BINARY_SHAS.length);
  });

  it("un blob con bytes que no reproducen su sha no se inserta y se reporta", async () => {
    await seedSnapshotWithoutBlobs(context);
    const tampered = BINARY_FIXTURES[0];
    if (!tampered) {
      throw new Error("el manifiesto no tiene binarios");
    }
    const fakeSha = "1".repeat(40);
    await context.client.query(
      "update source_files set blob_sha = $1 where path = $2",
      [fakeSha, tampered.path],
    );

    const result = await backfillSourceBlobs({
      store: context.store,
      fetchBytes: fixtureFetcher(),
    });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      kind: "hash-mismatch",
      path: tampered.path,
      blobSha: fakeSha,
    });
    expect(result.inserted).toBe(UNIQUE_BINARY_SHAS.length - 1);
    expect(await countBlobs(context)).toBe(UNIQUE_BINARY_SHAS.length - 1);
  });

  it("un archivo que no se puede leer se reporta como read-failed sin abortar el resto", async () => {
    await seedSnapshotWithoutBlobs(context);
    const tampered = BINARY_FIXTURES[0];
    if (!tampered) {
      throw new Error("el manifiesto no tiene binarios");
    }
    await context.client.query(
      "update source_files set path = $1, blob_sha = $2 where path = $3",
      ["content/projects/synthetic-missing.bin", "2".repeat(40), tampered.path],
    );

    const result = await backfillSourceBlobs({
      store: context.store,
      fetchBytes: fixtureFetcher(),
    });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.kind).toBe("read-failed");
    expect(result.inserted).toBe(UNIQUE_BINARY_SHAS.length - 1);
  });

  it("sin snapshot activo no hace nada y no falla", async () => {
    const result = await backfillSourceBlobs({
      store: context.store,
      fetchBytes: fixtureFetcher(),
    });

    expect(result.snapshotId).toBeNull();
    expect(result.inserted).toBe(0);
    expect(result.failures).toEqual([]);
    expect(await countBlobs(context)).toBe(0);
  });

  it("el resumen humano y los códigos de salida reflejan el resultado", async () => {
    await seedSnapshotWithoutBlobs(context);
    const result = await backfillSourceBlobs({
      store: context.store,
      dryRun: true,
      fetchBytes: fixtureFetcher(),
    });

    expect(exitCodeForBackfill(result)).toBe(0);
    const summary = buildBlobBackfillHumanSummary(result);
    expect(summary).toContain("blobs:backfill (dry-run)");
    expect(summary).toContain(`insertados=${result.inserted}`);
    expect(
      exitCodeForBackfill({
        ...result,
        failures: [
          result.failures[0] ?? {
            path: "x",
            blobSha: "y",
            kind: "read-failed",
            message: "z",
          },
        ],
      }),
    ).toBe(1);
  });
});

describe("parseBlobBackfillArgs", () => {
  it("acepta --dry-run, --from-dir y --repo con valor separado o con =", () => {
    const joined = parseBlobBackfillArgs([
      "--dry-run",
      "--from-dir",
      "..",
      "--repo=owner/name",
    ]);
    expect(joined).toEqual({
      ok: true,
      options: {
        dryRun: true,
        fromDir: "..",
        repo: "owner/name",
        help: false,
      },
    });

    const separated = parseBlobBackfillArgs([
      "--from-dir=../content",
      "--repo",
      "owner/name",
    ]);
    expect(separated).toEqual({
      ok: true,
      options: {
        dryRun: false,
        fromDir: "../content",
        repo: "owner/name",
        help: false,
      },
    });
  });

  it("rechaza opciones desconocidas y valores ausentes", () => {
    const unknown = parseBlobBackfillArgs(["--nope"]);
    expect(unknown.ok).toBe(false);

    const missing = parseBlobBackfillArgs(["--from-dir"]);
    expect(missing.ok).toBe(false);

    const flagAsValue = parseBlobBackfillArgs(["--from-dir", "--dry-run"]);
    expect(flagAsValue.ok).toBe(false);
  });
});
