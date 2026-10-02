import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CourseDocument,
  CourseLanguage,
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
  ProjectsIndex,
  ResolvedDocumentVariant,
} from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getUiLanguage: vi.fn<() => Promise<UiLanguage>>(async () => "es"),
  getActiveSnapshot: vi.fn<() => Promise<CourseSnapshot | null>>(),
  getProjectsIndex:
    vi.fn<(lang?: CourseLanguage) => Promise<ProjectsIndex | null>>(),
  getProject:
    vi.fn<
      (slug: string, lang?: CourseLanguage) => Promise<CourseUnit | null>
    >(),
  getSubproject:
    vi.fn<
      (
        parentSlug: string,
        slug: string,
        lang?: CourseLanguage,
      ) => Promise<CourseUnit | null>
    >(),
  listSubprojects:
    vi.fn<
      (parent: CourseUnit, lang?: CourseLanguage) => Promise<CourseUnit[]>
    >(),
  getDocument: vi.fn<(path: string) => Promise<CourseDocument | null>>(),
  resolveDocumentVariant:
    vi.fn<
      (
        path: string,
        lang: CourseLanguage,
      ) => Promise<ResolvedDocumentVariant | null>
    >(),
  createMarkdownUrlResolver:
    vi.fn<(fromPath: string) => Promise<MarkdownUrlResolver>>(),
  githubBlobUrl: vi.fn<(snapshot: CourseSnapshot, path: string) => string>(),
}));

vi.mock("@/course", () => ({
  ...mocks,
  PROJECTS_DIRECTORY: "content/projects",
  PROJECTS_ORDER_PATH: "content/projects/README.md",
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiLanguage: mocks.getUiLanguage,
}));

vi.mock("next/server", () => ({
  connection: mocks.connection,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import ProjectPage, {
  generateMetadata as projectMetadata,
} from "./[slug]/page";
import SubprojectPage, {
  generateMetadata as subprojectMetadata,
} from "./[slug]/[subslug]/page";
import ProjectsPage from "./page";

const ES_README = "content/projects/alpha-unit/README.es.md";
const EN_README = "content/projects/alpha-unit/README.md";
const ES_INDEX_README = "content/projects/README.es.md";
const EN_INDEX_README = "content/projects/README.md";

const snapshot: CourseSnapshot = {
  snapshotId: "snapshot-alpha",
  owner: "owner-alpha",
  name: "repo-alpha",
  canonicalUrl: "https://example.com/owner-alpha/repo-alpha",
  ref: "main",
  commitSha: "f".repeat(40),
  importedAt: "2026-01-02T03:04:05.000Z",
  status: "complete",
  errorCount: 0,
};

function makeUnit(
  overrides: Partial<CourseUnit> & { slug: string },
): CourseUnit {
  const { slug, ...rest } = overrides;
  return {
    kind: "project",
    sourcePath: `content/projects/${slug}`,
    slug,
    parentSlug: null,
    title: `Título ${slug}`,
    titleOrigin: "source-path",
    description: null,
    order: null,
    listMarker: null,
    orderSection: null,
    preferredDocumentPath: null,
    language: null,
    languageEvidence: null,
    ...rest,
  };
}

function makeDocument(
  path: string,
  rawContent: string,
  language: CourseLanguage = "es",
): CourseTextDocument {
  return {
    kind: "text",
    path,
    blobSha: "b".repeat(40),
    mediaType: "text/markdown",
    language,
    languageEvidence: language === "es" ? "suffix" : "pair-convention",
    rawContent,
  };
}

function makeIndex(
  units: CourseUnit[],
  readme: CourseTextDocument = makeDocument(ES_INDEX_README, "# Índice"),
): ProjectsIndex {
  return {
    readme,
    orderSource: makeDocument(EN_INDEX_README, "# Index", "en"),
    units,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUiLanguage.mockResolvedValue("es");
  mocks.connection.mockImplementation(async () => undefined);
  mocks.getActiveSnapshot.mockResolvedValue(snapshot);
  mocks.getProjectsIndex.mockResolvedValue(null);
  mocks.getProject.mockResolvedValue(null);
  mocks.getSubproject.mockResolvedValue(null);
  mocks.listSubprojects.mockResolvedValue([]);
  mocks.getDocument.mockResolvedValue(null);
  mocks.resolveDocumentVariant.mockImplementation(async (path, lang) => ({
    path,
    language: path === EN_README ? "en" : "es",
    isFallback: path === EN_README && lang !== "en",
  }));
  mocks.createMarkdownUrlResolver.mockResolvedValue((rawHref) => ({
    kind: "broken",
    href: null,
    rawHref,
  }));
  mocks.githubBlobUrl.mockImplementation(
    (current, path) =>
      `https://github.com/${current.owner}/${current.name}/blob/${current.commitSha}/${path}`,
  );
});

afterEach(cleanup);

async function renderProjectsPage(
  searchParams: Record<string, string> = {},
): Promise<void> {
  const ui = await ProjectsPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as never);
  render(ui);
}

async function renderProjectPage(
  slug: string,
  searchParams: Record<string, string> = {},
): Promise<void> {
  const ui = await ProjectPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  } as never);
  render(ui);
}

