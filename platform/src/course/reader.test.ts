// @vitest-environment node
/**
 * Lectura `course/` sobre PGlite con las migraciones reales: snapshot activo,
 * orden de proyectos según README, subproyectos derivados, documentos de
 * contexto en subdirectorio, assets y degradación sin base/sin snapshot.
 *
 * Los paths sintéticos son neutros (AC-0.10) y no reproducen el catálogo real.
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

import {
  sourceBlobs,
  sourceContexts,
  sourceFiles,
  sourceLessons,
  sourceProjects,
} from "../source/store/schema";
import { CourseReader } from "./reader";
import { PROJECTS_ORDER_PATH, PROJECTS_PREFERRED_README_PATH } from "./order";
import {
  binaryFile,
  createCourseTestDatabase,
  seedImportErrors,
  seedRepository,
  seedSnapshot,
  textFile,
  TEST_COMMIT,
} from "./test-database.test-helper";

vi.mock("server-only", () => ({}));

const TRUNCATE_ALL =
  "truncate table source_blobs, source_contexts, source_files, source_import_errors, source_lessons, source_projects, source_repositories, source_snapshots restart identity cascade";

const PROJECTS_README_MD = [
  "# Example catalog",
  "",
  "## Main section",
  "",
  "0. **[Alpha label](./alpha-unit)**  ",
  "   Alpha description.",
  "",
  "1. **[Beta label](./beta-unit)**  ",
  "   Beta description.",
  "",
  "## Extra section",
  "",
  "- **[Gamma `label`](./gamma-unit)**  ",
  "  Gamma description.",
  "",
  "## For devs section",
  "",
  "- **[Child one label](./alpha-unit/child-one)**  ",
  "  Child description.",
  "",
].join("\n");

const PROJECTS_README_ES = [
  "# Catálogo de ejemplo",
  "",
  "## Sección principal",
  "",
  "0. **[Etiqueta alfa](./alpha-unit)**  ",
  "   Descripción alfa.",
  "",
  "1. **[Etiqueta beta](./beta-unit)**  ",
  "   Descripción beta.",
  "",
  "## Sección extra",
  "",
  "- **[Etiqueta `gamma`](./gamma-unit)**  ",
  "  Descripción gamma.",
  "",
  "## Sección for devs",
  "",
  "- **[Etiqueta hijo uno](./alpha-unit/child-one)**  ",
  "  Descripción hijo.",
  "",
].join("\n");

type TestContext = Awaited<ReturnType<typeof createCourseTestDatabase>> & {
  reader: CourseReader;
  repositoryId: string;
};

describe("CourseReader sobre PGlite con las migraciones reales", () => {
  let context: TestContext;

  beforeAll(async () => {
    const { client, db } = await createCourseTestDatabase();
    context = {
      client,
      db,
      reader: new CourseReader(db),
      repositoryId: "",
    };
  });

  afterAll(async () => {
    await context.client.close();
  });

  beforeEach(async () => {
    await context.client.exec(TRUNCATE_ALL);
    context.repositoryId = await seedRepository(context.db);
  });

  async function seedActiveSnapshot(options?: {
    status?: "complete" | "complete_with_errors";
    importedAt?: Date;
    commitSha?: string;
  }): Promise<string> {
    return seedSnapshot(context.db, context.repositoryId, {
      status: options?.status ?? "complete",
      importedAt: options?.importedAt ?? new Date("2026-10-02T10:00:00.000Z"),
      commitSha: options?.commitSha ?? TEST_COMMIT,
    });
  }

  async function seedProjectFiles(snapshotId: string): Promise<void> {
    await context.db.insert(sourceFiles).values([
      textFile(snapshotId, PROJECTS_ORDER_PATH, {
        rawContent: PROJECTS_README_MD,
        language: "en",
        languageEvidence: "pair-convention",
      }),
      textFile(snapshotId, PROJECTS_PREFERRED_README_PATH, {
        rawContent: PROJECTS_README_ES,
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/projects/alpha-unit/README.es.md", {
        rawContent: "# Alpha H1\n",
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/projects/alpha-unit/README.md", {
        rawContent: "# Alpha English H1\n",
        language: "en",
        languageEvidence: "pair-convention",
      }),
      textFile(snapshotId, "content/projects/beta-unit/README.es.md", {
        rawContent: "# Beta H1\n",
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/projects/gamma-unit/README.es.md", {
        rawContent: "# Gamma H1\n",
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/projects/delta-unit/README.es.md", {
        rawContent: "# Delta `inline` H1\n",
        language: "es",
        languageEvidence: "suffix",
      }),
      textFile(snapshotId, "content/projects/delta-unit/README.md", {
        rawContent: "# Delta English H1\n",
        language: "en",
        languageEvidence: "pair-convention",
      }),
      textFile(snapshotId, "content/projects/epsilon-unit/README.md", {
        rawContent: "# Epsilon H1\n",
        language: null,
        languageEvidence: null,
      }),
    ]);
  }

  async function seedProjectRows(snapshotId: string): Promise<void> {
    const preferred = (slug: string, language: "es" | null) => ({
      snapshotId,
      sourcePath: `content/projects/${slug}`,
      title: null,
      canonicalOrder: null,
      preferredReadmePath:
        language === "es"
          ? `content/projects/${slug}/README.es.md`
          : `content/projects/${slug}/README.md`,
      language,
      languageEvidence:
        language === "es" ? ("suffix" as const) : (null as null),
      metadata: {},
    });
    await context.db
      .insert(sourceProjects)
      .values([
        preferred("alpha-unit", "es"),
        preferred("beta-unit", "es"),
        preferred("gamma-unit", "es"),
        preferred("delta-unit", "es"),
        preferred("epsilon-unit", null),
      ]);
  }

  describe("snapshot activo", () => {
    it("elige el último terminado e ignora importing/failed, con su errorCount", async () => {
      await seedSnapshot(context.db, context.repositoryId, {
        status: "complete",
        importedAt: new Date("2026-10-01T10:00:00.000Z"),
        commitSha: "b".repeat(40),
      });
      await seedSnapshot(context.db, context.repositoryId, {
        status: "failed",
        importedAt: new Date("2026-10-03T10:00:00.000Z"),
        commitSha: "c".repeat(40),
      });
      await seedSnapshot(context.db, context.repositoryId, {
        status: "importing",
        importedAt: new Date("2026-10-04T10:00:00.000Z"),
        commitSha: "d".repeat(40),
      });
      const activeId = await seedSnapshot(context.db, context.repositoryId, {
        status: "complete_with_errors",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
        commitSha: "e".repeat(40),
      });
      await seedImportErrors(context.db, activeId, 2);

      const snapshot = await context.reader.getActiveSnapshot();
      expect(snapshot).toMatchObject({
        snapshotId: activeId,
        status: "complete_with_errors",
        commitSha: "e".repeat(40),
        ref: "main",
        importedAt: "2026-10-02T10:00:00.000Z",
        errorCount: 2,
        owner: "example-org",
        name: "example-syllabus",
        canonicalUrl: "https://github.com/example-org/example-syllabus",
      });
    });

    it("prefiere un complete más reciente que un complete_with_errors anterior", async () => {
      const olderId = await seedSnapshot(context.db, context.repositoryId, {
        status: "complete_with_errors",
        importedAt: new Date("2026-10-01T10:00:00.000Z"),
        commitSha: "b".repeat(40),
      });
      await seedImportErrors(context.db, olderId, 3);
      const newerId = await seedSnapshot(context.db, context.repositoryId, {
        status: "complete",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
        commitSha: "c".repeat(40),
      });

      const snapshot = await context.reader.getActiveSnapshot();
      expect(snapshot).toMatchObject({
        snapshotId: newerId,
        status: "complete",
        errorCount: 0,
      });
    });

    it("sin ningún snapshot terminado devuelve null y listas vacías", async () => {
      await seedSnapshot(context.db, context.repositoryId, {
        status: "importing",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
      });
      expect(await context.reader.getActiveSnapshot()).toBeNull();
      expect(await context.reader.getProjectsIndex()).toBeNull();
      expect(await context.reader.getProject("alpha-unit")).toBeNull();
      expect(await context.reader.listContexts()).toEqual([]);
      expect(await context.reader.listLessons()).toEqual([]);
      expect(
        await context.reader.getDocument(
          "content/projects/alpha-unit/README.es.md",
        ),
      ).toBeNull();
      expect(
        await context.reader.getFileBytes(
          "content/projects/alpha-unit/README.es.md",
        ),
      ).toBeNull();
    });
  });

  describe("proyectos", () => {
    beforeEach(async () => {
      const snapshotId = await seedActiveSnapshot();
      await seedProjectFiles(snapshotId);
      await seedProjectRows(snapshotId);
    });

    it("ordena por el README y deja los no listados al final por source_path", async () => {
      const index = await context.reader.getProjectsIndex();
      expect(index).not.toBeNull();
      expect(index!.units.map((unit) => unit.slug)).toEqual([
        "alpha-unit",
        "beta-unit",
        "gamma-unit",
        "delta-unit",
        "epsilon-unit",
      ]);
      expect(index!.units.map((unit) => unit.order)).toEqual([
        0,
        1,
        2,
        null,
        null,
      ]);
      expect(index!.units.map((unit) => unit.listMarker)).toEqual([
        "0",
        "1",
        null,
        null,
        null,
      ]);
      expect(index!.units.map((unit) => unit.orderSection)).toEqual([
        "Sección principal",
        "Sección principal",
        "Sección extra",
        null,
        null,
      ]);
      expect(index!.readme.path).toBe(PROJECTS_PREFERRED_README_PATH);
      expect(index!.orderSource.path).toBe(PROJECTS_ORDER_PATH);
      expect(index!.readme.rawContent).toBe(PROJECTS_README_ES);
      expect(index!.orderSource.rawContent).toBe(PROJECTS_README_MD);
    });

    it("usa etiquetas y descripciones del README del idioma pedido", async () => {
      const spanish = await context.reader.getProjectsIndex();
      const english = await context.reader.getProjectsIndex("en");
      expect(spanish!.units[0]).toMatchObject({
        title: "Etiqueta alfa",
        titleOrigin: "readme-label",
        description: "Descripción alfa.",
      });
      expect(english!.units[0]).toMatchObject({
        title: "Alpha label",
        titleOrigin: "readme-label",
        description: "Alpha description.",
      });
      expect(english!.readme.path).toBe(PROJECTS_ORDER_PATH);
    });

    it("F-05/H-4: convierte a texto plano la etiqueta Markdown del README", async () => {
      const spanish = await context.reader.getProjectsIndex();
      const gamma = spanish!.units.find((unit) => unit.slug === "gamma-unit");
      expect(gamma).toMatchObject({
        title: "Etiqueta gamma",
        titleOrigin: "readme-label",
        description: "Descripción gamma.",
      });
    });

    it("F-02: getProject expone el marcador literal del ítem de lista ordenada", async () => {
      expect(await context.reader.getProject("alpha-unit")).toMatchObject({
        listMarker: "0",
      });
      expect(await context.reader.getProject("beta-unit")).toMatchObject({
        listMarker: "1",
      });
      expect(await context.reader.getProject("gamma-unit")).toMatchObject({
        listMarker: null,
      });
    });

    it("para no listados usa el H1 del documento preferido o el slug", async () => {
      const index = await context.reader.getProjectsIndex();
      const delta = index!.units.find((unit) => unit.slug === "delta-unit");
      const epsilon = index!.units.find((unit) => unit.slug === "epsilon-unit");
      expect(delta).toMatchObject({
        title: "Delta inline H1",
        titleOrigin: "document-h1",
        description: null,
        order: null,
        listMarker: null,
        orderSection: null,
      });
      expect(epsilon).toMatchObject({
        title: "Epsilon H1",
        titleOrigin: "document-h1",
        language: null,
      });
    });

    it("QA-F1: los no listados usan el H1 de la variante del idioma pedido", async () => {
      const spanish = await context.reader.getProjectsIndex("es");
      const english = await context.reader.getProjectsIndex("en");
      const deltaSpanish = spanish!.units.find(
        (unit) => unit.slug === "delta-unit",
      );
      const deltaEnglish = english!.units.find(
        (unit) => unit.slug === "delta-unit",
      );
      expect(deltaSpanish).toMatchObject({
        title: "Delta inline H1",
        titleOrigin: "document-h1",
        preferredDocumentPath: "content/projects/delta-unit/README.es.md",
      });
      expect(deltaEnglish).toMatchObject({
        title: "Delta English H1",
        titleOrigin: "document-h1",
        preferredDocumentPath: "content/projects/delta-unit/README.es.md",
      });

      expect(await context.reader.getProject("delta-unit", "en")).toMatchObject(
        {
          title: "Delta English H1",
          titleOrigin: "document-h1",
          preferredDocumentPath: "content/projects/delta-unit/README.es.md",
        },
      );
      expect(await context.reader.getProject("delta-unit", "es")).toMatchObject(
        { title: "Delta inline H1" },
      );
    });

    it("getProject respeta el idioma y devuelve null para slug desconocido", async () => {
      expect(await context.reader.getProject("alpha-unit")).toMatchObject({
        kind: "project",
        title: "Etiqueta alfa",
        preferredDocumentPath: "content/projects/alpha-unit/README.es.md",
        language: "es",
        languageEvidence: "suffix",
      });
      expect(await context.reader.getProject("alpha-unit", "en")).toMatchObject(
        { title: "Alpha label" },
      );
      expect(await context.reader.getProject("unknown-unit")).toBeNull();
    });

    it("las unidades de lista no transportan raw_content", async () => {
      const index = await context.reader.getProjectsIndex();
      for (const unit of index!.units) {
        expect(Object.hasOwn(unit, "rawContent")).toBe(false);
      }
    });
  });

  describe("subproyectos derivados", () => {
    beforeEach(async () => {
      const snapshotId = await seedActiveSnapshot();
      await seedProjectFiles(snapshotId);
      await seedProjectRows(snapshotId);
      await context.db.insert(sourceFiles).values([
        textFile(
          snapshotId,
          "content/projects/alpha-unit/child-one/learn.json",
          {
            mediaType: "application/json",
          },
        ),
        textFile(
          snapshotId,
          "content/projects/alpha-unit/child-one/README.es.md",
          {
            rawContent: "# Child one H1\n",
            language: "es",
            languageEvidence: "suffix",
          },
        ),
        textFile(
          snapshotId,
          "content/projects/alpha-unit/child-one/README.md",
          {
            rawContent: "# Child one English H1\n",
            language: "en",
            languageEvidence: "pair-convention",
          },
        ),
        textFile(
          snapshotId,
          "content/projects/alpha-unit/child-two/learn.json",
          {
            mediaType: "application/json",
          },
        ),
        textFile(
          snapshotId,
          "content/projects/alpha-unit/child-two/README.md",
          {
            rawContent: "# Child two H1\n",
            language: null,
            languageEvidence: null,
          },
        ),
        textFile(snapshotId, "content/projects/alpha-unit/.hidden/learn.json", {
          mediaType: "application/json",
        }),
        textFile(snapshotId, "content/projects/alpha-unit/plain/README.md", {
          rawContent: "# Plain H1\n",
          language: null,
          languageEvidence: null,
        }),
      ]);
    });

    it("deriva solo hijos directos con learn.json y no escribe en base", async () => {
      const parent = await context.reader.getProject("alpha-unit");
      const subprojects = await context.reader.listSubprojects(parent!);
      expect(subprojects.map((unit) => unit.slug)).toEqual([
        "child-one",
        "child-two",
      ]);
      for (const unit of subprojects) {
        expect(unit.kind).toBe("subproject");
        expect(unit.parentSlug).toBe("alpha-unit");
      }
      const count = await context.client.query<{ total: number }>(
        "select count(*)::int as total from source_projects",
      );
      expect(count.rows[0]?.total).toBe(5);
    });

    it("toma etiqueta/orden del README para los listados y H1/path para el resto", async () => {
      const parent = await context.reader.getProject("alpha-unit");
      const subprojects = await context.reader.listSubprojects(parent!);
      expect(subprojects[0]).toMatchObject({
        slug: "child-one",
        title: "Etiqueta hijo uno",
        titleOrigin: "readme-label",
        description: "Descripción hijo.",
        order: 3,
        listMarker: null,
        orderSection: "Sección for devs",
        preferredDocumentPath:
          "content/projects/alpha-unit/child-one/README.es.md",
        language: "es",
      });
      expect(subprojects[1]).toMatchObject({
        slug: "child-two",
        title: "Child two H1",
        titleOrigin: "document-h1",
        description: null,
        order: null,
        orderSection: null,
        preferredDocumentPath:
          "content/projects/alpha-unit/child-two/README.md",
        language: null,
      });
    });

    it("QA-F1: el H1 de un subproyecto sin etiqueta respeta el idioma pedido", async () => {
      const snapshot = await context.reader.getActiveSnapshot();
      await context.db.insert(sourceFiles).values([
        textFile(
          snapshot!.snapshotId,
          "content/projects/alpha-unit/child-three/learn.json",
          { mediaType: "application/json" },
        ),
        textFile(
          snapshot!.snapshotId,
          "content/projects/alpha-unit/child-three/README.es.md",
          {
            rawContent: "# Child three H1\n",
            language: "es",
            languageEvidence: "suffix",
          },
        ),
        textFile(
          snapshot!.snapshotId,
          "content/projects/alpha-unit/child-three/README.md",
          {
            rawContent: "# Child three English H1\n",
            language: "en",
            languageEvidence: "pair-convention",
          },
        ),
      ]);

      const parent = await context.reader.getProject("alpha-unit", "en");
      const english = await context.reader.listSubprojects(parent!, "en");
      expect(english.find((unit) => unit.slug === "child-three")).toMatchObject(
        {
          title: "Child three English H1",
          titleOrigin: "document-h1",
          preferredDocumentPath:
            "content/projects/alpha-unit/child-three/README.es.md",
        },
      );

      const spanish = await context.reader.listSubprojects(parent!, "es");
      expect(spanish.find((unit) => unit.slug === "child-three")).toMatchObject(
        {
          title: "Child three H1",
          titleOrigin: "document-h1",
        },
      );
    });

    it("getSubproject encuentra el subproyecto y respeta el slug desconocido", async () => {
      expect(
        await context.reader.getSubproject("alpha-unit", "child-one"),
      ).toMatchObject({
        kind: "subproject",
        title: "Etiqueta hijo uno",
      });
      expect(
        await context.reader.getSubproject("alpha-unit", "missing"),
      ).toBeNull();
      expect(
        await context.reader.getSubproject("missing", "child-one"),
      ).toBeNull();
    });
  });

  describe("contextos y lecciones", () => {
    beforeEach(async () => {
      const snapshotId = await seedActiveSnapshot();
      await context.db.insert(sourceFiles).values([
        textFile(
          snapshotId,
          "content/contexts/gamma-context/CONTEXT-gamma.es.md",
          {
            rawContent: "# Gamma context\n",
            language: "es",
            languageEvidence: "suffix",
          },
        ),
        textFile(
          snapshotId,
          "content/contexts/gamma-context/CONTEXT-gamma.md",
          {
            rawContent: "# Gamma context English\n",
            language: "en",
            languageEvidence: "pair-convention",
          },
        ),
        textFile(
          snapshotId,
          "content/contexts/gamma-context/labs/CONTEXT-gamma-lab.es.md",
          {
            rawContent: "# Gamma lab\n",
            language: "es",
            languageEvidence: "suffix",
          },
        ),
        binaryFile(
          snapshotId,
          "content/contexts/gamma-context/labs/report.pdf",
          {
            mediaType: "application/pdf",
            binaryReference: `https://raw.githubusercontent.com/example-org/example-syllabus/${TEST_COMMIT}/content/contexts/gamma-context/labs/report.pdf`,
          },
        ),
        textFile(snapshotId, "content/contexts/gamma-context/data.csv", {
          mediaType: "text/csv",
          language: null,
          languageEvidence: null,
        }),
        textFile(
          snapshotId,
          "content/contexts/delta-context/data/CONTEXT-delta.es.md",
          {
            rawContent: "# Delta context\n",
            language: "es",
            languageEvidence: "suffix",
          },
        ),
        textFile(snapshotId, "content/lessons/beta-lesson/beta-lesson.es.md", {
          rawContent: "# Lección beta\n",
          language: "es",
          languageEvidence: "suffix",
        }),
        textFile(snapshotId, "content/lessons/beta-lesson/beta-lesson.md", {
          rawContent: "# Beta lesson\n",
          language: "en",
          languageEvidence: "pair-convention",
        }),
      ]);
      await context.db.insert(sourceContexts).values([
        {
          snapshotId,
          sourcePath: "content/contexts/delta-context",
          title: null,
          preferredReadmePath: null,
          language: null,
          languageEvidence: null,
          metadata: {},
        },
        {
          snapshotId,
          sourcePath: "content/contexts/gamma-context",
          title: null,
          preferredReadmePath:
            "content/contexts/gamma-context/CONTEXT-gamma.es.md",
          language: "es",
          languageEvidence: "suffix",
          metadata: {},
        },
      ]);
      await context.db.insert(sourceLessons).values([
        {
          snapshotId,
          sourcePath: "content/lessons/beta-lesson",
          title: null,
          preferredReadmePath: "content/lessons/beta-lesson/beta-lesson.es.md",
          language: "es",
          languageEvidence: "suffix",
          metadata: {},
        },
      ]);
    });

    it("lista contextos por source_path con H1 o slug como título", async () => {
      const contexts = await context.reader.listContexts();
      expect(contexts.map((unit) => unit.slug)).toEqual([
        "delta-context",
        "gamma-context",
      ]);
      expect(contexts[0]).toMatchObject({
        title: "delta-context",
        titleOrigin: "source-path",
        preferredDocumentPath: null,
        language: null,
        order: null,
        description: null,
      });
      expect(contexts[1]).toMatchObject({
        title: "Gamma context",
        titleOrigin: "document-h1",
        preferredDocumentPath:
          "content/contexts/gamma-context/CONTEXT-gamma.es.md",
        language: "es",
      });
      expect(await context.reader.getContext("gamma-context")).toMatchObject({
        kind: "context",
        title: "Gamma context",
      });
      expect(await context.reader.getContext("missing-context")).toBeNull();
    });

    it("lista todos los markdown del contexto, incluidos subdirectorios, con ?doc", async () => {
      const gamma = await context.reader.getContext("gamma-context");
      const documents = await context.reader.listContextDocuments(gamma!);
      expect(documents.map((entry) => entry.relativePath)).toEqual([
        "CONTEXT-gamma.es.md",
        "CONTEXT-gamma.md",
        "labs/CONTEXT-gamma-lab.es.md",
      ]);
      expect(documents[0]).toMatchObject({
        path: "content/contexts/gamma-context/CONTEXT-gamma.es.md",
        kind: "text",
        mediaType: "text/markdown",
        href: "/contexts/gamma-context",
        hrefKind: "internal",
      });
      expect(documents[1]?.href).toBe(
        "/contexts/gamma-context?doc=CONTEXT-gamma.md",
      );
      expect(documents[2]?.href).toBe(
        "/contexts/gamma-context?doc=labs%2FCONTEXT-gamma-lab.es.md",
      );

      const delta = await context.reader.getContext("delta-context");
      const deltaDocuments = await context.reader.listContextDocuments(delta!);
      expect(deltaDocuments.map((entry) => entry.relativePath)).toEqual([
        "data/CONTEXT-delta.es.md",
      ]);
      expect(deltaDocuments[0]?.href).toBe(
        "/contexts/delta-context?doc=data%2FCONTEXT-delta.es.md",
      );
    });

    it("ADR-018: lista assets no markdown servidos por la app", async () => {
      const gamma = await context.reader.getContext("gamma-context");
      const assets = await context.reader.listUnitAssets(gamma!);
      expect(assets.map((entry) => entry.relativePath)).toEqual([
        "data.csv",
        "labs/report.pdf",
      ]);
      expect(assets[0]).toMatchObject({
        kind: "text",
        mediaType: "text/csv",
        hrefKind: "source",
      });
      expect(assets[0]?.href).toBe(
        "/source-files/content/contexts/gamma-context/data.csv",
      );
      expect(assets[1]).toMatchObject({
        kind: "binary",
        mediaType: "application/pdf",
        hrefKind: "source",
      });
      expect(assets[1]?.href).toBe(
        "/source-files/content/contexts/gamma-context/labs/report.pdf",
      );
      for (const asset of assets) {
        expect(asset.href).not.toContain("raw.githubusercontent.com");
        expect(asset.href).not.toContain("github.com");
      }
    });

    it("lista lecciones y devuelve la lección por slug", async () => {
      const lessons = await context.reader.listLessons();
      expect(lessons.map((unit) => unit.slug)).toEqual(["beta-lesson"]);
      expect(lessons[0]).toMatchObject({
        kind: "lesson",
        title: "Lección beta",
        titleOrigin: "document-h1",
        preferredDocumentPath: "content/lessons/beta-lesson/beta-lesson.es.md",
        language: "es",
      });
      expect(await context.reader.getLesson("beta-lesson")).toMatchObject({
        title: "Lección beta",
      });
      expect(await context.reader.getLesson("missing-lesson")).toBeNull();
    });

    it("idioma global: títulos y documentos usan la variante pedida", async () => {
      const contexts = await context.reader.listContexts("en");
      const gamma = contexts.find((unit) => unit.slug === "gamma-context");
      expect(gamma?.title).toBe("Gamma context English");

      expect(
        await context.reader.getContext("gamma-context", "en"),
      ).toMatchObject({ title: "Gamma context English" });
      expect(await context.reader.getLesson("beta-lesson", "en")).toMatchObject(
        { title: "Beta lesson" },
      );

      const documents = await context.reader.listContextDocuments(gamma!, "en");
      expect(documents.map((entry) => entry.relativePath)).toEqual([
        "CONTEXT-gamma.md",
        "labs/CONTEXT-gamma-lab.es.md",
      ]);
      expect(documents[0]).toMatchObject({
        language: "en",
        isFallback: false,
        href: "/contexts/gamma-context?doc=CONTEXT-gamma.md",
      });
      expect(documents[1]).toMatchObject({
        language: "es",
        isFallback: true,
      });
      expect(documents[1]?.href).toBe(
        "/contexts/gamma-context?doc=labs%2FCONTEXT-gamma-lab.es.md",
      );

      const spanish = await context.reader.listContextDocuments(gamma!, "es");
      expect(spanish.map((entry) => entry.relativePath)).toEqual([
        "CONTEXT-gamma.es.md",
        "labs/CONTEXT-gamma-lab.es.md",
      ]);
      expect(spanish[0]).toMatchObject({ language: "es", isFallback: false });
    });

    it("resolveDocumentVariant elige la variante real y marca el fallback", async () => {
      const gammaSpanish = "content/contexts/gamma-context/CONTEXT-gamma.es.md";
      expect(
        await context.reader.resolveDocumentVariant(gammaSpanish, "es"),
      ).toEqual({
        path: gammaSpanish,
        language: "es",
        isFallback: false,
      });
      expect(
        await context.reader.resolveDocumentVariant(gammaSpanish, "en"),
      ).toEqual({
        path: "content/contexts/gamma-context/CONTEXT-gamma.md",
        language: "en",
        isFallback: false,
      });
      expect(
        await context.reader.resolveDocumentVariant(
          "content/contexts/gamma-context/labs/CONTEXT-gamma-lab.es.md",
          "en",
        ),
      ).toEqual({
        path: "content/contexts/gamma-context/labs/CONTEXT-gamma-lab.es.md",
        language: "es",
        isFallback: true,
      });
      // Un texto sin idioma declarado no tiene variante: se devuelve tal cual.
      expect(
        await context.reader.resolveDocumentVariant(
          "content/contexts/gamma-context/data.csv",
          "en",
        ),
      ).toEqual({
        path: "content/contexts/gamma-context/data.csv",
        language: null,
        isFallback: false,
      });
      expect(
        await context.reader.resolveDocumentVariant("content/missing.md", "en"),
      ).toBeNull();
    });

    it("el resolvedor cambia el idioma global y pinnea directorios al espejo", async () => {
      vi.stubEnv("SOURCE_MIRROR_REPOSITORY", "example-user/example-fork");
      try {
        const resolver = await context.reader.createMarkdownUrlResolver(
          "content/contexts/gamma-context/CONTEXT-gamma.es.md",
        );
        expect(resolver("./CONTEXT-gamma.md")).toEqual({
          kind: "internal",
          href: `/preferences/language/en?next=${encodeURIComponent("/contexts/gamma-context?doc=CONTEXT-gamma.md")}`,
          targetPath: "content/contexts/gamma-context/CONTEXT-gamma.md",
        });
        expect(resolver("./labs/")).toEqual({
          kind: "source",
          href: `https://github.com/example-user/example-fork/tree/${TEST_COMMIT}/content/contexts/gamma-context/labs`,
          targetPath: "content/contexts/gamma-context/labs",
          targetKind: "tree",
        });
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe("documentos", () => {
    beforeEach(async () => {
      const snapshotId = await seedActiveSnapshot();
      await context.db.insert(sourceFiles).values([
        textFile(snapshotId, "content/projects/alpha-unit/README.es.md", {
          rawContent: "# Alpha H1\n",
          language: "es",
          languageEvidence: "suffix",
          blobSha: "1".repeat(40),
        }),
        binaryFile(snapshotId, "content/projects/alpha-unit/preview.png", {
          blobSha: "2".repeat(40),
        }),
      ]);
    });

    it("devuelve texto con raw_content y binario con su referencia", async () => {
      expect(
        await context.reader.getDocument(
          "content/projects/alpha-unit/README.es.md",
        ),
      ).toEqual({
        kind: "text",
        path: "content/projects/alpha-unit/README.es.md",
        blobSha: "1".repeat(40),
        mediaType: "text/markdown",
        language: "es",
        languageEvidence: "suffix",
        rawContent: "# Alpha H1\n",
      });
      const binary = await context.reader.getDocument(
        "content/projects/alpha-unit/preview.png",
      );
      expect(binary).toMatchObject({
        kind: "binary",
        blobSha: "2".repeat(40),
        mediaType: "image/png",
      });
      expect(
        await context.reader.getDocument("content/projects/missing/README.md"),
      ).toBeNull();
    });

    it("ADR-018: getFileBytes sirve texto UTF-8 y binarios desde source_blobs", async () => {
      const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      await context.db.insert(sourceBlobs).values({
        blobSha: "2".repeat(40),
        bytes: pngBytes,
        byteSize: pngBytes.byteLength,
      });

      const text = await context.reader.getFileBytes(
        "content/projects/alpha-unit/README.es.md",
      );
      expect(text).toMatchObject({
        path: "content/projects/alpha-unit/README.es.md",
        mediaType: "text/markdown",
        blobSha: "1".repeat(40),
      });
      expect(new TextDecoder().decode(text!.bytes)).toBe("# Alpha H1\n");

      const binary = await context.reader.getFileBytes(
        "content/projects/alpha-unit/preview.png",
      );
      expect(binary).toMatchObject({
        path: "content/projects/alpha-unit/preview.png",
        mediaType: "image/png",
        blobSha: "2".repeat(40),
      });
      expect(Array.from(binary!.bytes)).toEqual(Array.from(pngBytes));

      expect(
        await context.reader.getFileBytes("content/projects/missing/README.md"),
      ).toBeNull();
    });

    it("getFileBytes devuelve null si falta la fila de source_blobs", async () => {
      expect(
        await context.reader.getFileBytes(
          "content/projects/alpha-unit/preview.png",
        ),
      ).toBeNull();
    });
  });
});

describe("CourseReader sin base de datos", () => {
  const reader = new CourseReader(null);

  it("degrada a null/[] sin lanzar por falta de configuración", async () => {
    expect(await reader.getActiveSnapshot()).toBeNull();
    expect(await reader.getProjectsIndex()).toBeNull();
    expect(await reader.getProject("alpha-unit")).toBeNull();
    expect(await reader.listSubprojects({} as never)).toEqual([]);
    expect(await reader.listContexts()).toEqual([]);
    expect(await reader.getContext("alpha-context")).toBeNull();
    expect(await reader.listContextDocuments({} as never)).toEqual([]);
    expect(await reader.listUnitAssets({} as never)).toEqual([]);
    expect(await reader.listLessons()).toEqual([]);
    expect(await reader.getLesson("beta-lesson")).toBeNull();
    expect(
      await reader.getDocument("content/projects/alpha-unit/README.md"),
    ).toBeNull();
    expect(
      await reader.listLanguageVariants(
        "content/projects/alpha-unit/README.md",
      ),
    ).toEqual([]);
    expect(
      await reader.getFileBytes("content/projects/alpha-unit/preview.png"),
    ).toBeNull();
    expect(
      await reader.resolveDocumentVariant(
        "content/projects/alpha-unit/README.md",
        "en",
      ),
    ).toBeNull();
    expect(await reader.listContexts("en")).toEqual([]);
    expect(await reader.listLessons("en")).toEqual([]);
  });

  it("el resolvedor degradado marca todo como roto sin lanzar", async () => {
    const resolver = await reader.createMarkdownUrlResolver(
      "content/projects/alpha-unit/README.md",
    );
    expect(resolver("https://example.com")).toEqual({
      kind: "broken",
      href: null,
      rawHref: "https://example.com",
    });
  });
});

describe("consultas SQL de las listas", () => {
  it("los listados no seleccionan raw_content; solo lo leen documentos concretos", async () => {
    const statements: string[] = [];
    const { client, db } = await createCourseTestDatabase({
      onQuery: (sql) => statements.push(sql),
    });
    try {
      const reader = new CourseReader(db);
      const repositoryId = await seedRepository(db);
      const snapshotId = await seedSnapshot(db, repositoryId, {
        status: "complete",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
      });
      await db.insert(sourceFiles).values([
        textFile(snapshotId, PROJECTS_ORDER_PATH, {
          rawContent: PROJECTS_README_MD,
          language: "en",
          languageEvidence: "pair-convention",
        }),
        textFile(snapshotId, PROJECTS_PREFERRED_README_PATH, {
          rawContent: PROJECTS_README_ES,
          language: "es",
          languageEvidence: "suffix",
        }),
        textFile(snapshotId, "content/projects/beta-unit/README.es.md", {
          rawContent: "# Beta H1\n",
          language: "es",
          languageEvidence: "suffix",
        }),
      ]);
      await db.insert(sourceProjects).values([
        {
          snapshotId,
          sourcePath: "content/projects/beta-unit",
          title: null,
          canonicalOrder: null,
          preferredReadmePath: "content/projects/beta-unit/README.es.md",
          language: "es",
          languageEvidence: "suffix",
          metadata: {},
        },
      ]);
      await db.insert(sourceContexts).values([
        {
          snapshotId,
          sourcePath: "content/contexts/gamma-context",
          title: null,
          preferredReadmePath: null,
          language: null,
          languageEvidence: null,
          metadata: {},
        },
      ]);

      statements.length = 0;
      const index = await reader.getProjectsIndex();
      await reader.getProject("beta-unit");
      await reader.listContexts();
      await reader.getDocument("content/projects/beta-unit/README.es.md");

      expect(index).not.toBeNull();

      const bulkFileReads = statements.filter(
        (sql) =>
          sql.includes('from "source_files"') && !/raw_content/i.test(sql),
      );
      expect(
        bulkFileReads.length,
        "se esperaba una consulta del mapa de paths sin raw_content",
      ).toBeGreaterThan(0);

      const rawContentReads = statements.filter((sql) =>
        /raw_content/i.test(sql),
      );
      expect(rawContentReads.length).toBeGreaterThan(0);
      for (const sql of rawContentReads) {
        expect(
          sql,
          `lectura de raw_content no acotada a paths concretos: ${sql}`,
        ).toMatch(/path"\s+(?:in\s*\(|=)/);
      }
    } finally {
      await client.close();
    }
  });
});
