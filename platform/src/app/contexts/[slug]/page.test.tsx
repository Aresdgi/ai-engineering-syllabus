import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CourseFileEntry,
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
}));

const i18nMocks = vi.hoisted(() => ({
  getUiLanguage: vi.fn(async () => "es" as "es" | "en"),
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiLanguage: i18nMocks.getUiLanguage,
}));

const courseMocks = vi.hoisted(() => ({
  getActiveSnapshot: vi.fn(),
  getContext: vi.fn(),
  listContextDocuments: vi.fn(),
  listUnitAssets: vi.fn(),
  getDocument: vi.fn(),
  resolveDocumentVariant: vi.fn(),
  createMarkdownUrlResolver: vi.fn(),
}));

vi.mock("@/course", () => ({
  getActiveSnapshot: courseMocks.getActiveSnapshot,
  getContext: courseMocks.getContext,
  listContextDocuments: courseMocks.listContextDocuments,
  listUnitAssets: courseMocks.listUnitAssets,
  getDocument: courseMocks.getDocument,
  resolveDocumentVariant: courseMocks.resolveDocumentVariant,
  createMarkdownUrlResolver: courseMocks.createMarkdownUrlResolver,
}));

import ContextPage, { generateMetadata } from "@/app/contexts/[slug]/page";

afterEach(() => {
  cleanup();
  i18nMocks.getUiLanguage.mockResolvedValue("es");
});

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
    href: options.href ?? `/contexts/alpha-unit?doc=${relativePath}`,
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

const ASSET: CourseFileEntry = {
  path: "content/contexts/alpha-unit/brief.pdf",
  relativePath: "brief.pdf",
  mediaType: "application/pdf",
  kind: "binary",
  language: null,
  href: "/source-files/content/contexts/alpha-unit/brief.pdf",
  hrefKind: "source",
};

const RESOLVER: MarkdownUrlResolver = (rawHref) => ({
  kind: "broken",
  href: null,
  rawHref,
});

function renderPage(
  slug: string,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return ContextPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  courseMocks.getActiveSnapshot.mockResolvedValue(SNAPSHOT);
  courseMocks.getContext.mockResolvedValue(null);
  courseMocks.listContextDocuments.mockResolvedValue([]);
  courseMocks.listUnitAssets.mockResolvedValue([]);
  courseMocks.getDocument.mockResolvedValue(null);
  courseMocks.resolveDocumentVariant.mockResolvedValue(null);
  courseMocks.createMarkdownUrlResolver.mockResolvedValue(RESOLVER);
});

