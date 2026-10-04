// @vitest-environment node
/**
 * AC-2.9 (política de enlaces, ADR-015): interno / GitHub blob@commit /
 * binary_reference / tree / externo / roto, más el enlace roto real del
 * fixture de contexto. Los paths sintéticos son neutros (AC-0.10).
 */

import { describe, expect, it, vi } from "vitest";

import { sourceFiles, sourceProjects } from "../source/store/schema";
import {
  SOURCE_REPOSITORY_NAME,
  SOURCE_REPOSITORY_OWNER,
} from "../source/types";
import { PostgresExternalArchiveStore } from "../external-archive/store";
import type { NewExternalArchiveItem } from "../external-archive/types";
import {
  fixturesMatching,
  readFixtureEntry,
} from "./fixture-reader.test-helper";
import {
  githubBlobUrl,
  githubTreeUrl,
  normalizeRepositoryUrl,
  resolveMarkdownHref,
  shortSha,
  type MarkdownResolutionContext,
  type ResolverFile,
} from "./links";
import { collectDirectories } from "./path-utils";
import {
  lessonHref,
  projectHref,
  projectsIndexHref,
  sourceFileHref,
  subprojectHref,
} from "./routes";
import type { ExternalArchiveLink } from "./types";
import { CourseReader } from "./reader";
import {
  createCourseTestDatabase,
  seedRepository,
  seedSnapshot,
  TEST_REPOSITORY,
  textFile,
} from "./test-database.test-helper";

vi.mock("server-only", () => ({}));

const COMMIT = "a".repeat(40);

const CANONICAL_URL = "https://github.com/example-org/example-syllabus";

const BINARY_REFERENCE = `https://raw.githubusercontent.com/example-org/example-syllabus/${COMMIT}/content/projects/alpha-unit/.learn/preview.png`;

function testFiles(): Map<string, ResolverFile> {
  return new Map<string, ResolverFile>([
    [
      "content/projects/alpha-unit/README.es.md",
      { kind: "text", language: "es", binaryReference: null },
    ],
    [
      "content/projects/alpha-unit/README.md",
      { kind: "text", language: "en", binaryReference: null },
    ],
    [
      "content/projects/alpha-unit/assets/data.csv",
      { kind: "text", language: null, binaryReference: null },
    ],
    [
      "content/projects/alpha-unit/.learn/preview.png",
      { kind: "binary", language: null, binaryReference: BINARY_REFERENCE },
    ],
    [
      "content/contexts/gamma-context/CONTEXT-gamma.es.md",
      { kind: "text", language: "es", binaryReference: null },
    ],
    [
      "content/notes/with space.md",
      { kind: "text", language: null, binaryReference: null },
    ],
    [
      "content/notes/index.md",
      { kind: "text", language: null, binaryReference: null },
    ],
  ]);
}

function testContext(
  overrides: Partial<MarkdownResolutionContext> = {},
): MarkdownResolutionContext {
  const files = testFiles();
  return {
    fromPath: "content/projects/alpha-unit/README.md",
    sourceLanguage: null,
    repositoryUrl: null,
    files,
    directories: collectDirectories(files.keys()),
    fileHrefs: new Map([
      ["content/projects/alpha-unit/README.es.md", "/projects/alpha-unit"],
      ["content/projects/alpha-unit/README.md", "/projects/alpha-unit?lang=en"],
      [
        "content/contexts/gamma-context/CONTEXT-gamma.es.md",
        "/contexts/gamma-context",
      ],
    ]),
    directoryHrefs: new Map([
      ["content/projects/alpha-unit", "/projects/alpha-unit"],
      ["content/contexts/gamma-context", "/contexts/gamma-context"],
    ]),
    snapshot: { canonicalUrl: CANONICAL_URL, commitSha: COMMIT },
    ...overrides,
  };
}

