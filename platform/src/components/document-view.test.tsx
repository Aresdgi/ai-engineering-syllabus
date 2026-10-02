import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentView } from "@/components/document-view";

afterEach(cleanup);

describe("DocumentView", () => {
  it("compone título, kicker, procedencia, aside y contenido", () => {
    render(
      <DocumentView
        title="Unidad de ejemplo"
        kicker={<span>Kicker de ejemplo</span>}
        provenance={<div>Procedencia de ejemplo</div>}
        aside={<nav aria-label="Lateral">Lateral</nav>}
        backHref="/destino"
        backLabel="Volver al catálogo"
      >
        <p>Contenido de ejemplo</p>
      </DocumentView>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Unidad de ejemplo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kicker de ejemplo")).toBeInTheDocument();
    expect(screen.getByText("Procedencia de ejemplo")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Lateral" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Contenido de ejemplo")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /volver al catálogo/i }),
    ).toHaveAttribute("href", "/destino");
  });

  it("ignora el slot del selector por página (el selector es global)", () => {
    render(
      <DocumentView
        title="Unidad de ejemplo"
        provenance={<div>Procedencia</div>}
        languageSelector={<div>Selector por página</div>}
      >
        <p>Contenido</p>
      </DocumentView>,
    );

    expect(screen.queryByText("Selector por página")).not.toBeInTheDocument();
  });

  it("omite lo opcional y usa Volver como copia por defecto", () => {
    render(
      <DocumentView
        title="Solo título"
        provenance={<div>Procedencia</div>}
        backHref="/destino"
      >
        <p>Texto</p>
      </DocumentView>,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver$/i })).toHaveAttribute(
      "href",
      "/destino",
    );
  });

  it("en inglés la copia por defecto de volver es Back", () => {
    render(
      <DocumentView
        title="Unidad de ejemplo"
        lang="en"
        provenance={<div>Provenance</div>}
        backHref="/destino"
      >
        <p>Texto</p>
      </DocumentView>,
    );

    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/destino",
    );
  });

  it("D-01: con titleAs='p' el único h1 es el del documento y el título queda subordinado", () => {
    render(
      <DocumentView
        title="Unidad de ejemplo"
        titleAs="p"
        provenance={<div>Procedencia</div>}
      >
        <h1>Documento de ejemplo</h1>
      </DocumentView>,
    );

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName("Documento de ejemplo");

    const unitTitle = screen.getByText("Unidad de ejemplo");
    expect(unitTitle.tagName).toBe("P");
    expect(unitTitle.className).toContain("text-muted-foreground");
  });

  it("D-05: sin idioma de documento explícito, el cuerpo hereda `lang` (compat)", () => {
    const { container } = render(
      <DocumentView
        title="Unidad de ejemplo"
        lang="en"
        provenance={<div>Procedencia</div>}
        aside={<nav aria-label="Lateral">Lateral</nav>}
      >
        <p>Documento en inglés</p>
      </DocumentView>,
    );

    const body = container.querySelector('[lang="en"]');
    expect(body).not.toBeNull();
    expect(body?.contains(screen.getByText("Documento en inglés"))).toBe(true);
    expect(body?.contains(screen.getByText("Unidad de ejemplo"))).toBe(false);
    expect(body?.contains(screen.getByText("Lateral"))).toBe(false);
  });

  it("separa el idioma de interfaz del idioma real del documento", () => {
    const { container } = render(
      <DocumentView
        title="Unidad de ejemplo"
        lang="en"
        documentLanguage="es"
        provenance={<div>Provenance</div>}
      >
        <p>Documento en español</p>
      </DocumentView>,
    );

    const body = container.querySelector('[lang="es"]');
    expect(body).not.toBeNull();
    expect(body?.contains(screen.getByText("Documento en español"))).toBe(true);
    expect(
      screen.queryByText(/only available|solo disponible/i),
    ).not.toBeInTheDocument();
  });

  it("pinta la nota de fallback cuando no hay variante del idioma de interfaz", () => {
    render(
      <DocumentView
        title="Unidad de ejemplo"
        lang="es"
        fallbackLanguage="en"
        provenance={<div>Procedencia</div>}
      >
        <p>Document in English</p>
      </DocumentView>,
    );

    const note = screen.getByText("Solo disponible en inglés");
    const body = document.querySelector('[lang="en"]');
    expect(body?.contains(note)).toBe(true);
  });

  it("la nota de fallback se traduce al inglés", () => {
    render(
      <DocumentView
        title="Sample unit"
        lang="en"
        fallbackLanguage="es"
        provenance={<div>Provenance</div>}
      >
        <p>Documento en español</p>
      </DocumentView>,
    );

    expect(screen.getByText("Only available in Spanish")).toBeInTheDocument();
  });

  it("no pinta nota si el documento ya está en el idioma de interfaz", () => {
    render(
      <DocumentView
        title="Unidad de ejemplo"
        lang="en"
        fallbackLanguage="en"
        provenance={<div>Provenance</div>}
      >
        <p>Document in English</p>
      </DocumentView>,
    );

    expect(
      screen.queryByText(/only available|solo disponible/i),
    ).not.toBeInTheDocument();
  });

  it("D-13: reserva un aside más ancho en lg", () => {
    const { container } = render(
      <DocumentView
        title="Unidad de ejemplo"
        provenance={<div>Procedencia</div>}
        aside={<nav aria-label="Lateral">Lateral</nav>}
      >
        <p>Texto</p>
      </DocumentView>,
    );

    expect(container.querySelector("aside")?.className).toContain("lg:w-72");
  });
});
