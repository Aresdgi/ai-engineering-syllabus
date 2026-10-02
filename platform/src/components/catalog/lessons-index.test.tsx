import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LessonsIndex } from "@/components/catalog/lessons-index";
import type { CourseSnapshot, CourseUnit } from "@/course/types";

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

function lessonUnit(slug: string, title: string): CourseUnit {
  return {
    kind: "lesson",
    sourcePath: `content/lessons/${slug}`,
    slug,
    parentSlug: null,
    title,
    titleOrigin: "document-h1",
    description: null,
    order: null,
    listMarker: null,
    orderSection: null,
    preferredDocumentPath: `content/lessons/${slug}/${slug}.es.md`,
    language: "es",
    languageEvidence: "suffix",
  };
}

describe("LessonsIndex", () => {
  it("lista las lecciones recibidas en orden, enlazando a su detalle", () => {
    render(
      <LessonsIndex
        snapshot={SNAPSHOT}
        lessons={[
          lessonUnit("alpha-lesson", "Alpha lesson"),
          lessonUnit("beta-lesson", "Beta lesson"),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Lecciones" }),
    ).toBeInTheDocument();
    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/lessons/"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/lessons/alpha-lesson",
      "/lessons/beta-lesson",
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      "Alpha lesson",
      "Beta lesson",
    ]);
  });

  it("con lang=en traduce los copys de interfaz", () => {
    render(
      <LessonsIndex
        snapshot={SNAPSHOT}
        lessons={[lessonUnit("alpha-lesson", "Alpha lesson")]}
        lang="en"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Lessons" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Content provenance" }),
    ).toBeInTheDocument();
  });

  it("D-02: cada fila muestra el slug literal como línea secundaria", () => {
    render(
      <LessonsIndex
        snapshot={SNAPSHOT}
        lessons={[
          lessonUnit("alpha-lesson", "Mismo título"),
          lessonUnit("beta-lesson", "Mismo título"),
        ]}
      />,
    );

    expect(screen.getByText("alpha-lesson")).toBeInTheDocument();
    expect(screen.getByText("beta-lesson")).toBeInTheDocument();
  });

  it("H-3: muestra la procedencia del directorio raíz pinneada al commit", () => {
    render(<LessonsIndex snapshot={SNAPSHOT} lessons={[]} />);

    const region = screen.getByRole("region", {
      name: "Procedencia del contenido",
    });
    expect(
      within(region).getAllByText("content/lessons").length,
    ).toBeGreaterThan(0);
    const githubLink = within(region).getByRole("link", {
      name: /Ver en GitHub/,
    });
    expect(githubLink).toHaveAttribute(
      "href",
      `${SNAPSHOT.canonicalUrl}/tree/${SNAPSHOT.commitSha}/content/lessons`,
    );
    expect(within(region).queryByText("Blob completo")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío neutro sin unidades", () => {
    render(<LessonsIndex snapshot={SNAPSHOT} lessons={[]} />);

    expect(
      screen.getByText("Todavía no hay lecciones que mostrar."),
    ).toBeInTheDocument();
    expect(
      screen
        .queryAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/lessons/")),
    ).toHaveLength(0);
  });

  it("traduce el estado vacío con lang=en", () => {
    render(<LessonsIndex snapshot={SNAPSHOT} lessons={[]} lang="en" />);

    expect(screen.getByText("No lessons to show yet.")).toBeInTheDocument();
  });
});