describe("resolveMarkdownHref (ADR-015)", () => {
  it("deja intactos los enlaces externos y las anclas", () => {
    const context = testContext();
    expect(resolveMarkdownHref("https://example.com/docs", context)).toEqual({
      kind: "external",
      href: "https://example.com/docs",
    });
    expect(resolveMarkdownHref("mailto:alguien@example.com", context)).toEqual({
      kind: "external",
      href: "mailto:alguien@example.com",
    });
    expect(resolveMarkdownHref("#seccion", context)).toEqual({
      kind: "external",
      href: "#seccion",
    });
  });

  it("marca roto cualquier esquema que no sea http(s)/mailto", () => {
    expect(
      resolveMarkdownHref("javascript:alert(1)", testContext()),
    ).toMatchObject({ kind: "broken", href: null });
  });

  it("resuelve un documento con vista interna", () => {
    expect(resolveMarkdownHref("./README.es.md", testContext())).toEqual({
      kind: "internal",
      href: "/projects/alpha-unit",
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("conserva el ancla al resolver una ruta interna", () => {
    expect(resolveMarkdownHref("./README.es.md#pasos", testContext())).toEqual({
      kind: "internal",
      href: "/projects/alpha-unit#pasos",
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("ADR-018: resuelve texto sin vista a /source-files (servido por la app)", () => {
    expect(resolveMarkdownHref("./assets/data.csv", testContext())).toEqual({
      kind: "source",
      href: "/source-files/content/projects/alpha-unit/assets/data.csv",
      targetPath: "content/projects/alpha-unit/assets/data.csv",
      targetKind: "raw",
    });
  });

  it("ADR-018: resuelve binarios a /source-files, sin binary_reference", () => {
    expect(resolveMarkdownHref("./.learn/preview.png", testContext())).toEqual({
      kind: "source",
      href: "/source-files/content/projects/alpha-unit/.learn/preview.png",
      targetPath: "content/projects/alpha-unit/.learn/preview.png",
      targetKind: "raw",
    });
    expect(
      resolveMarkdownHref("./.learn/preview.png", testContext()).href,
    ).not.toContain("raw.githubusercontent.com");
  });

  it("resuelve directorios sin vista a GitHub tree@commit", () => {
    expect(resolveMarkdownHref("./.learn/", testContext())).toEqual({
      kind: "source",
      href: `${CANONICAL_URL}/tree/${COMMIT}/content/projects/alpha-unit/.learn`,
      targetPath: "content/projects/alpha-unit/.learn",
      targetKind: "tree",
    });
  });

  it("resuelve un directorio con vista a ruta interna", () => {
    expect(resolveMarkdownHref("../alpha-unit", testContext())).toEqual({
      kind: "internal",
      href: "/projects/alpha-unit",
      targetPath: "content/projects/alpha-unit",
    });
  });

  it("normaliza ./ ../ y %20 en targets relativos", () => {
    const context = testContext({
      fromPath: "content/notes/index.md",
    });
    expect(resolveMarkdownHref("./with%20space.md", context)).toMatchObject({
      kind: "source",
      targetPath: "content/notes/with space.md",
      href: "/source-files/content/notes/with%20space.md",
    });
    expect(resolveMarkdownHref("./sub/../index.md", context)).toMatchObject({
      kind: "source",
      targetPath: "content/notes/index.md",
    });
  });

  it("trata las rutas absolutas como paths del repo (roto si no existen)", () => {
    expect(resolveMarkdownHref("/forgot-password", testContext())).toEqual({
      kind: "broken",
      href: null,
      rawHref: "/forgot-password",
    });
    expect(
      resolveMarkdownHref(
        "/content/projects/alpha-unit/README.es.md",
        testContext(),
      ),
    ).toMatchObject({
      kind: "internal",
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("marca roto un target inexistente y preserva el href original", () => {
    expect(resolveMarkdownHref("./missing.md", testContext())).toEqual({
      kind: "broken",
      href: null,
      rawHref: "./missing.md",
    });
    expect(
      resolveMarkdownHref("../../../../etc/passwd", testContext()),
    ).toMatchObject({ kind: "broken", rawHref: "../../../../etc/passwd" });
  });

  it("shortSha devuelve los 7 primeros caracteres", () => {
    expect(shortSha(COMMIT)).toBe("aaaaaaa");
  });

  it("sourceFileHref codifica cada segmento del path", () => {
    expect(sourceFileHref("content/notes/with space.md")).toBe(
      "/source-files/content/notes/with%20space.md",
    );
    expect(sourceFileHref("content/projects/alpha-unit/README.es.md")).toBe(
      "/source-files/content/projects/alpha-unit/README.es.md",
    );
  });
});

describe("URLs absolutas del propio repo (F-01)", () => {
  it("resuelve un blob del propio repo a la vista interna conservando el ancla", () => {
    expect(
      resolveMarkdownHref(
        `${CANONICAL_URL}/blob/main/content/projects/alpha-unit/README.es.md#pasos`,
        testContext(),
      ),
    ).toEqual({
      kind: "internal",
      href: "/projects/alpha-unit#pasos",
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("compara owner/name sin distinguir mayúsculas y acepta cualquier ref", () => {
    expect(
      resolveMarkdownHref(
        "https://github.com/EXAMPLE-ORG/Example-Syllabus/tree/v9.9.9/content/projects/alpha-unit",
        testContext(),
      ),
    ).toEqual({
      kind: "internal",
      href: "/projects/alpha-unit",
      targetPath: "content/projects/alpha-unit",
    });
  });

  it("resuelve un texto sin vista a /source-files ignorando ?query", () => {
    expect(
      resolveMarkdownHref(
        `${CANONICAL_URL}/blob/main/content/projects/alpha-unit/assets/data.csv?plain=1`,
        testContext(),
      ),
    ).toEqual({
      kind: "source",
      href: "/source-files/content/projects/alpha-unit/assets/data.csv",
      targetPath: "content/projects/alpha-unit/assets/data.csv",
      targetKind: "raw",
    });
  });

  it("resuelve un raw del propio repo a /source-files", () => {
    expect(
      resolveMarkdownHref(
        `https://raw.githubusercontent.com/example-org/example-syllabus/main/content/projects/alpha-unit/.learn/preview.png`,
        testContext(),
      ),
    ).toEqual({
      kind: "source",
      href: "/source-files/content/projects/alpha-unit/.learn/preview.png",
      targetPath: "content/projects/alpha-unit/.learn/preview.png",
      targetKind: "raw",
    });
  });

  it("decodifica %xx en URLs absolutas del propio repo", () => {
    expect(
      resolveMarkdownHref(
        `https://raw.githubusercontent.com/example-org/example-syllabus/main/content/notes/with%20space.md`,
        testContext({ fromPath: "content/notes/index.md" }),
      ),
    ).toMatchObject({
      kind: "source",
      targetPath: "content/notes/with space.md",
      href: "/source-files/content/notes/with%20space.md",
    });
  });

  it("R-1 re-QA: reconoce refs multisegmento `refs/heads/<rama>` y pinnea el destino", () => {
    expect(
      resolveMarkdownHref(
        `https://raw.githubusercontent.com/example-org/example-syllabus/refs/heads/main/content/projects/alpha-unit/assets/data.csv`,
        testContext(),
      ),
    ).toEqual({
      kind: "source",
      href: "/source-files/content/projects/alpha-unit/assets/data.csv",
      targetPath: "content/projects/alpha-unit/assets/data.csv",
      targetKind: "raw",
    });
    expect(
      resolveMarkdownHref(
        `${CANONICAL_URL}/blob/refs/heads/main/content/projects/alpha-unit/README.es.md#pasos`,
        testContext(),
      ),
    ).toEqual({
      kind: "internal",
      href: "/projects/alpha-unit#pasos",
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("deja intacta la URL si el path no existe en el snapshot", () => {
    const missing = `${CANONICAL_URL}/blob/main/content/projects/missing-unit/README.md`;
    expect(resolveMarkdownHref(missing, testContext())).toEqual({
      kind: "external",
      href: missing,
    });
  });

  it("deja intacta la URL de otro repo aunque el path exista", () => {
    const other = `https://github.com/other-org/other-syllabus/blob/main/content/projects/alpha-unit/README.es.md`;
    expect(resolveMarkdownHref(other, testContext())).toEqual({
      kind: "external",
      href: other,
    });
  });

  it("H-1/H-3: githubTreeUrl pinnea la procedencia de directorios al commit", () => {
    expect(
      githubTreeUrl(
        { canonicalUrl: CANONICAL_URL, commitSha: COMMIT },
        "content/projects/alpha-unit",
      ),
    ).toBe(`${CANONICAL_URL}/tree/${COMMIT}/content/projects/alpha-unit`);
  });
});

describe("espejo configurable SOURCE_MIRROR_REPOSITORY (ADR-018)", () => {
  const MIRROR = "https://github.com/example-user/example-fork";

  it("normaliza slug, URL y URL con .git; ignora valores inválidos", () => {
    expect(normalizeRepositoryUrl("example-user/example-fork")).toBe(MIRROR);
    expect(
      normalizeRepositoryUrl("https://github.com/example-user/example-fork"),
    ).toBe(MIRROR);
    expect(
      normalizeRepositoryUrl(
        "https://github.com/example-user/example-fork.git",
      ),
    ).toBe(MIRROR);
    expect(normalizeRepositoryUrl("")).toBeNull();
    expect(normalizeRepositoryUrl(undefined)).toBeNull();
    expect(normalizeRepositoryUrl("no-es-un-repo")).toBeNull();
  });

  it("githubBlobUrl y githubTreeUrl usan la env cuando no se pasa override", () => {
    vi.stubEnv("SOURCE_MIRROR_REPOSITORY", "example-user/example-fork");
    try {
      const snapshot = { canonicalUrl: CANONICAL_URL, commitSha: COMMIT };
      expect(githubBlobUrl(snapshot, "content/notes/index.md")).toBe(
        `${MIRROR}/blob/${COMMIT}/content/notes/index.md`,
      );
      expect(githubTreeUrl(snapshot, "content/projects/alpha-unit")).toBe(
        `${MIRROR}/tree/${COMMIT}/content/projects/alpha-unit`,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sin espejo cae al repo del snapshot", () => {
    const snapshot = { canonicalUrl: CANONICAL_URL, commitSha: COMMIT };
    expect(githubTreeUrl(snapshot, "content/projects/alpha-unit", null)).toBe(
      `${CANONICAL_URL}/tree/${COMMIT}/content/projects/alpha-unit`,
    );
  });

  it("el resolvedor pinnea los directorios sin vista al espejo", () => {
    expect(
      resolveMarkdownHref("./.learn/", testContext({ repositoryUrl: MIRROR })),
    ).toEqual({
      kind: "source",
      href: `${MIRROR}/tree/${COMMIT}/content/projects/alpha-unit/.learn`,
      targetPath: "content/projects/alpha-unit/.learn",
      targetKind: "tree",
    });
  });

  it("con espejo, ningún href generado apunta al repo de origen", () => {
    vi.stubEnv("SOURCE_MIRROR_REPOSITORY", "example-user/example-fork");
    try {
      const origin = `https://github.com/${SOURCE_REPOSITORY_OWNER}/${SOURCE_REPOSITORY_NAME}`;
      const snapshot = { canonicalUrl: origin, commitSha: COMMIT };
      const context = testContext({ repositoryUrl: MIRROR, snapshot });
      const resolutions = [
        githubBlobUrl(snapshot, "content/notes/index.md"),
        githubTreeUrl(snapshot, "content/projects/alpha-unit"),
        resolveMarkdownHref("./.learn/", context),
        resolveMarkdownHref("./assets/data.csv", context),
        resolveMarkdownHref("./README.es.md", context),
      ];
      for (const resolution of resolutions) {
        const href =
          typeof resolution === "string" ? resolution : resolution.href;
        expect(href).not.toContain(SOURCE_REPOSITORY_OWNER);
        expect(href).not.toContain(SOURCE_REPOSITORY_NAME);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("idioma global en enlaces internos (ADR-018)", () => {
  it("cambia el idioma global al enlazar la variante de otro idioma", () => {
    expect(
      resolveMarkdownHref(
        "./README.es.md",
        testContext({ sourceLanguage: "en" }),
      ),
    ).toEqual({
      kind: "internal",
      href: `/preferences/language/es?next=${encodeURIComponent("/projects/alpha-unit")}`,
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("conserva el ancla dentro del `next` seguro", () => {
    expect(
      resolveMarkdownHref(
        "./README.es.md#pasos",
        testContext({ sourceLanguage: "en" }),
      ),
    ).toEqual({
      kind: "internal",
      href: `/preferences/language/es?next=${encodeURIComponent("/projects/alpha-unit#pasos")}`,
      targetPath: "content/projects/alpha-unit/README.es.md",
    });
  });

  it("no envuelve si el idioma de origen es desconocido o coincide", () => {
    expect(
      resolveMarkdownHref(
        "./README.es.md",
        testContext({ sourceLanguage: null }),
      ),
    ).toMatchObject({ kind: "internal", href: "/projects/alpha-unit" });
    expect(
      resolveMarkdownHref(
        "./README.es.md",
        testContext({ sourceLanguage: "es" }),
      ),
    ).toMatchObject({ kind: "internal", href: "/projects/alpha-unit" });
  });

  it("los href internos ya no emiten ?lang (idioma global)", () => {
    expect(projectsIndexHref("en")).toBe("/projects");
    expect(projectHref("alpha-unit", "en")).toBe("/projects/alpha-unit");
    expect(subprojectHref("alpha-unit", "child-one", "en")).toBe(
      "/projects/alpha-unit/child-one",
    );
    expect(lessonHref("beta-lesson", "es")).toBe("/lessons/beta-lesson");
  });
});

describe("resolvedor con el enlace roto real del fixture de contexto", () => {
  const fixtureEntry = fixturesMatching(
    (entry) =>
      entry.path.includes("/data-pipelines/") && entry.path.endsWith(".es.md"),
  )[0];

  it("el fixture contiene un enlace relativo roto en el origen", () => {
    expect(fixtureEntry).toBeDefined();
    const content = readFixtureEntry(fixtureEntry!);
    const target = /\]\((\.[^)\s]+)\)/.exec(content)?.[1];
    expect(target).toBeDefined();
    expect(target?.startsWith("./")).toBe(true);
    expect(target?.endsWith(".md")).toBe(true);

    const result = resolveMarkdownHref(target!, {
      fromPath: fixtureEntry!.path,
      files: new Map([
        [
          fixtureEntry!.path,
          { kind: "text", language: null, binaryReference: null },
        ],
      ]),
      directories: collectDirectories([fixtureEntry!.path]),
      fileHrefs: new Map(),
      directoryHrefs: new Map(),
      snapshot: {
        canonicalUrl: CANONICAL_URL,
        commitSha: fixtureEntry!.commit,
      },
    });
    expect(result).toEqual({ kind: "broken", href: null, rawHref: target });
  });

  it("la capa de lectura marca el mismo enlace como roto (PGlite)", async () => {
    const { client, db } = await createCourseTestDatabase();
    try {
      const repositoryId = await seedRepository(db);
      const snapshotId = await seedSnapshot(db, repositoryId, {
        status: "complete",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
        commitSha: fixtureEntry!.commit,
      });
      await db.insert(sourceFiles).values([
        textFile(snapshotId, fixtureEntry!.path, {
          blobSha: fixtureEntry!.blob_sha,
          rawContent: readFixtureEntry(fixtureEntry!),
          language: "es",
          languageEvidence: "suffix",
        }),
      ]);

      const reader = new CourseReader(db);
      const resolver = await reader.createMarkdownUrlResolver(
        fixtureEntry!.path,
      );
      const content = readFixtureEntry(fixtureEntry!);
      const target = /\]\((\.[^)\s]+)\)/.exec(content)![1]!;
      expect(resolver(target)).toEqual({
        kind: "broken",
        href: null,
        rawHref: target,
      });
    } finally {
      await client.close();
    }
  });
});

describe("resolvedor con URLs absolutas del propio repo (F-01, PGlite)", () => {
  it("usa la vista interna y deja intacto lo que no existe en el snapshot", async () => {
    const { client, db } = await createCourseTestDatabase();
    try {
      const repositoryId = await seedRepository(db);
      const snapshotId = await seedSnapshot(db, repositoryId, {
        status: "complete",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
      });
      await db.insert(sourceProjects).values({
        snapshotId,
        sourcePath: "content/projects/alpha-unit",
        title: null,
        canonicalOrder: null,
        preferredReadmePath: "content/projects/alpha-unit/README.es.md",
        language: "es",
        languageEvidence: "suffix",
        metadata: {},
      });
      await db.insert(sourceFiles).values([
        textFile(snapshotId, "content/projects/alpha-unit/README.es.md", {
          rawContent: "# Alpha\n",
          language: "es",
          languageEvidence: "suffix",
        }),
        textFile(snapshotId, "content/projects/alpha-unit/README.md", {
          rawContent: "# Alpha English\n",
          language: "en",
          languageEvidence: "pair-convention",
        }),
      ]);

      const reader = new CourseReader(db);
      const resolver = await reader.createMarkdownUrlResolver(
        "content/projects/alpha-unit/README.md",
      );
      const base = TEST_REPOSITORY.canonicalUrl;
      // El documento de origen es la variante inglesa: enlazar la española
      // pasa por el cambio de idioma global antes de navegar.
      expect(
        resolver(`${base}/blob/main/content/projects/alpha-unit/README.es.md`),
      ).toEqual({
        kind: "internal",
        href: `/preferences/language/es?next=${encodeURIComponent("/projects/alpha-unit")}`,
        targetPath: "content/projects/alpha-unit/README.es.md",
      });

      const missing = `${base}/tree/main/content/projects/missing-unit`;
      expect(resolver(missing)).toEqual({ kind: "external", href: missing });
    } finally {
      await client.close();
    }
  });
});

describe("índice de material externo archivado en el resolvedor (Hito 2.5)", () => {
  const CAPTURED_LESSON_URL =
    "https://4geeks.com/lesson/how-to-start-a-project";
  const CAPTURED_LESSON_HREF =
    "/archive/4geeks.com/lesson/how-to-start-a-project";
  const RETIRED_LESSON_URL =
    "https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion";
  const RETIRED_LESSON_HREF =
    "/archive/4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion";
  const TOOL_WITH_BACKUP_URL =
    "https://playground.4geeks.com/tracker/api/v1/docs";
  const TOOL_WITH_BACKUP_WAYBACK_URL =
    "http://web.archive.org/web/20260613092255/https://playground.4geeks.com/tracker/api/v1/docs";
  const TOOL_WITH_BACKUP_CAPTURED_AT = "2026-06-13T09:22:55.000Z";
  const TOOL_WITHOUT_BACKUP_URL = "https://diagram.4geeks.com";
  const MARKETING_COMPARE_URL =
    "https://4geeksacademy.com/es/comparar-programas";
  const MARKETING_HOME_URL = "https://4geeks.com";

  function archiveLink(
    overrides: Partial<ExternalArchiveLink> &
      Pick<ExternalArchiveLink, "id" | "canonicalUrl" | "kind">,
  ): ExternalArchiveLink {
    return {
      language: null,
      status: "captured",
      href: null,
      waybackUrl: null,
      waybackCapturedAt: null,
      aliasOfCanonicalUrl: null,
      ...overrides,
    };
  }

  function archiveContext(
    links: readonly ExternalArchiveLink[],
  ): MarkdownResolutionContext {
    return testContext({
      externalArchive: new Map(links.map((link) => [link.canonicalUrl, link])),
    });
  }

  it("AC-2.5.4: una lección capturada abre la copia archivada con su URL original", () => {
    const context = archiveContext([
      archiveLink({
        id: "archive-lesson-en",
        canonicalUrl: CAPTURED_LESSON_URL,
        kind: "lesson",
        language: "en",
        href: CAPTURED_LESSON_HREF,
      }),
    ]);

    expect(resolveMarkdownHref(CAPTURED_LESSON_URL, context)).toEqual({
      kind: "external-archive",
      href: CAPTURED_LESSON_HREF,
      originalHref: CAPTURED_LESSON_URL,
      archiveId: "archive-lesson-en",
    });
  });

  it("AC-2.5.4: canonicaliza la barra final y conserva la URL original del enlace", () => {
    const context = archiveContext([
      archiveLink({
        id: "archive-lesson-en",
        canonicalUrl: CAPTURED_LESSON_URL,
        kind: "lesson",
        language: "en",
        href: CAPTURED_LESSON_HREF,
      }),
    ]);

    const withSlash = `${CAPTURED_LESSON_URL}/`;
    expect(resolveMarkdownHref(withSlash, context)).toEqual({
      kind: "external-archive",
      href: CAPTURED_LESSON_HREF,
      originalHref: withSlash,
      archiveId: "archive-lesson-en",
    });
  });

  it("§8: una URL retirada (alias) abre su página /archive/…", () => {
    const context = archiveContext([
      archiveLink({
        id: "archive-lesson-retired",
        canonicalUrl: RETIRED_LESSON_URL,
        kind: "lesson",
        language: "es",
        status: "alias",
        href: RETIRED_LESSON_HREF,
        aliasOfCanonicalUrl:
          "https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion",
      }),
    ]);

    expect(resolveMarkdownHref(RETIRED_LESSON_URL, context)).toEqual({
      kind: "external-archive",
      href: RETIRED_LESSON_HREF,
      originalHref: RETIRED_LESSON_URL,
      archiveId: "archive-lesson-retired",
    });
  });

  it("AC-2.5.5: una herramienta con respaldo Wayback conserva el original y añade backup", () => {
    const context = archiveContext([
      archiveLink({
        id: "archive-tool-docs",
        canonicalUrl: TOOL_WITH_BACKUP_URL,
        kind: "tool",
        waybackUrl: TOOL_WITH_BACKUP_WAYBACK_URL,
        waybackCapturedAt: TOOL_WITH_BACKUP_CAPTURED_AT,
      }),
    ]);

    expect(resolveMarkdownHref(TOOL_WITH_BACKUP_URL, context)).toEqual({
      kind: "external",
      href: TOOL_WITH_BACKUP_URL,
      backup: {
        href: TOOL_WITH_BACKUP_WAYBACK_URL,
        capturedAt: TOOL_WITH_BACKUP_CAPTURED_AT,
      },
    });
  });

  it("AC-2.5.5: una herramienta sin respaldo queda como externa intacta", () => {
    const context = archiveContext([
      archiveLink({
        id: "archive-tool-diagram",
        canonicalUrl: TOOL_WITHOUT_BACKUP_URL,
        kind: "tool",
      }),
    ]);

    expect(resolveMarkdownHref(TOOL_WITHOUT_BACKUP_URL, context)).toEqual({
      kind: "external",
      href: TOOL_WITHOUT_BACKUP_URL,
    });
  });

  it("AC-2.5.6: el marketing real queda idéntico aunque haya índice", () => {
    const context = archiveContext([
      archiveLink({
        id: "archive-lesson-en",
        canonicalUrl: CAPTURED_LESSON_URL,
        kind: "lesson",
        language: "en",
        href: CAPTURED_LESSON_HREF,
      }),
    ]);

    for (const url of [MARKETING_COMPARE_URL, MARKETING_HOME_URL]) {
      expect(resolveMarkdownHref(url, context)).toEqual({
        kind: "external",
        href: url,
      });
    }
  });

  it("sin índice, los enlaces externos mantienen el comportamiento del Hito 2", () => {
    const context = testContext();
    expect(context.externalArchive).toBeUndefined();
    expect(resolveMarkdownHref(CAPTURED_LESSON_URL, context)).toEqual({
      kind: "external",
      href: CAPTURED_LESSON_URL,
    });
    expect(
      resolveMarkdownHref("mailto:alguien@example.com", archiveContext([])),
    ).toEqual({ kind: "external", href: "mailto:alguien@example.com" });
  });

  it("AC-2.5.4 (PGlite): el CourseReader construye el índice y abre la copia archivada", async () => {
    const { client, db } = await createCourseTestDatabase();
    try {
      const repositoryId = await seedRepository(db);
      const snapshotId = await seedSnapshot(db, repositoryId, {
        status: "complete",
        importedAt: new Date("2026-10-02T10:00:00.000Z"),
      });
      await db.insert(sourceFiles).values([
        textFile(snapshotId, "content/projects/alpha-unit/README.md", {
          rawContent: "# Alpha\n",
          language: "en",
          languageEvidence: "suffix",
        }),
      ]);
      const archiveItem: NewExternalArchiveItem = {
        originalUrl: CAPTURED_LESSON_URL,
        canonicalUrl: CAPTURED_LESSON_URL,
        kind: "lesson",
        host: "4geeks.com",
        language: "en",
        title: "How to start coding a project",
        content: "# Literal archived body\n",
        contentSha256: "9".repeat(64),
        contentFormat: "markdown",
        sourceRepository: "example-org/example-content",
        sourceCommit: "c".repeat(40),
        sourcePath: "content/how-to-start-a-project.md",
        capturedAt: "2026-10-02T10:00:00.000Z",
        method: "registry-api+github-raw",
        httpStatus: 200,
        status: "captured",
      };
      await new PostgresExternalArchiveStore(db).upsertItem(archiveItem);

      const reader = new CourseReader(db);
      const resolver = await reader.createMarkdownUrlResolver(
        "content/projects/alpha-unit/README.md",
      );

      expect(resolver(CAPTURED_LESSON_URL)).toEqual({
        kind: "external-archive",
        href: CAPTURED_LESSON_HREF,
        originalHref: CAPTURED_LESSON_URL,
        archiveId: expect.any(String),
      });
      expect(resolver(MARKETING_COMPARE_URL)).toEqual({
        kind: "external",
        href: MARKETING_COMPARE_URL,
      });
    } finally {
      await client.close();
    }
  });
});
