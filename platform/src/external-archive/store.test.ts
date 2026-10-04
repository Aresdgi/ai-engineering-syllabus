// @vitest-environment node
/**
 * Tests de integración de la capa EXTERNAL_ARCHIVE contra PGlite (Postgres en
 * WASM), aplicando las migraciones reales de `platform/drizzle/` (misma
 * carpeta que usa `db:migrate` y el helper de `course/`). Sin nube, sin red y
 * sin `DATABASE_URL`.
 *
 * Cubren el contrato de W0 (plan §6.2): la migración 0002 aplica, el RLS está
 * activo, `upsertItem` es idempotente, los assets deduplican por sha256, los
 * alias respetan su FK lógica y los checks rechazan valores inválidos; además,
 * las tablas SOURCE no se tocan.
 *
 * Los datos de estos tests son valores neutros de laboratorio (URLs de
 * `example.com` y cuerpos de texto genéricos), no contenido educativo real:
 * el store solo se prueba como capa de persistencia.
 */

import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  sourceFiles,
  sourceRepositories,
  sourceSnapshots,
} from "../source/store/schema";
import { externalArchiveItems } from "./schema";
import { PostgresExternalArchiveStore } from "./store";
import type { NewExternalArchiveItem } from "./types";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

const CAPTURED_AT = "2026-10-02T10:00:00.000Z";
const CAPTURED_AT_LATER = "2026-10-02T11:30:00.000Z";

const LESSON_URL = "https://example.com/lesson/fixture-lesson";
const LESSON_ES_URL = "https://example.com/es/lesson/fixture-lesson";
const RETIRED_URL = "https://example.com/lesson/retired-fixture";
const TOOL_URL = "https://example.com/tool/fixture-tool";
const IMAGE_URL = "https://example.com/images/fixture-image.png";
const OTHER_IMAGE_URL = "https://example.com/images/other-image.png";

const SHA_CONTENT_A = "1".repeat(64);
const SHA_CONTENT_B = "2".repeat(64);
const SHA_ASSET_A = "a".repeat(64);
const SHA_ASSET_B = "b".repeat(64);

const LESSON_CONTENT = "# Fixture lesson\n\nLiteral persistence body.\n";

async function setupTestContext() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const store = new PostgresExternalArchiveStore(db);
  return { client, db, store };
}

type TestContext = Awaited<ReturnType<typeof setupTestContext>>;

let context: TestContext;

beforeEach(async () => {
  context = await setupTestContext();
});

afterEach(async () => {
  await context.client.close();
});

