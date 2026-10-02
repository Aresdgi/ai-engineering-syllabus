import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectDocumentView } from "@/components/catalog/projects-document";
import type {
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

afterEach(cleanup);

const snapshot: CourseSnapshot = {
  snapshotId: "11111111-2222-3333-4444-555555555555",
  owner: "example-org",
  name: "example-repo",
  canonicalUrl: "https://example.com/example-org/example-repo",
  ref: "main",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  importedAt: "2026-02-03T10:15:00.000Z",
  status: "complete",
  errorCount: 0,
};

const unit: CourseUnit = {
  kind: "project",
  sourcePath: "content/projects/alpha-unit",
  slug: "alpha-unit",
  parentSlug: null,
  title: "Alpha English title",
  titleOrigin: "document-h1",
  description: null,
  order: null,
  listMarker: null,
  orderSection: null,
  preferredDocumentPath: "content/projects/alpha-unit/README.md",
  language: "en",
  languageEvidence: "pair-convention",
};

const document: CourseTextDocument = {
  kind: "text",
  path: "content/projects/alpha-unit/README.md",
  blobSha: "89abcdef0123456789abcdef0123456789abcdef",
  mediaType: "text/markdown",
  language: "en",
  languageEvidence: "pair-convention",
  rawContent:
    "# Alpha English H1\n\n[Missing](./missing.md) and [guide](https://example.com).\n",
};

const resolver: MarkdownUrlResolver = (rawHref) =>
  rawHref.startsWith("http")
    ? { kind: "external", href: rawHref }
    : { kind: "broken", href: null, rawHref };

function renderView(lang: "es" | "en"): void {
  render(
    <ProjectDocumentView
      snapshot={snapshot}
      unit={unit}
      document={document}
      githubHref="https://github.com/example-org/example-repo/blob/0123456/content/projects/alpha-unit/README.md"
      lang={lang}
      resolveUrl={resolver}
    />,
  );
}

describe("ProjectDocumentView", () => {
  it("QA-D2: en inglés los avisos accesibles del documento y de la procedencia salen en inglés", () => {
    renderView("en");

    expect(screen.getByText("(broken link)")).toBeInTheDocument();
    expect(screen.queryAllByText("(enlace roto)")).toHaveLength(0);
    expect(
      screen.getByRole("region", { name: "Content provenance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on GitHub/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/opens in a new tab/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/se abre en una pestaña nueva/)).toHaveLength(
      0,
    );
  });

  it("QA-D2: en español los mismos avisos salen en español", () => {
    renderView("es");

    expect(screen.getByText("(enlace roto)")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Procedencia del contenido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver en GitHub/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/se abre en una pestaña nueva/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByText(/opens in a new tab/)).toHaveLength(0);
  });
});
