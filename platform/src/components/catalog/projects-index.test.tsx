import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  groupProjectsIntoSections,
  ProjectsIndexView,
} from "@/components/catalog/projects-index";
import type {
  CourseTextDocument,
  CourseUnit,
  ProjectsIndex,
} from "@/course/types";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

afterEach(cleanup);

function textDocument(path: string): CourseTextDocument {
  return {
    kind: "text",
    path,
    blobSha: "a".repeat(40),
    mediaType: "text/markdown",
    language: "es",
    languageEvidence: "suffix",
    rawContent: `# ${path}`,
  };
}

function unit(overrides: Partial<CourseUnit> & { slug: string }): CourseUnit {
  const { slug, ...rest } = overrides;
  return {
    kind: "project",
    sourcePath: `content/projects/${slug}`,
    slug,
    parentSlug: null,
    title: slug,
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

function projectsIndex(units: CourseUnit[]): ProjectsIndex {
  return {
    readme: textDocument("content/projects/README.es.md"),
    orderSource: textDocument("content/projects/README.md"),
    units,
  };
}

const resolver: MarkdownUrlResolver = (rawHref) =>
  rawHref.startsWith("./")
    ? {
        kind: "internal",
        href: `/destino/${rawHref.slice(2)}`,
        targetPath: rawHref,
      }
    : { kind: "external", href: rawHref };

describe("groupProjectsIntoSections", () => {
  it("conserva las secciones y el orden recibidos, con los no listados al final", () => {
    const groups = groupProjectsIntoSections([
      unit({ slug: "alpha-unit", order: 0, orderSection: "Sección A" }),
      unit({ slug: "beta-unit", order: 1, orderSection: "Sección A" }),
      unit({ slug: "gamma-unit", order: 2, orderSection: "Sección B" }),
      unit({ slug: "delta-unit" }),
      unit({ slug: "epsilon-unit" }),
    ]);

    expect(groups.map((group) => group.heading)).toEqual([
      "Sección A",
      "Sección B",
      null,
    ]);
    expect(groups[0]?.units.map((item) => item.slug)).toEqual([
      "alpha-unit",
      "beta-unit",
    ]);
    expect(groups[2]?.units.map((item) => item.slug)).toEqual([
      "delta-unit",
      "epsilon-unit",
    ]);
  });

  it("deja pasar el orden recibido sin reordenar dentro de la sección", () => {
    const groups = groupProjectsIntoSections([
      unit({ slug: "beta-unit", order: 3, orderSection: "Sección A" }),
      unit({ slug: "alpha-unit", order: 1, orderSection: "Sección A" }),
    ]);

    expect(groups[0]?.units.map((item) => item.slug)).toEqual([
      "beta-unit",
      "alpha-unit",
    ]);
  });
});

describe("ProjectsIndexView", () => {
  it("F-02/D-14: muestra el marcador literal del README y ningún número sin marcador", () => {
    render(
      <ProjectsIndexView
        index={projectsIndex([
          unit({
            slug: "alpha-unit",
            title: "Alpha",
            order: 0,
            listMarker: "0",
            orderSection: "Sección A",
          }),
          unit({
            slug: "beta-unit",
            title: "Beta",
            order: 1,
            listMarker: "1",
            orderSection: "Sección A",
          }),
          unit({ slug: "gamma-unit", title: "Gamma", order: 80 }),
        ])}
        resolveUrl={resolver}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Sección A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Sin posición en el índice del repositorio",
      }),
    ).toBeInTheDocument();

    const alphaLink = screen.getByRole("link", { name: "Alpha" });
    expect(alphaLink).toHaveAttribute("href", "/projects/alpha-unit");
    expect(
      alphaLink.closest("li")?.querySelector(".tabular-nums")?.textContent,
    ).toBe("0");
    const betaLink = screen.getByRole("link", { name: "Beta" });
    expect(betaLink).toHaveAttribute("href", "/projects/beta-unit");
    expect(
      betaLink.closest("li")?.querySelector(".tabular-nums")?.textContent,
    ).toBe("1");
    const gammaLink = screen.getByRole("link", { name: "Gamma" });
    expect(gammaLink).toHaveAttribute("href", "/projects/gamma-unit");
    expect(gammaLink.closest("li")?.querySelector(".tabular-nums")).toBeNull();
    expect(screen.queryByText("80")).not.toBeInTheDocument();
  });

  it("D-03/F-05: renderiza la descripción compacta como Markdown y el título en texto plano", () => {
    render(
      <ProjectsIndexView
        index={projectsIndex([
          unit({
            slug: "alpha-unit",
            title: "Alpha `con código`",
            order: 0,
            listMarker: "0",
            orderSection: "Sección A",
            description:
              "Texto **en negrita** y un [enlace](./otro-documento.md).",
          }),
        ])}
        resolveUrl={resolver}
      />,
    );

    expect(screen.getByText("en negrita").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "enlace" })).toHaveAttribute(
      "href",
      "/destino/otro-documento.md",
    );
    const compactWrapper = screen.getByText("en negrita").closest("div.w-full");
    expect(compactWrapper).toHaveClass("text-sm");
    expect(compactWrapper).toHaveClass("text-muted-foreground");

    const titleLink = screen.getByRole("link", { name: "Alpha `con código`" });
    expect(titleLink.querySelector("code")).toBeNull();
    expect(titleLink.textContent).toBe("Alpha `con código`");
  });

  it("no emite ?lang en los enlaces de las unidades (idioma global)", () => {
    render(
      <ProjectsIndexView
        index={projectsIndex([
          unit({
            slug: "alpha-unit",
            title: "Alpha",
            order: 0,
            orderSection: "Sección A",
          }),
        ])}
        resolveUrl={resolver}
      />,
    );

    const link = screen.getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute("href", "/projects/alpha-unit");
    expect(link.getAttribute("href")).not.toContain("lang=");
  });

  it("traduce los copys neutros de interfaz al inglés", () => {
    render(
      <ProjectsIndexView
        index={projectsIndex([
          unit({
            slug: "alpha-unit",
            title: "Alpha",
            order: 0,
            orderSection: "Section A",
          }),
          unit({ slug: "beta-unit", title: "Beta" }),
        ])}
        resolveUrl={resolver}
        lang="en"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Section A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "No position in the repository index",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Sin posición en el índice del repositorio"),
    ).not.toBeInTheDocument();
  });

  it("QA-D2: las descripciones usan los copys accesibles del idioma de interfaz", () => {
    const index = projectsIndex([
      unit({
        slug: "alpha-unit",
        title: "Alpha",
        order: 0,
        orderSection: "Section A",
        description: "Consulta [la guía](https://example.com/guia).",
      }),
    ]);

    const { rerender } = render(
      <ProjectsIndexView index={index} resolveUrl={resolver} lang="en" />,
    );

    const englishHints = screen.getAllByText("(opens in a new tab)");
    expect(englishHints.length).toBeGreaterThan(0);
    expect(
      screen.queryAllByText("(se abre en una pestaña nueva)"),
    ).toHaveLength(0);

    rerender(
      <ProjectsIndexView index={index} resolveUrl={resolver} lang="es" />,
    );

    expect(
      screen.getAllByText("(se abre en una pestaña nueva)").length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByText("(opens in a new tab)")).toHaveLength(0);
  });

  it("muestra el estado vacío neutro cuando no hay unidades", () => {
    render(
      <ProjectsIndexView index={projectsIndex([])} resolveUrl={resolver} />,
    );

    expect(
      screen.getByText("No hay proyectos importados."),
    ).toBeInTheDocument();
  });

  it("en inglés el estado vacío también es neutro y traducido", () => {
    render(
      <ProjectsIndexView
        index={projectsIndex([])}
        resolveUrl={resolver}
        lang="en"
      />,
    );

    expect(screen.getByText("No projects imported.")).toBeInTheDocument();
  });

  it("no consulta el resolvedor si no hay descripciones", () => {
    const spy = vi.fn(resolver);
    render(
      <ProjectsIndexView
        index={projectsIndex([
          unit({
            slug: "alpha-unit",
            title: "Alpha",
            order: 0,
            orderSection: "Sección A",
          }),
        ])}
        resolveUrl={spy}
      />,
    );

    expect(spy).not.toHaveBeenCalled();
  });
});