function lessonItem(
  overrides: Partial<NewExternalArchiveItem> = {},
): NewExternalArchiveItem {
  return {
    originalUrl: "https://example.com/lesson/fixture-lesson",
    canonicalUrl: LESSON_URL,
    kind: "lesson",
    host: "example.com",
    language: "en",
    title: "Fixture lesson",
    content: LESSON_CONTENT,
    contentSha256: SHA_CONTENT_A,
    contentFormat: "markdown",
    sourceRepository: "example-org/example-content",
    sourceCommit: "c".repeat(40),
    sourcePath: "content/fixture-lesson.md",
    capturedAt: CAPTURED_AT,
    method: "registry-api+github-raw",
    httpStatus: 200,
    waybackUrl: null,
    waybackCapturedAt: null,
    waybackHttpStatus: null,
    status: "captured",
    lastError: null,
    aliasOfCanonicalUrl: null,
    ...overrides,
  };
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("migración 0002 y RLS", () => {
  it("crea las 3 tablas de EXTERNAL_ARCHIVE con RLS habilitado y sin tocar SOURCE", async () => {
    const tables = await context.db.execute(sql`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public' and tablename like 'external_archive%'
      order by tablename
    `);

    expect(tables.rows).toEqual([
      { tablename: "external_archive_assets", rowsecurity: true },
      { tablename: "external_archive_item_assets", rowsecurity: true },
      { tablename: "external_archive_items", rowsecurity: true },
    ]);

    const sourceTables = await context.db.execute(sql`
      select count(*)::int as total
      from pg_tables
      where schemaname = 'public' and tablename like 'source_%'
    `);
    expect(sourceTables.rows[0]?.total).toBe(8);
  });

  it("crea los índices declarados por kind, status, host y language", async () => {
    const indexes = await context.db.execute(sql`
      select indexname
      from pg_indexes
      where schemaname = 'public' and tablename = 'external_archive_items'
      order by indexname
    `);
    const names = indexes.rows.map((row) => row.indexname);

    expect(names).toEqual(
      expect.arrayContaining([
        "external_archive_items_canonical_url_unique",
        "external_archive_items_host_idx",
        "external_archive_items_kind_idx",
        "external_archive_items_language_idx",
        "external_archive_items_status_idx",
      ]),
    );
  });
});

describe("upsertItem idempotente", () => {
  it("inserta, no escribe si nada cambia y actualiza cuando cambia el hash", async () => {
    const first = await context.store.upsertItem(lessonItem());
    expect(first).toBe("inserted");

    const inserted = await context.store.getItemByCanonicalUrl(LESSON_URL);
    expect(inserted).not.toBeNull();
    expect(inserted?.capturedAt).toBe(CAPTURED_AT);
    expect(inserted?.content).toBe(LESSON_CONTENT);
    expect(inserted?.contentSha256).toBe(SHA_CONTENT_A);

    const unchanged = await context.store.upsertItem(
      lessonItem({ capturedAt: CAPTURED_AT_LATER }),
    );
    expect(unchanged).toBe("unchanged");

    const afterUnchanged =
      await context.store.getItemByCanonicalUrl(LESSON_URL);
    expect(afterUnchanged?.capturedAt).toBe(CAPTURED_AT);
    expect(afterUnchanged?.updatedAt).toBe(inserted?.updatedAt);

    const updated = await context.store.upsertItem(
      lessonItem({
        content: "# Fixture lesson v2\n",
        contentSha256: SHA_CONTENT_B,
        capturedAt: CAPTURED_AT_LATER,
      }),
    );
    expect(updated).toBe("updated");

    const afterUpdate = await context.store.getItemByCanonicalUrl(LESSON_URL);
    expect(afterUpdate?.contentSha256).toBe(SHA_CONTENT_B);
    expect(afterUpdate?.content).toBe("# Fixture lesson v2\n");
    expect(afterUpdate?.capturedAt).toBe(CAPTURED_AT_LATER);
  });

  it("actualiza cuando cambian status, alias o metadatos Wayback", async () => {
    await context.store.upsertItem(lessonItem());

    await expect(
      context.store.upsertItem(lessonItem({ status: "unavailable" })),
    ).resolves.toBe("updated");

    await expect(
      context.store.upsertItem(
        lessonItem({
          status: "unavailable",
          waybackUrl: "https://web.archive.org/web/20260101000000/example",
          waybackCapturedAt: CAPTURED_AT_LATER,
          waybackHttpStatus: 200,
        }),
      ),
    ).resolves.toBe("updated");

    await expect(
      context.store.upsertItem(
        lessonItem({
          status: "unavailable",
          waybackUrl: "https://web.archive.org/web/20260101000000/example",
          waybackCapturedAt: CAPTURED_AT_LATER,
          waybackHttpStatus: 200,
        }),
      ),
    ).resolves.toBe("unchanged");

    await expect(
      context.store.upsertItem(
        lessonItem({
          status: "alias",
          aliasOfCanonicalUrl: LESSON_ES_URL,
        }),
      ),
    ).resolves.toBe("updated");

    const aliasRow = await context.store.getItemByCanonicalUrl(LESSON_URL);
    expect(aliasRow?.status).toBe("alias");
    expect(aliasRow?.aliasOfCanonicalUrl).toBe(LESSON_ES_URL);
  });

  it("rechaza combinaciones status/alias incoherentes antes de tocar la base", async () => {
    await expect(
      context.store.upsertItem(
        lessonItem({ status: "alias", aliasOfCanonicalUrl: null }),
      ),
    ).rejects.toThrow(/alias_of_canonical_url/);

    await expect(
      context.store.upsertItem(
        lessonItem({ status: "captured", aliasOfCanonicalUrl: LESSON_ES_URL }),
      ),
    ).rejects.toThrow(/alias_of_canonical_url/);
  });

  it("ordena listItems por canonical_url y devuelve null si no existe", async () => {
    await context.store.upsertItem(lessonItem());
    await context.store.upsertItem(
      lessonItem({
        originalUrl: TOOL_URL,
        canonicalUrl: TOOL_URL,
        kind: "tool",
        language: null,
        title: null,
        content: null,
        contentSha256: null,
        contentFormat: null,
        sourceRepository: null,
        sourceCommit: null,
        sourcePath: null,
        method: "wayback-metadata",
        status: "unavailable",
      }),
    );

    const items = await context.store.listItems();
    expect(items.map((item) => item.canonicalUrl)).toEqual([
      LESSON_URL,
      TOOL_URL,
    ]);

    await expect(
      context.store.getItemByCanonicalUrl("https://example.com/missing"),
    ).resolves.toBeNull();
    await expect(context.store.getAsset("f".repeat(64))).resolves.toBeNull();
  });
});

describe("alias con FK lógica", () => {
  it("un alias apunta a la fila destino y no duplica su contenido", async () => {
    await context.store.upsertItem(
      lessonItem({
        originalUrl: LESSON_ES_URL,
        canonicalUrl: LESSON_ES_URL,
        language: "es",
      }),
    );
    await context.store.upsertItem(
      lessonItem({
        originalUrl: RETIRED_URL,
        canonicalUrl: RETIRED_URL,
        title: null,
        content: null,
        contentSha256: null,
        contentFormat: null,
        sourceRepository: null,
        sourceCommit: null,
        sourcePath: null,
        method: "user-alias",
        status: "alias",
        aliasOfCanonicalUrl: LESSON_ES_URL,
      }),
    );

    const alias = await context.store.getItemByCanonicalUrl(RETIRED_URL);
    expect(alias?.status).toBe("alias");
    expect(alias?.aliasOfCanonicalUrl).toBe(LESSON_ES_URL);

    const target = await context.store.getItemByCanonicalUrl(
      alias!.aliasOfCanonicalUrl!,
    );
    expect(target?.status).toBe("captured");
    expect(target?.content).toBe(LESSON_CONTENT);
  });
});

describe("upsertAsset direccionado por contenido", () => {
  it("inserta una vez y no reescribe bytes de un sha256 existente", async () => {
    const asset = {
      sha256: SHA_ASSET_A,
      bytes: encode("fixture-image-bytes"),
      contentType: "image/png",
      byteSize: encode("fixture-image-bytes").byteLength,
      sourceUrl: IMAGE_URL,
      capturedAt: CAPTURED_AT,
    };

    await expect(context.store.upsertAsset(asset)).resolves.toBe("inserted");
    await expect(
      context.store.upsertAsset({
        ...asset,
        bytes: encode("other-bytes"),
        byteSize: encode("other-bytes").byteLength,
        contentType: "image/jpeg",
        sourceUrl: OTHER_IMAGE_URL,
      }),
    ).resolves.toBe("unchanged");

    const stored = await context.store.getAsset(SHA_ASSET_A);
    expect(stored?.contentType).toBe("image/png");
    expect(stored?.sourceUrl).toBe(IMAGE_URL);
    expect(Buffer.from(stored!.bytes).toString("utf8")).toBe(
      "fixture-image-bytes",
    );
  });

  it("rechaza un byte_size incoherente", async () => {
    await expect(
      context.store.upsertAsset({
        sha256: SHA_ASSET_A,
        bytes: encode("fixture-image-bytes"),
        contentType: "image/png",
        byteSize: 1,
        sourceUrl: IMAGE_URL,
        capturedAt: CAPTURED_AT,
      }),
    ).rejects.toThrow(/byte_size/);
  });
});

describe("linkItemAsset", () => {
  async function seedItemAndAssets(): Promise<{
    itemId: string;
    otherSha: string;
  }> {
    await context.store.upsertItem(lessonItem());
    const item = await context.store.getItemByCanonicalUrl(LESSON_URL);
    await context.store.upsertAsset({
      sha256: SHA_ASSET_A,
      bytes: encode("fixture-image-bytes"),
      contentType: "image/png",
      byteSize: encode("fixture-image-bytes").byteLength,
      sourceUrl: IMAGE_URL,
      capturedAt: CAPTURED_AT,
    });
    await context.store.upsertAsset({
      sha256: SHA_ASSET_B,
      bytes: encode("other-image-bytes"),
      contentType: "image/png",
      byteSize: encode("other-image-bytes").byteLength,
      sourceUrl: OTHER_IMAGE_URL,
      capturedAt: CAPTURED_AT,
    });
    return { itemId: item!.id, otherSha: SHA_ASSET_B };
  }

  it("enlaza, es idempotente y actualiza si cambia el sha o el alt", async () => {
    const { itemId, otherSha } = await seedItemAndAssets();

    await expect(
      context.store.linkItemAsset({
        itemId,
        assetSha256: SHA_ASSET_A,
        originalUrl: IMAGE_URL,
        alt: "Fixture image",
      }),
    ).resolves.toBe("inserted");

    await expect(
      context.store.linkItemAsset({
        itemId,
        assetSha256: SHA_ASSET_A,
        originalUrl: IMAGE_URL,
        alt: "Fixture image",
      }),
    ).resolves.toBe("unchanged");

    await expect(
      context.store.linkItemAsset({
        itemId,
        assetSha256: otherSha,
        originalUrl: IMAGE_URL,
        alt: "Fixture image",
      }),
    ).resolves.toBe("updated");

    const links = await context.store.listItemAssets(itemId);
    expect(links).toEqual([
      {
        itemId,
        assetSha256: otherSha,
        originalUrl: IMAGE_URL,
        alt: "Fixture image",
      },
    ]);
  });

  it("falla si el item o el asset no existen (FK real)", async () => {
    const { itemId } = await seedItemAndAssets();

    await expect(
      context.store.linkItemAsset({
        itemId: "00000000-0000-4000-8000-000000000000",
        assetSha256: SHA_ASSET_A,
        originalUrl: IMAGE_URL,
      }),
    ).rejects.toThrow();

    await expect(
      context.store.linkItemAsset({
        itemId,
        assetSha256: "f".repeat(64),
        originalUrl: IMAGE_URL,
      }),
    ).rejects.toThrow();
  });

  it("borra los enlaces en cascada al borrar el item", async () => {
    const { itemId } = await seedItemAndAssets();
    await context.store.linkItemAsset({
      itemId,
      assetSha256: SHA_ASSET_A,
      originalUrl: IMAGE_URL,
    });

    await context.db
      .delete(externalArchiveItems)
      .where(eq(externalArchiveItems.id, itemId));

    await expect(context.store.listItemAssets(itemId)).resolves.toEqual([]);
    await expect(context.store.getAsset(SHA_ASSET_A)).resolves.not.toBeNull();
  });
});

describe("checks del esquema", () => {
  it.each([
    ["kind", { kind: "marketing" }],
    ["status", { status: "retired" }],
    ["method", { method: "invented-method" }],
    ["content_format", { contentFormat: "html" }],
    ["language", { language: "fr" }],
  ])("rechaza un valor inválido de %s", async (_field, override) => {
    const row = lessonItem(override as Partial<NewExternalArchiveItem>);
    await expect(
      context.db.insert(externalArchiveItems).values({
        originalUrl: row.originalUrl,
        canonicalUrl: row.canonicalUrl,
        kind: row.kind,
        host: row.host,
        language: row.language ?? null,
        title: row.title ?? null,
        content: row.content ?? null,
        contentSha256: row.contentSha256 ?? null,
        contentFormat: row.contentFormat ?? null,
        sourceRepository: row.sourceRepository ?? null,
        sourceCommit: row.sourceCommit ?? null,
        sourcePath: row.sourcePath ?? null,
        capturedAt: new Date(row.capturedAt),
        method: row.method,
        httpStatus: row.httpStatus ?? null,
        waybackUrl: row.waybackUrl ?? null,
        waybackCapturedAt: null,
        waybackHttpStatus: row.waybackHttpStatus ?? null,
        status: row.status,
        lastError: row.lastError ?? null,
        aliasOfCanonicalUrl: row.aliasOfCanonicalUrl ?? null,
      }),
    ).rejects.toThrow();
  });

  it.each([
    ["alias sin destino", { status: "alias", aliasOfCanonicalUrl: null }],
    [
      "no-alias con destino",
      { status: "captured", aliasOfCanonicalUrl: LESSON_ES_URL },
    ],
  ])("rechaza %s", async (_case, override) => {
    const row = lessonItem(override as Partial<NewExternalArchiveItem>);
    await expect(
      context.db.insert(externalArchiveItems).values({
        originalUrl: row.originalUrl,
        canonicalUrl: row.canonicalUrl,
        kind: row.kind,
        host: row.host,
        capturedAt: new Date(row.capturedAt),
        method: row.method,
        status: row.status,
        aliasOfCanonicalUrl: row.aliasOfCanonicalUrl ?? null,
      }),
    ).rejects.toThrow();
  });
});

describe("aislamiento de SOURCE", () => {
  it("no altera source_files ni source_snapshots al escribir el archivo", async () => {
    const [repository] = await context.db
      .insert(sourceRepositories)
      .values({
        owner: "example-org",
        name: "example-syllabus",
        canonicalUrl: "https://example.com/example-syllabus",
        defaultBranch: "main",
      })
      .returning({ id: sourceRepositories.id });
    const [snapshot] = await context.db
      .insert(sourceSnapshots)
      .values({
        repositoryId: repository!.id,
        ref: "main",
        commitSha: "d".repeat(40),
        status: "complete",
      })
      .returning({ id: sourceSnapshots.id });
    await context.db.insert(sourceFiles).values({
      snapshotId: snapshot!.id,
      path: "content/projects/example/README.md",
      blobSha: "e".repeat(40),
      mediaType: "text/markdown",
      rawContent: "LOCAL-ONLY",
      binaryReference: null,
    });

    const count = async (): Promise<{ files: number; snapshots: number }> => {
      const result = await context.db.execute(sql`
        select
          (select count(*)::int from source_files) as files,
          (select count(*)::int from source_snapshots) as snapshots
      `);
      return result.rows[0] as { files: number; snapshots: number };
    };

    const before = await count();

    await context.store.upsertItem(lessonItem());
    await context.store.upsertAsset({
      sha256: SHA_ASSET_A,
      bytes: encode("fixture-image-bytes"),
      contentType: "image/png",
      byteSize: encode("fixture-image-bytes").byteLength,
      sourceUrl: IMAGE_URL,
      capturedAt: CAPTURED_AT,
    });
    const item = await context.store.getItemByCanonicalUrl(LESSON_URL);
    await context.store.linkItemAsset({
      itemId: item!.id,
      assetSha256: SHA_ASSET_A,
      originalUrl: IMAGE_URL,
    });

    const after = await count();
    expect(after).toEqual(before);
    expect(before).toEqual({ files: 1, snapshots: 1 });

    const archiveCount = await context.db.execute(sql`
      select
        (select count(*)::int from external_archive_items) as items,
        (select count(*)::int from external_archive_assets) as assets,
        (select count(*)::int from external_archive_item_assets) as links
    `);
    expect(archiveCount.rows[0]).toEqual({ items: 1, assets: 1, links: 1 });
  });
});
