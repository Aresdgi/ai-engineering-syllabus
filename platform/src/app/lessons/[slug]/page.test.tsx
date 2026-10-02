import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
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
  getLesson: vi.fn(),
  getDocument: vi.fn(),
  resolveDocumentVariant: vi.fn(),
  createMarkdownUrlResolver: vi.fn(),
}));

vi.mock("@/course", () => ({
  getActiveSnapshot: courseMocks.getActiveSnapshot,
  getLesson: courseMocks.getLesson,
  getDocument: courseMocks.getDocument,
  resolveDocumentVariant: courseMocks.resolveDocumentVariant,
  createMarkdownUrlResolver: courseMocks.createMarkdownUrlResolver,
}));

import LessonPage, { generateMetadata } from "@/app/lessons/[slug]/page";

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

const PREFERRED = "content/lessons/alpha-lesson/alpha-lesson.es.md";
const SECONDARY = "content/lessons/alpha-lesson/alpha-lesson.md";

const LESSON_UNIT: CourseUnit = {
  kind: "lesson",
  sourcePath: "content/lessons/alpha-lesson",
  slug: "alpha-lesson",
  parentSlug: null,
  title: "alpha-lesson title",
  titleOrigin: "document-h1",
  description: null,
  order: null,
  listMarker: null,
  orderSection: null,
  preferredDocumentPath: PREFERRED,
  language: "es",
  languageEvidence: "suffix",
};

function textDocument(path: string, rawContent: string): CourseTextDocument {
  return {
    kind: "text",
    path,
    blobSha: "blob-alpha",
    mediaType: "text/markdown",
    language: path === PREFERRED ? "es" : "en",
    languageEvidence: path === PREFERRED ? "suffix" : "pair-convention",
    rawContent,
  };
}

const RESOLVER: MarkdownUrlResolver = (rawHref) => ({
  kind: "broken",
  href: null,
  rawHref,
});

function renderPage(
  slug: string,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return LessonPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  courseMocks.getActiveSnapshot.mockResolvedValue(SNAPSHOT);
  courseMocks.getLesson.mockResolvedValue(LESSON_UNIT);
  courseMocks.getDocument.mockImplementation(async (path: string) =>
    textDocument(
      path,
      path === PREFERRED
        ? "# Lección alpha\n\nTexto alpha."
        : "# Alpha lesson\n\nEnglish text.",
    ),
  );
  courseMocks.resolveDocumentVariant.mockResolvedValue({
    path: PREFERRED,
    language: "es",
    isFallback: false,
  });
  courseMocks.createMarkdownUrlResolver.mockResolvedValue(RESOLVER);
});

describe("LessonPage", () => {
  it("renderiza la variante del idioma global sin selector por página", async () => {
    render(await renderPage("alpha-lesson"));

    expect(courseMocks.getLesson).toHaveBeenCalledWith("alpha-lesson", "es");
    expect(courseMocks.resolveDocumentVariant).toHaveBeenCalledWith(
      PREFERRED,
      "es",
    );
    expect(courseMocks.getDocument).toHaveBeenCalledWith(PREFERRED);
    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Procedencia del contenido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a Lecciones" }),
    ).toHaveAttribute("href", "/lessons");
    expect(
      screen.queryByRole("navigation", { name: "Idioma" }),
    ).not.toBeInTheDocument();
  });

  it("con el idioma global en inglés sirve la variante inglesa y traduce la interfaz", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: SECONDARY,
      language: "en",
      isFallback: false,
    });

    const { container } = render(await renderPage("alpha-lesson"));

    expect(courseMocks.getLesson).toHaveBeenCalledWith("alpha-lesson", "en");
    expect(courseMocks.resolveDocumentVariant).toHaveBeenCalledWith(
      PREFERRED,
      "en",
    );
    expect(courseMocks.getDocument).toHaveBeenCalledWith(SECONDARY);
    expect(screen.getByText("English text.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Lessons" }),
    ).toHaveAttribute("href", "/lessons");
    expect(container.querySelector("div[lang='en']")).not.toBeNull();
  });

  it("muestra la variante existente con nota neutra cuando no hay la del idioma global", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: PREFERRED,
      language: "es",
      isFallback: true,
    });

    const { container } = render(await renderPage("alpha-lesson"));

    expect(courseMocks.getDocument).toHaveBeenCalledWith(PREFERRED);
    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
    expect(screen.getByText("Only available in Spanish")).toBeInTheDocument();
    expect(container.querySelector("div[lang='es']")).not.toBeNull();
  });

  it("?lang de URLs antiguas se ignora sin 404", async () => {
    render(await renderPage("alpha-lesson", { lang: "en" }));

    expect(courseMocks.getLesson).toHaveBeenCalledWith("alpha-lesson", "es");
    expect(courseMocks.getDocument).toHaveBeenCalledWith(PREFERRED);
    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
  });

  it("devuelve 404 cuando el slug no existe", async () => {
    courseMocks.getLesson.mockResolvedValue(null);

    await expect(renderPage("missing-unit")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(courseMocks.resolveDocumentVariant).not.toHaveBeenCalled();
  });

  it("muestra el estado vacío neutro cuando no hay snapshot activo", async () => {
    courseMocks.getActiveSnapshot.mockResolvedValue(null);

    render(await renderPage("alpha-lesson"));

    expect(
      screen.getByRole("heading", {
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
    expect(courseMocks.getLesson).not.toHaveBeenCalled();
  });

  it("D-06: genera el título de metadata con el H1 de la variante del idioma global", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "alpha-lesson" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: "Lección alpha" });
  });

  it("D-06/H-5: la metadata sigue el H1 de la variante inglesa mostrada", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.resolveDocumentVariant.mockResolvedValue({
      path: SECONDARY,
      language: "en",
      isFallback: false,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "alpha-lesson" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: "Alpha lesson" });
  });
});