describe("ContextPage", () => {
  it("muestra el documento preferido en el idioma global con procedencia y archivos servidos por la app", async () => {
    const unit = contextUnit("alpha-unit", ALPHA_PREFERRED);
    courseMocks.getContext.mockResolvedValue(unit);
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(ALPHA_PREFERRED, "CONTEXT-alpha.es.md", {
        language: "es",
        href: "/contexts/alpha-unit",
      }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: ALPHA_PREFERRED,
      language: "es",
      isFallback: false,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(ALPHA_PREFERRED, "# Alpha unit\n\nTexto alpha."),
    );
    courseMocks.listUnitAssets.mockResolvedValue([ASSET]);

    render(await renderPage("alpha-unit"));

    expect(courseMocks.getContext).toHaveBeenCalledWith("alpha-unit", "es");
    expect(courseMocks.resolveDocumentVariant).toHaveBeenCalledWith(
      ALPHA_PREFERRED,
      "es",
    );
    expect(courseMocks.getDocument).toHaveBeenCalledWith(ALPHA_PREFERRED);
    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Procedencia del contenido" }),
    ).toBeInTheDocument();
    const assetLink = screen.getByRole("link", { name: /brief\.pdf/ });
    expect(assetLink).toHaveAttribute("href", ASSET.href);
    expect(assetLink).toHaveAttribute("target", "_blank");
    expect(assetLink.className).toContain("decoration-muted-foreground");
    expect(assetLink.className).not.toContain("decoration-border");
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });

  it("?doc apuntando a la variante inglesa muestra la variante del idioma global", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    const unit = contextUnit("alpha-unit", ALPHA_PREFERRED);
    courseMocks.getContext.mockResolvedValue(unit);
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(ALPHA_SECONDARY, "CONTEXT-alpha.md", {
        language: "en",
        href: "/contexts/alpha-unit?doc=CONTEXT-alpha.md",
      }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: ALPHA_SECONDARY,
      language: "en",
      isFallback: false,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(ALPHA_SECONDARY, "# Alpha unit\n\nEnglish text.", "en"),
    );

    render(await renderPage("alpha-unit", { doc: "CONTEXT-alpha.es.md" }));

    expect(courseMocks.getContext).toHaveBeenCalledWith("alpha-unit", "en");
    expect(courseMocks.resolveDocumentVariant).toHaveBeenCalledWith(
      ALPHA_PREFERRED,
      "en",
    );
    expect(courseMocks.getDocument).toHaveBeenCalledWith(ALPHA_SECONDARY);
    expect(screen.getByText("English text.")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Documents" }),
    ).toBeInTheDocument();
  });

  it("?lang de URLs antiguas se ignora sin 404", async () => {
    const unit = contextUnit("alpha-unit", ALPHA_PREFERRED);
    courseMocks.getContext.mockResolvedValue(unit);
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(ALPHA_PREFERRED, "CONTEXT-alpha.es.md", { language: "es" }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: ALPHA_PREFERRED,
      language: "es",
      isFallback: false,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(ALPHA_PREFERRED, "# Alpha unit\n\nTexto alpha."),
    );

    render(await renderPage("alpha-unit", { lang: "xx" }));

    expect(courseMocks.getContext).toHaveBeenCalledWith("alpha-unit", "es");
    expect(courseMocks.resolveDocumentVariant).toHaveBeenCalledWith(
      ALPHA_PREFERRED,
      "es",
    );
    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
  });

  it("marca la nota neutra cuando solo existe la variante del otro idioma", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    const unit = contextUnit("alpha-unit", ALPHA_PREFERRED);
    courseMocks.getContext.mockResolvedValue(unit);
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(ALPHA_PREFERRED, "CONTEXT-alpha.es.md", {
        language: "es",
        isFallback: true,
        href: "/contexts/alpha-unit",
      }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: ALPHA_PREFERRED,
      language: "es",
      isFallback: true,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(ALPHA_PREFERRED, "# Alpha unit\n\nTexto alpha."),
    );

    const { container } = render(await renderPage("alpha-unit"));

    expect(courseMocks.getDocument).toHaveBeenCalledWith(ALPHA_PREFERRED);
    // Nota del cuerpo + marca de fallback en el aside.
    expect(
      screen.getAllByText("Only available in Spanish").length,
    ).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("div[lang='es']")).not.toBeNull();
  });

  it("H-1: sin documento preferido no elige ninguno, pide selección y muestra la procedencia del directorio", async () => {
    courseMocks.getContext.mockResolvedValue(contextUnit("beta-unit", null));
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(BETA_NESTED, "sub/CONTEXT-beta.es.md", {
        language: "es",
        href: "/contexts/beta-unit?doc=sub%2FCONTEXT-beta.es.md",
      }),
    ]);

    render(await renderPage("beta-unit"));

    expect(courseMocks.getDocument).not.toHaveBeenCalled();
    expect(
      screen.getByText("Selecciona un documento de la lista para leerlo aquí."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "sub/CONTEXT-beta.es.md" }),
    ).toHaveAttribute(
      "href",
      "/contexts/beta-unit?doc=sub%2FCONTEXT-beta.es.md",
    );
    const region = screen.getByRole("region", {
      name: "Procedencia del contenido",
    });
    expect(region).toHaveTextContent("content/contexts/beta-unit");
    expect(screen.getByRole("link", { name: /Ver en GitHub/ })).toHaveAttribute(
      "href",
      `${SNAPSHOT.canonicalUrl}/tree/${SNAPSHOT.commitSha}/content/contexts/beta-unit`,
    );
  });

  it("renderiza el documento indicado por ?doc cuando existe en la unidad", async () => {
    courseMocks.getContext.mockResolvedValue(contextUnit("beta-unit", null));
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(BETA_NESTED, "sub/CONTEXT-beta.es.md", { language: "es" }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: BETA_NESTED,
      language: "es",
      isFallback: false,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(BETA_NESTED, "# Beta unit\n\nTexto beta."),
    );

    render(await renderPage("beta-unit", { doc: "sub/CONTEXT-beta.es.md" }));

    expect(courseMocks.resolveDocumentVariant).toHaveBeenCalledWith(
      BETA_NESTED,
      "es",
    );
    expect(courseMocks.getDocument).toHaveBeenCalledWith(BETA_NESTED);
    expect(screen.getByText("Texto beta.")).toBeInTheDocument();
  });

  it("devuelve 404 cuando ?doc no corresponde a un documento real", async () => {
    courseMocks.getContext.mockResolvedValue(contextUnit("beta-unit", null));
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(BETA_NESTED, "sub/CONTEXT-beta.es.md", { language: "es" }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue(null);

    await expect(
      renderPage("beta-unit", { doc: "missing.md" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(courseMocks.getDocument).not.toHaveBeenCalled();
  });

  it("devuelve 404 cuando la variante resuelta no pertenece a los documentos del contexto", async () => {
    courseMocks.getContext.mockResolvedValue(contextUnit("beta-unit", null));
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(BETA_NESTED, "sub/CONTEXT-beta.es.md", { language: "es" }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: "content/contexts/other-unit/CONTEXT-other.md",
      language: "es",
      isFallback: false,
    });

    await expect(
      renderPage("beta-unit", { doc: "sub/CONTEXT-beta.es.md" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(courseMocks.getDocument).not.toHaveBeenCalled();
  });

  it("devuelve 404 cuando el slug no existe", async () => {
    courseMocks.getContext.mockResolvedValue(null);

    await expect(renderPage("missing-unit")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(courseMocks.listContextDocuments).not.toHaveBeenCalled();
    expect(courseMocks.listUnitAssets).not.toHaveBeenCalled();
  });

  it("muestra el estado vacío neutro cuando no hay snapshot activo", async () => {
    courseMocks.getActiveSnapshot.mockResolvedValue(null);

    render(await renderPage("alpha-unit"));

    expect(
      screen.getByRole("heading", {
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
    expect(courseMocks.getContext).not.toHaveBeenCalled();
  });

  it("D-06: genera el título de metadata con el H1 del documento y el slug", async () => {
    courseMocks.getContext.mockResolvedValue(
      contextUnit("alpha-unit", ALPHA_PREFERRED),
    );
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(ALPHA_PREFERRED, "CONTEXT-alpha.es.md", { language: "es" }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: ALPHA_PREFERRED,
      language: "es",
      isFallback: false,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(ALPHA_PREFERRED, "# Alpha unit\n\nTexto alpha."),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "alpha-unit" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: "Alpha unit · alpha-unit" });
  });

  it("D-06: la metadata sigue el idioma global de la variante mostrada", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.getContext.mockResolvedValue(
      contextUnit("alpha-unit", ALPHA_PREFERRED),
    );
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(ALPHA_SECONDARY, "CONTEXT-alpha.md", { language: "en" }),
    ]);
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: ALPHA_SECONDARY,
      language: "en",
      isFallback: false,
    });
    courseMocks.getDocument.mockResolvedValue(
      textDocument(ALPHA_SECONDARY, "# English headline\n\nEnglish.", "en"),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "alpha-unit" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: "English headline · alpha-unit" });
  });

  it("sin documento seleccionado la metadata es solo el slug", async () => {
    courseMocks.getContext.mockResolvedValue(contextUnit("beta-unit", null));
    courseMocks.listContextDocuments.mockResolvedValue([
      entry(BETA_NESTED, "sub/CONTEXT-beta.es.md", { language: "es" }),
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "beta-unit" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: "beta-unit" });
  });
});
