// @vitest-environment node
/**
 * AC-2.12 (datos): variantes de idioma por documento, con la evidencia real
 * del store (nunca inferida del contenido). Los casos con fixtures reales
 * derivan los paths del manifiesto en runtime (AC-0.10).
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { sourceFiles } from "../source/store/schema";
import {
  fixturesMatching,
  readFixtureEntry,
} from "./fixture-reader.test-helper";
import { languagePathCandidates } from "./language";
import { CourseReader } from "./reader";
import {
  binaryFile,
  createCourseTestDatabase,
  seedRepository,
  seedSnapshot,
  textFile,
} from "./test-database.test-helper";

vi.mock("server-only", () => ({}));

type TestContext = Awaited<ReturnType<typeof createCourseTestDatabase>> & {
  reader: CourseReader;
  repositoryId: string;
};

describe("languagePathCandidates (ADR-012 §3.6)", () => {
  it("deriva los candidatos por sufijo de nombre", () => {
    expect(languagePathCandidates("alpha/README.es.md")).toEqual([
      "alpha/README.es.md",
      "alpha/README.en.md",
      "alpha/README.md",
    ]);
    expect(languagePathCandidates("alpha/README.en.md")).toEqual([
      "alpha/README.en.md",
      "alpha/README.es.md",
      "alpha/README.md",
    ]);
    expect(languagePathCandidates("alpha/README.md")).toEqual([
      "alpha/README.md",
      "alpha/README.es.md",
      "alpha/README.en.md",
    ]);
    expect(languagePathCandidates("alpha/preview.png")).toEqual([
      "alpha/preview.png",
    ]);
  });
});

describe("listLanguageVariants sobre PGlite con las migraciones reales", () => {
  let context: TestContext;

  beforeAll(async () => {
    const { client, db } = await createCourseTestDatabase();
    context = {
      client,
      db,
      reader: new CourseReader(db),
      repositoryId: await seedRepository(db),
    };
  });

  afterAll(async () => {
    await context.client.close();
  });

  beforeEach(async () => {
    await context.client.exec(
      "truncate table source_contexts, source_files, source_import_errors, source_lessons, source_projects, source_repositories, source_snapshots restart identity cascade",
    );
    context.repositoryId = await seedRepository(context.db);
  });

  async function seedFiles(): Promise<void> {
    const snapshotId = await seedSnapshot(context.db, context.repositoryId, {
      status: "complete",
      importedAt: new Date("2026-10-02T10:00:00.000Z"),
    });
    await context.db.insert(sourceFiles).values([
      textFile(snapshotId, "content/projects/alpha-unit/README.es.md", {
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/projects/alpha-unit/README.md", {
        language: "en",
        languageEvidence: "pair-convention",
      }),
      textFile(snapshotId, "content/lessons/beta-lesson/beta-lesson.en.md", {
        language: "en",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/contexts/gamma-context/notes.md", {
        language: null,
        languageEvidence: null,
      }),
      binaryFile(snapshotId, "content/projects/alpha-unit/preview.png"),
    ]);
  }

  it("devuelve el par es/en con el español como preferido", async () => {
    await seedFiles();
    const variants = await context.reader.listLanguageVariants(
      "content/projects/alpha-unit/README.es.md",
    );
    expect(variants).toEqual([
      {
        language: "es",
        evidence: "suffix",
        path: "content/projects/alpha-unit/README.es.md",
        isPreferred: true,
      },
      {
        language: "en",
        evidence: "pair-convention",
        path: "content/projects/alpha-unit/README.md",
        isPreferred: false,
      },
    ]);
  });

  it("desde la variante inglesa ofrece también la española", async () => {
    await seedFiles();
    const variants = await context.reader.listLanguageVariants(
      "content/projects/alpha-unit/README.md",
    );
    expect(variants.map((variant) => variant.path)).toEqual([
      "content/projects/alpha-unit/README.md",
      "content/projects/alpha-unit/README.es.md",
    ]);
    expect(variants.find((variant) => variant.isPreferred)?.language).toBe(
      "es",
    );
  });

  it("un archivo con sufijo y sin par produce una única variante", async () => {
    await seedFiles();
    const variants = await context.reader.listLanguageVariants(
      "content/lessons/beta-lesson/beta-lesson.en.md",
    );
    expect(variants).toEqual([
      {
        language: "en",
        evidence: "suffix",
        path: "content/lessons/beta-lesson/beta-lesson.en.md",
        isPreferred: true,
      },
    ]);
  });

  it("un archivo sin evidencia de idioma no produce variantes", async () => {
    await seedFiles();
    expect(
      await context.reader.listLanguageVariants(
        "content/contexts/gamma-context/notes.md",
      ),
    ).toEqual([]);
  });

  it("un path inexistente no produce variantes", async () => {
    await seedFiles();
    expect(
      await context.reader.listLanguageVariants(
        "content/projects/missing-unit/README.es.md",
      ),
    ).toEqual([]);
  });

  it("sin snapshot activo no produce variantes", async () => {
    expect(
      await context.reader.listLanguageVariants(
        "content/projects/alpha-unit/README.es.md",
      ),
    ).toEqual([]);
  });

  it("con el par real del manifiesto devuelve 2 variantes y el español preferido", async () => {
    const spanishEntry = fixturesMatching((entry) =>
      /^content\/projects\/[^/]+\/README\.es\.md$/.test(entry.path),
    )[0];
    expect(spanishEntry).toBeDefined();
    const englishPath = spanishEntry!.path.replace(/\.es\.md$/, ".md");
    const englishEntry = fixturesMatching(
      (entry) => entry.path === englishPath,
    )[0];
    expect(englishEntry).toBeDefined();

    const snapshotId = await seedSnapshot(context.db, context.repositoryId, {
      status: "complete",
      importedAt: new Date("2026-10-02T10:00:00.000Z"),
      commitSha: spanishEntry!.commit,
    });
    await context.db.insert(sourceFiles).values([
      textFile(snapshotId, spanishEntry!.path, {
        blobSha: spanishEntry!.blob_sha,
        rawContent: readFixtureEntry(spanishEntry!),
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, englishPath, {
        blobSha: englishEntry!.blob_sha,
        rawContent: readFixtureEntry(englishEntry!),
        language: "en",
        languageEvidence: "pair-convention",
      }),
    ]);

    const variants = await context.reader.listLanguageVariants(
      spanishEntry!.path,
    );
    expect(variants).toHaveLength(2);
    expect(variants[0]?.path).toBe(spanishEntry!.path);
    expect(variants[0]?.isPreferred).toBe(true);
    expect(variants[1]?.path).toBe(englishPath);
  });
});
