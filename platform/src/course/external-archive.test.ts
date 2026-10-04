// @vitest-environment node
/**
 * Tests de la lectura de EXTERNAL_ARCHIVE en la capa `course/` (Hito 2.5,
 * plan §6.3 + §8) con PGlite y las migraciones reales de `platform/drizzle/`.
 *
 * Cubren: variante de idioma ES/EN por procedencia literal, alias de lección
 * retirada → destino, degradación sin base (`[]`/`null`), resolución de
 * imágenes a `/archive-assets/<sha256>`, 0 llamadas a `fetch` (AC-2.5.8) y la
 * memoización por request del índice de archivo (T-01).
 * Los datos son valores neutros de laboratorio; el contenido educativo real
 * solo vive en la base capturada por el CLI.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostgresExternalArchiveStore } from "../external-archive/store";
import type { NewExternalArchiveItem } from "../external-archive/types";
import { sourceFiles } from "../source/store/schema";
import {
  createExternalArchiveIndex,
  createExternalArchiveReader,
  getArchivedItemByCanonicalUrl,
  getArchivedItemByHref,
  listArchivedItems,
  resolveArchivedVariant,
  type ExternalArchiveReader,
} from "./external-archive";
import { createCourseReader } from "./reader";
import {
  createCourseTestDatabase,
  seedRepository,
  seedSnapshot,
  textFile,
} from "./test-database.test-helper";
import type { ExternalArchiveItem } from "./types";

vi.mock("server-only", () => ({}));

/**
 * Base PGlite inyectada en `getCourseDb()` (T-01): las funciones congeladas de
 * `external-archive.ts` no abren conexión real. `getCourseDatabaseUrl()` se
 * conserva para que la degradación sin `DATABASE_URL` siga siendo real.
 */
const databaseHolder = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("./database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./database")>();
  return {
    ...actual,
    getCourseDb: () =>
      actual.getCourseDatabaseUrl() === null
        ? null
        : (databaseHolder.db as ReturnType<typeof actual.getCourseDb>),
  };
});

/**
 * Doble de `cache()` de React con el mismo contrato observable que el build
 * `react-server` (T-01): memoiza por función y argumentos mientras dura una
 * request (`run`) y, fuera de ella, invoca sin memoizar (en tests, el `cache`
 * del build cliente es un passthrough). Permite afirmar "una request = un
 * índice" sin un servidor RSC real.
 */
const requestCache = vi.hoisted(() => {
  type Entry = { args: readonly unknown[]; result: unknown };
  const scopes: Array<Map<unknown, Entry[]>> = [];
  return {
    async run<T>(operation: () => Promise<T>): Promise<T> {
      const scope = new Map<unknown, Entry[]>();
      scopes.push(scope);
      try {
        return await operation();
      } finally {
        scopes.pop();
      }
    },
    cache<TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult,
    ): (...args: TArgs) => TResult {
      return (...args: TArgs): TResult => {
        const scope = scopes.at(-1);
        if (scope === undefined) {
          return fn(...args);
        }
        const entries = scope.get(fn) ?? [];
        const hit = entries.find(
          (entry) =>
            entry.args.length === args.length &&
            entry.args.every((arg, index) => Object.is(arg, args[index])),
        );
        if (hit !== undefined) {
          return hit.result as TResult;
        }
        const result = fn(...args);
        entries.push({ args, result });
        scope.set(fn, entries);
        return result;
      };
    },
  };
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: requestCache.cache as unknown as typeof actual.cache,
  };
});

const CAPTURED_AT = "2026-10-02T10:00:00.000Z";

const LESSON_EN_URL = "https://example.com/lesson/fixture-lesson";
const LESSON_ES_URL = "https://example.com/es/lesson/fixture-lesson";
const LESSON_OTHER_URL = "https://example.com/lesson/other-fixture";
const RETIRED_URL = "https://example.com/lesson/retired-fixture";
const TOOL_URL = "https://example.com/tool/fixture-tool";
const IMAGE_URL = "https://example.com/images/fixture-image.png";
const MARKETING_URL = "https://example.com/marketing/fixture-page";

