import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContextsDetail } from "@/components/catalog/contexts-detail";
import type {
  CourseFileEntry,
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

afterEach(cleanup);

const SNAPSHOT: CourseSnapshot = {
  snapshotId: "snapshot-alpha",
  owner: "owner-alpha",
  name: "repo-alpha",
  canonicalUrl: "https://github.example.invalid/owner-alpha/repo-alpha",
  ref: "main",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  importedAt: "2026-01-02T03:04:05.000Z",
  status: "complete",
  errorCount: 0,
};

const ALPHA_PREFERRED = "content/contexts/alpha-unit/CONTEXT-alpha.es.md";
const ALPHA_SECONDARY = "content/contexts/alpha-unit/CONTEXT-alpha.md";
const ALPHA_NESTED = "content/contexts/alpha-unit/sub/CONTEXT-beta.es.md";
const BETA_NESTED = "content/contexts/beta-unit/sub/CONTEXT-beta.es.md";

function contextUnit(
  slug: string,
  preferredDocumentPath: string | null,
): CourseUnit {
  return {
    kind: "context",
    sourcePath: `content/contexts/${slug}`,
    slug,
    parentSlug: null,
    title: `${slug} title`,
    titleOrigin: "document-h1",
    description: null,
    order: null,
    listMarker: null,
    orderSection: null,
    preferredDocumentPath,
    language: preferredDocumentPath === null ? null : "es",
    languageEvidence: preferredDocumentPath === null ? null : "suffix",
  };
}

type EntryOptions = {
  language?: "es" | "en" | null;
  isFallback?: boolean;
  href?: string;
};

function entry(
  path: string,
  relativePath: string,
  options: EntryOptions = {},
): CourseFileEntry {
  return {
    path,
    relativePath,
    mediaType: "text/markdown",
    kind: "text",
    language: options.language ?? null,
    isFallback: options.isFallback,
    href: options.href ?? "#",
    hrefKind: "internal",
  };
}

function textDocument(
  path: string,
  rawContent: string,
  language: "es" | "en" = "es",
): CourseTextDocument {
  return {
    kind: "text",
    path,
    blobSha: "blob-alpha",
    mediaType: "text/markdown",
    language,
    languageEvidence: language === "es" ? "suffix" : "pair-convention",
    rawContent,
  };
}

const RESOLVER: MarkdownUrlResolver = (rawHref) => ({
  kind: "broken",
  href: null,
  rawHref,
});

const ASSET: CourseFileEntry = {
  path: "content/contexts/alpha-unit/brief.pdf",
  relativePath: "brief.pdf",
  mediaType: "application/pdf",
  kind: "binary",
  language: null,
  href: "/source-files/content/contexts/alpha-unit/brief.pdf",
  hrefKind: "source",
};

describe("ContextsDetail con documento seleccionado", () => {
  function renderSelected(
    document: CourseTextDocument = textDocument(
      ALPHA_PREFERRED,
      "# Alpha unit\n\nTexto alpha.",
    ),
    overrides: {
      fallbackLanguage?: "es" | "en" | null;
      documents?: CourseFileEntry[];
      lang?: "es" | "en";
    } = {},
  ) {
    return render(
      <ContextsDetail
        snapshot={SNAPSHOT}
        unit={contextUnit("alpha-unit", ALPHA_PREFERRED)}
        documents={
          overrides.documents ?? [
            entry(ALPHA_PREFERRED, "CONTEXT-alpha.es.md", {
              language: "es",
              href: "/contexts/alpha-unit",
            }),
            entry(ALPHA_SECONDARY, "CONTEXT-alpha.md", {
              language: "en",
              href: "/contexts/alpha-unit?doc=CONTEXT-alpha.md",
            }),
            entry(ALPHA_NESTED, "sub/CONTEXT-beta.es.md", {
              language: "es",
              href: "/contexts/alpha-unit?doc=sub%2FCONTEXT-beta.es.md",
            }),
          ]
        }
        assets={[ASSET]}
        selectedDocument={document}
        fallbackLanguage={overrides.fallbackLanguage ?? null}
        lang={overrides.lang}
        resolver={RESOLVER}
      />,
    );
  }

  it("renderiza el documento, su procedencia y la navegación lateral", () => {
    renderSelected();

    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Procedencia del contenido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Documentos" }),
    ).toBeInTheDocument();

    const current = screen.getByRole("link", {
      name: "CONTEXT-alpha.es.md",
    });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveAttribute("href", "/contexts/alpha-unit");
    expect(
      screen.getByRole("link", { name: "sub/CONTEXT-beta.es.md" }),
    ).toHaveAttribute(
      "href",
      "/contexts/alpha-unit?doc=sub%2FCONTEXT-beta.es.md",
    );
  });

  it("D-01: el título de cabecera es el slug y el único h1 es el del documento", () => {
    const { container } = renderSelected();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName("Alpha unit");
    expect(
      screen.queryByRole("heading", { name: "alpha-unit" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("alpha-unit")).toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("D-05: el contenedor del documento lleva el lang del documento mostrado", () => {
    const { container } = renderSelected(
      textDocument(ALPHA_SECONDARY, "# Alpha unit\n\nEnglish text.", "en"),
    );

    const english = container.querySelector("div[lang='en']");
    expect(english).not.toBeNull();
    expect(english?.textContent).toContain("English text.");
  });

  it("con fallback marca la variante en el aside y muestra la nota neutra", () => {
    renderSelected(
      textDocument(ALPHA_PREFERRED, "# Alpha unit\n\nTexto alpha.", "es"),
      {
        fallbackLanguage: "es",
        documents: [
          entry(ALPHA_PREFERRED, "CONTEXT-alpha.es.md", {
            language: "es",
            isFallback: true,
            href: "/contexts/alpha-unit",
          }),
        ],
        lang: "en",
      },
    );

    const fallback = screen.getByRole("link", {
      name: /CONTEXT-alpha\.es\.md/,
    });
    expect(fallback).toHaveTextContent("Only available in Spanish");
    // Nota del cuerpo + marca de fallback en el aside.
    expect(
      screen.getAllByText("Only available in Spanish").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("lista los archivos no Markdown con su URL servida por la app y su tipo", () => {
    renderSelected();

    expect(
      screen.getByRole("heading", { name: "Archivos" }),
    ).toBeInTheDocument();
    const assetLink = screen.getByRole("link", { name: /brief\.pdf/ });
    expect(assetLink).toHaveAttribute("href", ASSET.href);
    expect(assetLink).toHaveAttribute("target", "_blank");
    expect(assetLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(assetLink.className).toContain("decoration-muted-foreground");
    expect(assetLink.className).not.toContain("decoration-border");
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });

  it("con lang=en traduce los copys de interfaz y no renderiza selector por página", () => {
    renderSelected(
      textDocument(ALPHA_PREFERRED, "# Alpha unit\n\nTexto alpha."),
      { lang: "en" },
    );

    expect(
      screen.getByRole("navigation", { name: "Documents" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Files" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Contexts" }),
    ).toHaveAttribute("href", "/contexts");
    expect(
      screen.queryByRole("navigation", { name: "Idioma" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Language" }),
    ).not.toBeInTheDocument();
  });
});

describe("ContextsDetail sin documento preferido", () => {
  it("H-1: sin documento seleccionado muestra la procedencia del directorio de la unidad", () => {
    render(
      <ContextsDetail
        snapshot={SNAPSHOT}
        unit={contextUnit("beta-unit", null)}
        documents={[
          entry(BETA_NESTED, "sub/CONTEXT-beta.es.md", {
            language: "es",
            href: "/contexts/beta-unit?doc=sub%2FCONTEXT-beta.es.md",
          }),
        ]}
        assets={[]}
        selectedDocument={null}
        resolver={null}
      />,
    );

    expect(
      screen.getByText("Selecciona un documento de la lista para leerlo aquí."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "sub/CONTEXT-beta.es.md" }),
    ).toHaveAttribute(
      "href",
      "/contexts/beta-unit?doc=sub%2FCONTEXT-beta.es.md",
    );
    expect(
      screen.queryByRole("navigation", { name: "Documentos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Texto alpha.")).not.toBeInTheDocument();

    const region = screen.getByRole("region", {
      name: "Procedencia del contenido",
    });
    expect(
      within(region).getAllByText("content/contexts/beta-unit").length,
    ).toBeGreaterThan(0);
    expect(
      within(region).getByRole("link", { name: /Ver en GitHub/ }),
    ).toHaveAttribute(
      "href",
      `${SNAPSHOT.canonicalUrl}/tree/${SNAPSHOT.commitSha}/content/contexts/beta-unit`,
    );
    expect(within(region).queryByText("Blob completo")).not.toBeInTheDocument();
  });

  it("sin documento seleccionado el slug de la unidad es el título de la vista", () => {
    render(
      <ContextsDetail
        snapshot={SNAPSHOT}
        unit={contextUnit("beta-unit", null)}
        documents={[entry(BETA_NESTED, "sub/CONTEXT-beta.es.md")]}
        assets={[]}
        selectedDocument={null}
        resolver={null}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "beta-unit" }),
    ).toBeInTheDocument();
  });
});