async function renderSubprojectPage(
  slug: string,
  subslug: string,
  searchParams: Record<string, string> = {},
): Promise<void> {
  const ui = await SubprojectPage({
    params: Promise.resolve({ slug, subslug }),
    searchParams: Promise.resolve(searchParams),
  } as never);
  render(ui);
}

function unitLinks(): HTMLAnchorElement[] {
  return screen
    .getAllByRole("link")
    .filter(
      (link): link is HTMLAnchorElement =>
        link instanceof HTMLAnchorElement &&
        /^\/projects\/[^?]/.test(link.getAttribute("href") ?? ""),
    );
}

function expectNoLanguageSelector(): void {
  expect(
    screen.queryByRole("navigation", { name: "Idioma" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("navigation", { name: "Language" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "English" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Español" }),
  ).not.toBeInTheDocument();
}

describe("ProjectsPage", () => {
  it("muestra el estado neutro (en el idioma global) cuando no hay snapshot", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.getActiveSnapshot.mockResolvedValue(null);

    await renderProjectsPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Content not synced yet",
      }),
    ).toBeInTheDocument();
    expect(mocks.getProjectsIndex).not.toHaveBeenCalled();
  });

  it("usa el README del idioma de la cookie y no emite ?lang en las filas", async () => {
    mocks.getProjectsIndex.mockResolvedValue(
      makeIndex([
        makeUnit({
          slug: "alpha-unit",
          title: "Alpha",
          order: 0,
          listMarker: "0",
          orderSection: "Sección A",
          description: "Descripción **fuerte**.",
        }),
        makeUnit({
          slug: "beta-unit",
          title: "Beta",
          order: 1,
          listMarker: "1",
          orderSection: "Sección A",
        }),
        makeUnit({ slug: "gamma-unit", title: "Gamma" }),
      ]),
    );

    await renderProjectsPage();

    expect(mocks.getProjectsIndex).toHaveBeenCalledWith("es");
    expect(
      screen.getByRole("heading", { level: 2, name: "Sección A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Sin posición en el índice del repositorio",
      }),
    ).toBeInTheDocument();
    expect(unitLinks().map((link) => link.textContent)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    for (const link of unitLinks()) {
      expect(link.getAttribute("href")).not.toContain("lang=");
    }
    expect(screen.getByText("fuerte").tagName).toBe("STRONG");
    // Procedencia del README mostrado (español) con enlace al espejo.
    expect(screen.getByRole("link", { name: /Ver en GitHub/ })).toHaveAttribute(
      "href",
      `https://github.com/owner-alpha/repo-alpha/blob/${snapshot.commitSha}/${ES_INDEX_README}`,
    );
    // El orden se deriva del README del repositorio, que aquí es otro archivo.
    expect(
      screen.getByText("Orden de la lista obtenido de"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: EN_INDEX_README })).toHaveAttribute(
      "href",
      `https://github.com/owner-alpha/repo-alpha/blob/${snapshot.commitSha}/${EN_INDEX_README}`,
    );
    expectNoLanguageSelector();
  });

  it("en inglés pide el índice inglés y traduce los copys de interfaz", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.getProjectsIndex.mockResolvedValue(
      makeIndex(
        [
          makeUnit({
            slug: "alpha-unit",
            title: "Alpha",
            order: 0,
            listMarker: "0",
            orderSection: "Section A",
          }),
        ],
        makeDocument(EN_INDEX_README, "# Index", "en"),
      ),
    );

    await renderProjectsPage();

    expect(mocks.getProjectsIndex).toHaveBeenCalledWith("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Section A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("List order obtained from this document."),
    ).toBeInTheDocument();
    expect(unitLinks()[0]).toHaveAttribute("href", "/projects/alpha-unit");
    expectNoLanguageSelector();
  });

  it("ignora un ?lang heredado sin 404 (lo decide la cookie global)", async () => {
    // L2: se retiró el 404 por `?lang`; el parámetro antiguo se ignora y la
    // variante la decide la cookie global.
    mocks.getProjectsIndex.mockResolvedValue(
      makeIndex([
        makeUnit({
          slug: "alpha-unit",
          title: "Alpha",
          order: 0,
          orderSection: "Sección A",
        }),
      ]),
    );

    await renderProjectsPage({ lang: "fr" });

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getProjectsIndex).toHaveBeenCalledWith("es");
    expect(
      screen.getByRole("heading", { level: 1, name: "Proyectos" }),
    ).toBeInTheDocument();
  });

  it("muestra el estado neutro si la capa course no devuelve índice", async () => {
    mocks.getProjectsIndex.mockResolvedValue(null);

    await renderProjectsPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
  });
});

