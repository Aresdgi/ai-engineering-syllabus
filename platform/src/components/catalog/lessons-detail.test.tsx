import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LessonsDetail } from "@/components/catalog/lessons-detail";
import type {
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

const LESSON_PREFERRED = "content/lessons/alpha-lesson/alpha-lesson.es.md";
const LESSON_SECONDARY = "content/lessons/alpha-lesson/alpha-lesson.md";

const LESSON_UNIT: CourseUnit = {
  kind: "lesson",
  sourcePath: "content/lessons/alpha-lesson",
  slug: "alpha-lesson",
  parentSlug: null,
  title: "Alpha lesson title",
  titleOrigin: "document-h1",
  description: null,
  order: null,
  listMarker: null,
  orderSection: null,
  preferredDocumentPath: LESSON_PREFERRED,
  language: "es",
  languageEvidence: "suffix",
};

function lessonDocument(
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

describe("LessonsDetail", () => {
  it("renderiza el documento, su procedencia y la vuelta al índice", () => {
    render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_PREFERRED,
          "# Alpha lesson title\n\nTexto alpha.",
        )}
        resolver={RESOLVER}
      />,
    );

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

  it("D-06/H-5: el título de cabecera es el H1 de la variante mostrada", () => {
    render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_SECONDARY,
          "# English headline\n\nEnglish text.",
          "en",
        )}
        resolver={RESOLVER}
      />,
    );

    expect(
      screen.getByText("English headline", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alpha lesson title")).not.toBeInTheDocument();
    expect(screen.getByText("English text.")).toBeInTheDocument();
  });

  it("D-01: el documento aporta el único h1 de la vista", () => {
    const { container } = render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_PREFERRED,
          "# Alpha lesson title\n\nTexto alpha.",
        )}
        resolver={RESOLVER}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName("Alpha lesson title");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("D-05: el contenedor del documento lleva el lang de la variante mostrada", () => {
    const { container } = render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_SECONDARY,
          "# English headline\n\nEnglish text.",
          "en",
        )}
        resolver={RESOLVER}
      />,
    );

    const english = container.querySelector("div[lang='en']");
    expect(english).not.toBeNull();
    expect(english?.textContent).toContain("English text.");
    expect(container.querySelector("div[lang='es']")).toBeNull();
  });

  it("muestra la nota neutra cuando solo existe la variante del otro idioma", () => {
    const { container } = render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_PREFERRED,
          "# Alpha lesson title\n\nTexto alpha.",
          "es",
        )}
        fallbackLanguage="es"
        lang="en"
        resolver={RESOLVER}
      />,
    );

    expect(screen.getByText("Only available in Spanish")).toBeInTheDocument();
    expect(container.querySelector("div[lang='es']")).not.toBeNull();
  });

  it("con lang=en traduce el kicker y la vuelta al índice", () => {
    render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_PREFERRED,
          "# Alpha lesson title\n\nTexto alpha.",
        )}
        lang="en"
        resolver={RESOLVER}
      />,
    );

    expect(screen.getByText("Lesson")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Lessons" }),
    ).toHaveAttribute("href", "/lessons");
  });

  it("oculta el frontmatter YAML del documento", () => {
    render(
      <LessonsDetail
        snapshot={SNAPSHOT}
        unit={LESSON_UNIT}
        document={lessonDocument(
          LESSON_PREFERRED,
          "---\ntitle: Alpha lesson title\ntags: [alpha]\n---\n\n# Alpha lesson title\n\nTexto alpha.",
        )}
        resolver={RESOLVER}
      />,
    );

    expect(screen.getByText("Texto alpha.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("title:");
    expect(document.body.textContent).not.toContain("tags:");
    expect(
      screen.queryByRole("navigation", { name: "Idioma" }),
    ).not.toBeInTheDocument();
  });
});