const SHA_CONTENT_EN = "1".repeat(64);
const SHA_CONTENT_ES = "2".repeat(64);
const SHA_CONTENT_OTHER = "3".repeat(64);
const SHA_ASSET = "a".repeat(64);

const LESSON_CONTENT = "# Fixture lesson\n\nLiteral body.\n";

type TestContext = Awaited<ReturnType<typeof setupContext>>;

async function setupContext() {
  const database = await createCourseTestDatabase();
  return {
    ...database,
    store: new PostgresExternalArchiveStore(database.db),
  };
}

let context: TestContext;

beforeEach(async () => {
  context = await setupContext();
  databaseHolder.db = context.db;
  vi.stubEnv("DATABASE_URL", "postgres://example.test/archive");
});

afterEach(async () => {
  await context.client.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function lessonItem(
  overrides: Partial<NewExternalArchiveItem> = {},
): NewExternalArchiveItem {
  return {
    originalUrl: LESSON_EN_URL,
    canonicalUrl: LESSON_EN_URL,
    kind: "lesson",
    host: "example.com",
    language: "en",
    title: "Fixture lesson",
    content: LESSON_CONTENT,
    contentSha256: SHA_CONTENT_EN,
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

async function seedLesson(
  overrides: Partial<NewExternalArchiveItem> = {},
): Promise<ExternalArchiveItem> {
  const desired = lessonItem(overrides);
  await context.store.upsertItem(desired);
  const stored = await createExternalArchiveReader(
    context.db,
  ).getArchivedItemByCanonicalUrl(desired.canonicalUrl);
  if (stored === null) {
    throw new Error("El item sembrado no existe");
  }
  return stored;
}

async function seedRelatedLessons(): Promise<{
  english: ExternalArchiveItem;
  spanish: ExternalArchiveItem;
}> {
  const english = await seedLesson();
  const spanish = await seedLesson({
    originalUrl: LESSON_ES_URL,
    canonicalUrl: LESSON_ES_URL,
    language: "es",
    contentSha256: SHA_CONTENT_ES,
    sourcePath: "content/fixture-lesson.es.md",
  });
  return { english, spanish };
}

function archiveReader(): ExternalArchiveReader {
  return createExternalArchiveReader(context.db);
}

describe("resolveArchivedVariant: variante de idioma por procedencia literal", () => {
  it("elige el par ES/EN por source_repository + source_path sin sufijo", async () => {
    const { english, spanish } = await seedRelatedLessons();
    const reader = archiveReader();

    const toSpanish = await reader.resolveArchivedVariant(english, "es");
    expect(toSpanish.item.canonicalUrl).toBe(LESSON_ES_URL);
    expect(toSpanish.isFallback).toBe(false);

    const toEnglish = await reader.resolveArchivedVariant(spanish, "en");
    expect(toEnglish.item.canonicalUrl).toBe(LESSON_EN_URL);
    expect(toEnglish.isFallback).toBe(false);

    const sameLanguage = await reader.resolveArchivedVariant(english, "en");
    expect(sameLanguage.item.canonicalUrl).toBe(LESSON_EN_URL);
    expect(sameLanguage.isFallback).toBe(false);
  });

  it("no relaciona items sin la misma procedencia y marca isFallback", async () => {
    const english = await seedLesson();
    await seedLesson({
      originalUrl: LESSON_OTHER_URL,
      canonicalUrl: LESSON_OTHER_URL,
      language: "es",
      contentSha256: SHA_CONTENT_OTHER,
      sourcePath: "content/other-fixture.es.md",
    });

    const resolved = await archiveReader().resolveArchivedVariant(
      english,
      "es",
    );
    expect(resolved.item.canonicalUrl).toBe(LESSON_EN_URL);
    expect(resolved.isFallback).toBe(true);
  });

  it("sin source_path no inventa relación", async () => {
    const english = await seedLesson();
    await seedLesson({
      originalUrl: LESSON_ES_URL,
      canonicalUrl: LESSON_ES_URL,
      language: "es",
      contentSha256: SHA_CONTENT_ES,
      sourcePath: null,
    });

    const resolved = await archiveReader().resolveArchivedVariant(
      english,
      "es",
    );
    expect(resolved.item.canonicalUrl).toBe(LESSON_EN_URL);
    expect(resolved.isFallback).toBe(true);
  });
});

describe("resolveArchivedAlias: lección retirada → destino (§8)", () => {
  it("devuelve el item destino de un alias y null para no-alias", async () => {
    const destination = await seedLesson();
    const alias = await seedLesson({
      originalUrl: RETIRED_URL,
      canonicalUrl: RETIRED_URL,
      language: "es",
      status: "alias",
      method: "user-alias",
      content: null,
      contentSha256: null,
      contentFormat: null,
      sourceRepository: null,
      sourceCommit: null,
      sourcePath: null,
      aliasOfCanonicalUrl: destination.canonicalUrl,
    });

    const reader = archiveReader();
    const resolved = await reader.resolveArchivedAlias(alias);
    expect(resolved?.canonicalUrl).toBe(LESSON_EN_URL);
    expect(await reader.resolveArchivedAlias(destination)).toBeNull();
  });

  it("resolveArchivedVariant resuelve el alias antes de elegir la variante", async () => {
    const { spanish } = await seedRelatedLessons();
    const alias = await seedLesson({
      originalUrl: RETIRED_URL,
      canonicalUrl: RETIRED_URL,
      language: "es",
      status: "alias",
      method: "user-alias",
      content: null,
      contentSha256: null,
      contentFormat: null,
      sourceRepository: null,
      sourceCommit: null,
      sourcePath: null,
      aliasOfCanonicalUrl: spanish.canonicalUrl,
    });

    const resolved = await archiveReader().resolveArchivedVariant(alias, "en");
    expect(resolved.item.canonicalUrl).toBe(LESSON_EN_URL);
    expect(resolved.isFallback).toBe(false);
  });
});

describe("búsqueda por href y resolvedor de Markdown archivado", () => {
  it("getArchivedItemByHref resuelve /archive/<host>/<path…>", async () => {
    await seedLesson();
    const reader = archiveReader();

    const item = await reader.getArchivedItemByHref(
      "/archive/example.com/lesson/fixture-lesson",
    );
    expect(item?.canonicalUrl).toBe(LESSON_EN_URL);
    expect(
      await reader.getArchivedItemByHref("/archive/example.com/lesson/missing"),
    ).toBeNull();
    expect(
      await reader.getArchivedItemByHref("https://example.com/x"),
    ).toBeNull();
  });

  it("mapea imágenes a archive-asset, otras URL archivadas a external-archive y el resto a external", async () => {
    const { english } = await seedRelatedLessons();
    const bytes = new TextEncoder().encode("png-fixture-bytes");
    await context.store.upsertAsset({
      sha256: SHA_ASSET,
      bytes,
      contentType: "image/png",
      byteSize: bytes.byteLength,
      sourceUrl: IMAGE_URL,
      capturedAt: CAPTURED_AT,
    });
    await context.store.linkItemAsset({
      itemId: english.id,
      assetSha256: SHA_ASSET,
      originalUrl: IMAGE_URL,
      alt: "fixture image",
    });

    const reader = archiveReader();
    const item = await reader.getArchivedItemByCanonicalUrl(LESSON_EN_URL);
    expect(item).not.toBeNull();
    const resolver = reader.createExternalArchiveResolver(item!);

    expect(resolver(IMAGE_URL)).toEqual({
      kind: "archive-asset",
      href: `/archive-assets/${SHA_ASSET}`,
      sha256: SHA_ASSET,
    });
    expect(resolver(LESSON_ES_URL)).toEqual({
      kind: "external-archive",
      href: "/archive/example.com/es/lesson/fixture-lesson",
      originalHref: LESSON_ES_URL,
      archiveId: expect.any(String),
    });
    expect(resolver(MARKETING_URL)).toEqual({
      kind: "external",
      href: MARKETING_URL,
    });
  });

  it("una herramienta con respaldo Wayback añade backup conservando el original", async () => {
    const withBackup = await seedLesson({
      originalUrl: TOOL_URL,
      canonicalUrl: TOOL_URL,
      kind: "tool",
      language: null,
      sourcePath: null,
      sourceRepository: null,
      content: null,
      contentSha256: null,
      contentFormat: null,
      waybackUrl:
        "http://web.archive.org/web/20260613092255/https://example.com/tool/fixture-tool",
      waybackCapturedAt: "2026-06-13T09:22:55.000Z",
      waybackHttpStatus: 200,
    });

    const reader = archiveReader();
    const item = await reader.getArchivedItemByCanonicalUrl(TOOL_URL);
    expect(item?.id).toBe(withBackup.id);
    const resolver = reader.createExternalArchiveResolver(item!);

    expect(resolver(TOOL_URL)).toEqual({
      kind: "external",
      href: TOOL_URL,
      backup: {
        href: "http://web.archive.org/web/20260613092255/https://example.com/tool/fixture-tool",
        capturedAt: "2026-06-13T09:22:55.000Z",
      },
    });
  });

  it("getArchivedAsset devuelve bytes y content type; null si no existe", async () => {
    const bytes = new TextEncoder().encode("png-fixture-bytes");
    await context.store.upsertAsset({
      sha256: SHA_ASSET,
      bytes,
      contentType: "image/png",
      byteSize: bytes.byteLength,
      sourceUrl: IMAGE_URL,
      capturedAt: CAPTURED_AT,
    });

    const reader = archiveReader();
    const asset = await reader.getArchivedAsset(SHA_ASSET);
    expect(asset?.contentType).toBe("image/png");
    expect(Array.from(asset?.bytes ?? [])).toEqual(Array.from(bytes));
    expect(await reader.getArchivedAsset("f".repeat(64))).toBeNull();
  });
});

describe("degradación sin base y sin red (AC-2.5.8)", () => {
  it("createExternalArchiveReader(null) devuelve []/null", async () => {
    const reader = createExternalArchiveReader(null);
    expect(await reader.listArchivedItems()).toEqual([]);
    expect(
      await reader.getArchivedItemByCanonicalUrl(LESSON_EN_URL),
    ).toBeNull();
    expect(
      await reader.getArchivedItemByHref("/archive/example.com/x"),
    ).toBeNull();
    expect(await reader.getArchivedAsset(SHA_ASSET)).toBeNull();
    expect((await reader.createExternalArchiveIndex()).size).toBe(0);
  });

  it("las funciones congeladas sin DATABASE_URL devuelven vacío", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await listArchivedItems()).toEqual([]);
  });

  it("leer el archivo no hace ninguna petición de red", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { english, spanish } = await seedRelatedLessons();
    const alias = await seedLesson({
      originalUrl: RETIRED_URL,
      canonicalUrl: RETIRED_URL,
      language: "es",
      status: "alias",
      method: "user-alias",
      content: null,
      contentSha256: null,
      contentFormat: null,
      sourceRepository: null,
      sourceCommit: null,
      sourcePath: null,
      aliasOfCanonicalUrl: spanish.canonicalUrl,
    });

    const reader = archiveReader();
    await reader.listArchivedItems();
    await reader.getArchivedItemByHref(
      "/archive/example.com/lesson/fixture-lesson",
    );
    await reader.resolveArchivedAlias(alias);
    await reader.resolveArchivedVariant(english, "es");
    const resolver = reader.createExternalArchiveResolver(english);
    resolver(LESSON_EN_URL);
    resolver(IMAGE_URL);
    resolver(MARKETING_URL);
    await reader.getArchivedAsset(SHA_ASSET);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("T-01: índice EXTERNAL_ARCHIVE releído por request, sin caché de proceso", () => {
  const DOCUMENT_PATH = "content/projects/alpha-unit/README.md";

  async function createReaderWithLessonLink() {
    const repositoryId = await seedRepository(context.db);
    const snapshotId = await seedSnapshot(context.db, repositoryId, {
      status: "complete",
      importedAt: new Date(CAPTURED_AT),
    });
    await context.db.insert(sourceFiles).values([
      textFile(snapshotId, DOCUMENT_PATH, {
        rawContent: `[lesson](${LESSON_EN_URL})\n`,
        language: "en",
        languageEvidence: "pair-convention",
      }),
    ]);
    return createCourseReader(context.db);
  }

  it("T-01: una request nueva ve el item capturado después sin reiniciar", async () => {
    await requestCache.run(async () => {
      expect(await listArchivedItems()).toEqual([]);
      expect((await createExternalArchiveIndex()).size).toBe(0);
    });

    await seedLesson();

    expect(
      (await listArchivedItems()).map((item) => item.canonicalUrl),
    ).toEqual([LESSON_EN_URL]);
    expect(await getArchivedItemByCanonicalUrl(LESSON_EN_URL)).not.toBeNull();
    expect((await createExternalArchiveIndex()).size).toBe(1);
  });

  it("T-01: dentro de la misma request el índice de las funciones congeladas se construye una sola vez", async () => {
    await seedLesson();
    const listItems = vi.spyOn(
      PostgresExternalArchiveStore.prototype,
      "listItems",
    );
    try {
      await requestCache.run(async () => {
        await listArchivedItems();
        await getArchivedItemByHref(
          "/archive/example.com/lesson/fixture-lesson",
        );
        const item = await getArchivedItemByCanonicalUrl(LESSON_EN_URL);
        await resolveArchivedVariant(item!, "es");
        await createExternalArchiveIndex();
        expect(listItems).toHaveBeenCalledTimes(1);
      });
    } finally {
      listItems.mockRestore();
    }
  });

  it("T-01: el CourseReader relee el archivo y ve un item capturado después", async () => {
    const reader = await createReaderWithLessonLink();
    const before = await reader.createMarkdownUrlResolver(DOCUMENT_PATH);
    expect(before(LESSON_EN_URL)).toEqual({
      kind: "external",
      href: LESSON_EN_URL,
    });

    await seedLesson();

    const after = await reader.createMarkdownUrlResolver(DOCUMENT_PATH);
    expect(after(LESSON_EN_URL)).toEqual({
      kind: "external-archive",
      href: "/archive/example.com/lesson/fixture-lesson",
      originalHref: LESSON_EN_URL,
      archiveId: expect.any(String),
    });
  });

  it("T-01: dentro de una request el CourseReader comparte un único índice", async () => {
    await seedLesson();
    const reader = await createReaderWithLessonLink();
    const listItems = vi.spyOn(
      PostgresExternalArchiveStore.prototype,
      "listItems",
    );
    try {
      await requestCache.run(async () => {
        const first = await reader.createMarkdownUrlResolver(DOCUMENT_PATH);
        const second = await reader.createMarkdownUrlResolver(DOCUMENT_PATH);
        expect(first(LESSON_EN_URL).kind).toBe("external-archive");
        expect(second(LESSON_EN_URL).kind).toBe("external-archive");
        expect(listItems).toHaveBeenCalledTimes(1);
      });
    } finally {
      listItems.mockRestore();
    }
  });
});