describe("ProjectPage", () => {
  function seedProject(): void {
    const unit = makeUnit({
      slug: "alpha-unit",
      title: "Título Alpha",
      titleOrigin: "readme-label",
      language: "es",
      preferredDocumentPath: ES_README,
    });
    mocks.getProject.mockResolvedValue(unit);
    mocks.getDocument.mockImplementation(async (path) =>
      path === EN_README
        ? makeDocument(EN_README, "# Alpha English\n\nEnglish body.", "en")
        : makeDocument(ES_README, "# Alpha Español\n\nCuerpo real."),
    );
  }

  it("hace notFound con un slug desconocido", async () => {
    await expect(
      ProjectPage({
        params: Promise.resolve({ slug: "no-existe" }),
        searchParams: Promise.resolve({}),
      } as never),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("renderiza la variante del idioma global con procedencia y vuelta, sin selector", async () => {
    seedProject();

    await renderProjectPage("alpha-unit");

    expect(mocks.getProject).toHaveBeenCalledWith("alpha-unit", "es");
    expect(mocks.resolveDocumentVariant).toHaveBeenCalledWith(ES_README, "es");
    expect(mocks.getDocument).toHaveBeenCalledWith(ES_README);
    // D-01: el único h1 es el del documento; el título de unidad es un <p>.
    expect(
      screen.getByRole("heading", { level: 1, name: "Alpha Español" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Título Alpha").tagName).toBe("P");
    expect(
      screen.queryByRole("heading", { name: "Título Alpha" }),
    ).not.toBeInTheDocument();
    // D-05: el contenedor del documento declara el idioma mostrado.
    expect(screen.getByText("Cuerpo real.").closest("[lang]")).toHaveAttribute(
      "lang",
      "es",
    );
    expect(screen.getByText(/owner-alpha\/repo-alpha/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver en GitHub/ })).toHaveAttribute(
      "href",
      expect.stringContaining(ES_README),
    );
    expect(
      screen.getByRole("link", { name: "Volver a Proyectos" }),
    ).toHaveAttribute("href", "/projects");
    expect(
      screen.queryByRole("navigation", { name: "Subproyectos" }),
    ).not.toBeInTheDocument();
    expectNoLanguageSelector();
  });

  it("en inglés sirve la variante inglesa y los copys de interfaz en inglés", async () => {
    seedProject();
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.getProject.mockImplementation(async (_slug, lang) =>
      lang === "en"
        ? makeUnit({
            slug: "alpha-unit",
            title: "Alpha English Label",
            titleOrigin: "readme-label",
            language: "es",
            preferredDocumentPath: ES_README,
          })
        : null,
    );
    mocks.resolveDocumentVariant.mockResolvedValue({
      path: EN_README,
      language: "en",
      isFallback: false,
    });

    await renderProjectPage("alpha-unit");

    expect(mocks.getProject).toHaveBeenCalledWith("alpha-unit", "en");
    expect(mocks.resolveDocumentVariant).toHaveBeenCalledWith(ES_README, "en");
    expect(mocks.getDocument).toHaveBeenCalledWith(EN_README);
    expect(
      screen.getByRole("heading", { level: 1, name: "Alpha English" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alpha English Label").tagName).toBe("P");
    expect(screen.getByText("English body.").closest("[lang]")).toHaveAttribute(
      "lang",
      "en",
    );
    expect(
      screen.getByRole("link", { name: "Back to Projects" }),
    ).toHaveAttribute("href", "/projects");
    expectNoLanguageSelector();
  });

  it("QA-D2: en inglés el documento y la procedencia no dejan avisos accesibles en español", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.getProject.mockResolvedValue(
      makeUnit({
        slug: "alpha-unit",
        title: "Alpha English Label",
        preferredDocumentPath: ES_README,
      }),
    );
    mocks.resolveDocumentVariant.mockResolvedValue({
      path: EN_README,
      language: "en",
      isFallback: false,
    });
    mocks.getDocument.mockResolvedValue(
      makeDocument(
        EN_README,
        "# Alpha English\n\n[Missing](./missing.md) and [guide](https://example.com).\n",
        "en",
      ),
    );
    mocks.createMarkdownUrlResolver.mockResolvedValue((rawHref) =>
      rawHref.startsWith("http")
        ? { kind: "external", href: rawHref }
        : { kind: "broken", href: null, rawHref },
    );

    await renderProjectPage("alpha-unit");

    expect(screen.getByText("(broken link)")).toBeInTheDocument();
    expect(screen.queryAllByText(/enlace roto/)).toHaveLength(0);
    expect(screen.queryAllByText(/se abre en una pestaña nueva/)).toHaveLength(
      0,
    );
    expect(screen.getAllByText(/opens in a new tab/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "Content provenance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on GitHub/ }),
    ).toBeInTheDocument();
  });

  it("muestra la variante existente con nota de fallback si no hay la pedida", async () => {
    seedProject();
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.resolveDocumentVariant.mockResolvedValue({
      path: ES_README,
      language: "es",
      isFallback: true,
    });

    await renderProjectPage("alpha-unit");

    expect(screen.getByText("Only available in Spanish")).toBeInTheDocument();
    expect(screen.getByText("Cuerpo real.").closest("[lang]")).toHaveAttribute(
      "lang",
      "es",
    );
    expectNoLanguageSelector();
  });

  it("ignora un ?lang heredado y usa la cookie global", async () => {
    seedProject();

    await renderProjectPage("alpha-unit", { lang: "en" });

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getProject).toHaveBeenCalledWith("alpha-unit", "es");
    expect(mocks.resolveDocumentVariant).toHaveBeenCalledWith(ES_README, "es");
    expect(mocks.getDocument).toHaveBeenCalledWith(ES_README);
  });

  it("enlaza los subproyectos derivados en el aside sin ?lang", async () => {
    seedProject();
    mocks.listSubprojects.mockResolvedValue([
      makeUnit({
        slug: "child-unit",
        title: "Hijo Uno",
        kind: "subproject",
        parentSlug: "alpha-unit",
        sourcePath: "content/projects/alpha-unit/child-unit",
        preferredDocumentPath: ES_README,
      }),
      makeUnit({
        slug: "other-child-unit",
        title: "Hijo Dos",
        kind: "subproject",
        parentSlug: "alpha-unit",
        sourcePath: "content/projects/alpha-unit/other-child-unit",
        preferredDocumentPath: ES_README,
      }),
    ]);

    await renderProjectPage("alpha-unit");

    expect(mocks.listSubprojects).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "alpha-unit" }),
      "es",
    );
    const nav = screen.getByRole("navigation", { name: "Subproyectos" });
    const links = nav.querySelectorAll("a");
    expect(Array.from(links).map((link) => link.getAttribute("href"))).toEqual([
      "/projects/alpha-unit/child-unit",
      "/projects/alpha-unit/other-child-unit",
    ]);
  });

  it("D-06: generateMetadata usa el título de la variante del idioma global", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.getProject.mockImplementation(async (_slug, lang) =>
      lang === "en"
        ? makeUnit({
            slug: "alpha-unit",
            title: "Alpha English Label",
            preferredDocumentPath: ES_README,
          })
        : null,
    );

    const metadata = await projectMetadata({
      params: Promise.resolve({ slug: "alpha-unit" }),
      searchParams: Promise.resolve({ lang: "es" }),
    });

    expect(mocks.getProject).toHaveBeenCalledWith("alpha-unit", "en");
    expect(metadata.title).toBe("Alpha English Label");
  });

  it("generateMetadata degrada a un título neutro traducido sin unidad", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");

    const metadata = await projectMetadata({
      params: Promise.resolve({ slug: "no-existe" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe("Project");
  });
});

describe("SubprojectPage", () => {
  const parent = makeUnit({
    slug: "alpha-unit",
    title: "Título Alpha",
    preferredDocumentPath: ES_README,
  });
  const child = makeUnit({
    slug: "child-unit",
    title: "Título Hijo",
    kind: "subproject",
    parentSlug: "alpha-unit",
    sourcePath: "content/projects/alpha-unit/child-unit",
    preferredDocumentPath: ES_README,
  });

  function seedSubproject(): void {
    mocks.getProject.mockResolvedValue(parent);
    mocks.getSubproject.mockResolvedValue(child);
    mocks.getDocument.mockResolvedValue(
      makeDocument(ES_README, "# Documento del subproyecto"),
    );
  }

  it("hace notFound si el proyecto padre no existe", async () => {
    await expect(
      SubprojectPage({
        params: Promise.resolve({ slug: "no-existe", subslug: "child-unit" }),
        searchParams: Promise.resolve({}),
      } as never),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("hace notFound si el subproyecto no existe", async () => {
    mocks.getProject.mockResolvedValue(parent);

    await expect(
      SubprojectPage({
        params: Promise.resolve({ slug: "alpha-unit", subslug: "no-existe" }),
        searchParams: Promise.resolve({}),
      } as never),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renderiza el subproyecto con vuelta al padre y hermanos sin ?lang", async () => {
    seedSubproject();
    mocks.listSubprojects.mockResolvedValue([
      child,
      makeUnit({
        slug: "other-child-unit",
        title: "Título Hermano",
        kind: "subproject",
        parentSlug: "alpha-unit",
        sourcePath: "content/projects/alpha-unit/other-child-unit",
        preferredDocumentPath: ES_README,
      }),
    ]);

    await renderSubprojectPage("alpha-unit", "child-unit");

    expect(mocks.getSubproject).toHaveBeenCalledWith(
      "alpha-unit",
      "child-unit",
      "es",
    );
    // D-01: el h1 es el del documento; el título de unidad queda subordinado.
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Documento del subproyecto",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Título Hijo", { selector: "p" }).tagName).toBe(
      "P",
    );
    expect(
      screen.getByRole("link", { name: "Volver al proyecto" }),
    ).toHaveAttribute("href", "/projects/alpha-unit");
    const nav = screen.getByRole("navigation", { name: "Subproyectos" });
    const current = nav.querySelector("[aria-current='true']");
    expect(current?.textContent).toBe("Título Hijo");
    for (const link of nav.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("lang=");
    }
    expectNoLanguageSelector();
  });

  it("ignora un ?lang heredado y usa la cookie global", async () => {
    seedSubproject();
    mocks.listSubprojects.mockResolvedValue([child]);

    await renderSubprojectPage("alpha-unit", "child-unit", { lang: "xx" });

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getSubproject).toHaveBeenCalledWith(
      "alpha-unit",
      "child-unit",
      "es",
    );
    expect(
      screen.getByRole("link", { name: "Volver al proyecto" }),
    ).toHaveAttribute("href", "/projects/alpha-unit");
  });

  it("generateMetadata usa el idioma global para el título del subproyecto", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");
    mocks.getSubproject.mockResolvedValue(child);

    const metadata = await subprojectMetadata({
      params: Promise.resolve({ slug: "alpha-unit", subslug: "child-unit" }),
      searchParams: Promise.resolve({ lang: "es" }),
    });

    expect(mocks.getSubproject).toHaveBeenCalledWith(
      "alpha-unit",
      "child-unit",
      "en",
    );
    expect(metadata.title).toBe("Título Hijo");
  });
});
