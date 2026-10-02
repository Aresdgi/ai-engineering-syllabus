import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContextsIndex } from "@/components/catalog/contexts-index";
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

function contextUnit(slug: string, title: string): CourseUnit {
  return {
    kind: "context",
    sourcePath: `content/contexts/${slug}`,
    slug,
    parentSlug: null,
    title,
    titleOrigin: "document-h1",
    description: null,
    order: null,
    listMarker: null,
    orderSection: null,
    preferredDocumentPath: null,
    language: null,
    languageEvidence: null,
  };
}

describe("ContextsIndex", () => {
  it("lista los contextos recibidos en orden, enlazando a su detalle", () => {
    render(
      <ContextsIndex
        snapshot={SNAPSHOT}
        contexts={[
          contextUnit("alpha-unit", "Alpha unit"),
          contextUnit("beta-unit", "Beta unit"),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Contextos" }),
    ).toBeInTheDocument();
    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/contexts/"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/contexts/alpha-unit",
      "/contexts/beta-unit",
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      "Alpha unit",
      "Beta unit",
    ]);
  });

  it("con lang=en traduce los copys de interfaz", () => {
    render(
      <ContextsIndex
        snapshot={SNAPSHOT}
        contexts={[contextUnit("alpha-unit", "Alpha unit")]}
        lang="en"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Contexts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Content provenance" }),
    ).toBeInTheDocument();
  });

  it("D-02: cada fila muestra el slug literal como línea secundaria", () => {
    render(
      <ContextsIndex
        snapshot={SNAPSHOT}
        contexts={[
          contextUnit("alpha-unit", "Mismo título"),
          contextUnit("beta-unit", "Mismo título"),
        ]}
      />,
    );

    expect(screen.getByText("alpha-unit")).toBeInTheDocument();
    expect(screen.getByText("beta-unit")).toBeInTheDocument();
  });

  it("H-3: muestra la procedencia del directorio raíz pinneada al commit", () => {
    render(<ContextsIndex snapshot={SNAPSHOT} contexts={[]} />);

    const region = screen.getByRole("region", {
      name: "Procedencia del contenido",
    });
    expect(
      within(region).getAllByText("content/contexts").length,
    ).toBeGreaterThan(0);
    const githubLink = within(region).getByRole("link", {
      name: /Ver en GitHub/,
    });
    expect(githubLink).toHaveAttribute(
      "href",
      `${SNAPSHOT.canonicalUrl}/tree/${SNAPSHOT.commitSha}/content/contexts`,
    );
    expect(within(region).queryByText("Blob completo")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío neutro sin unidades", () => {
    render(<ContextsIndex snapshot={SNAPSHOT} contexts={[]} />);

    expect(
      screen.getByText("Todavía no hay contextos que mostrar."),
    ).toBeInTheDocument();
    expect(
      screen
        .queryAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/contexts/")),
    ).toHaveLength(0);
  });

  it("traduce el estado vacío con lang=en", () => {
    render(<ContextsIndex snapshot={SNAPSHOT} contexts={[]} lang="en" />);

    expect(screen.getByText("No contexts to show yet.")).toBeInTheDocument();
  });
});
