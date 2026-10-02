import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProvenanceHeader } from "@/components/provenance-header";
import type { CourseSnapshot } from "@/course/types";

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

const props = {
  snapshot,
  sourcePath: "content/projects/alpha-unit",
  documentPath: "content/projects/alpha-unit/README.es.md",
  blobSha: "89abcdef0123456789abcdef0123456789abcdef",
  githubHref:
    "https://example.com/example-org/example-repo/blob/0123456789abcdef0123456789abcdef01234567/content/projects/alpha-unit/README.es.md",
};

const expectedDate = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
}).format(new Date(snapshot.importedAt));

describe("ProvenanceHeader", () => {
  it("D-04: muestra una línea compacta y mueve el detalle completo a <details>", () => {
    render(<ProvenanceHeader {...props} />);

    expect(
      screen.getByRole("region", { name: "Procedencia del contenido" }),
    ).toBeInTheDocument();

    const summary = screen.getByText("Detalles de procedencia");
    expect(summary.tagName).toBe("SUMMARY");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    expect(screen.getByText("example-org/example-repo")).toBeInTheDocument();
    expect(screen.getAllByText("0123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText(props.documentPath).length).toBeGreaterThan(0);
    expect(screen.getByText(snapshot.commitSha)).toBeInTheDocument();
    expect(screen.getByText(props.blobSha)).toBeInTheDocument();
    expect(screen.getByText(props.sourcePath)).toBeInTheDocument();
    expect(screen.getByText(snapshot.snapshotId)).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Importado el")).toBeInTheDocument();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();

    expect(details?.contains(screen.getByText(snapshot.snapshotId))).toBe(true);
    expect(details?.contains(screen.getByText(snapshot.commitSha))).toBe(true);
  });

  it("D-04: la línea compacta fluye en línea y rompe el path con overflow-wrap, no con break-all", () => {
    render(<ProvenanceHeader {...props} />);

    const region = screen.getByRole("region", {
      name: "Procedencia del contenido",
    });
    const compactRow = region.firstElementChild as HTMLElement;
    expect(compactRow.className).toContain("leading-relaxed");
    expect(compactRow.className).not.toContain("flex");

    const path = Array.from(compactRow.querySelectorAll("code")).find(
      (code) => code.textContent === props.documentPath,
    );
    expect(path).toBeDefined();
    expect(path?.getAttribute("title")).toBe(props.documentPath);
    expect(path?.className).toContain("[overflow-wrap:anywhere]");
    expect(region.querySelector(".break-all")).toBeNull();

    expect(compactRow.textContent).toContain("example-org/example-repo");
    expect(compactRow.textContent).toContain("0123456");
    expect(compactRow.querySelector("a")?.getAttribute("href")).toBe(
      props.githubHref,
    );
  });

  it("H-1/H-3: con documentPath y blobSha nulos describe el directorio sin fila de blob", () => {
    const treeHref =
      "https://example.com/example-org/example-repo/tree/0123456789abcdef0123456789abcdef01234567/content/projects/alpha-unit";
    render(
      <ProvenanceHeader
        {...props}
        documentPath={null}
        blobSha={null}
        githubHref={treeHref}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Procedencia del contenido",
    });
    expect(screen.getAllByText(props.sourcePath).length).toBeGreaterThan(0);
    expect(screen.queryByText("Documento")).not.toBeInTheDocument();
    expect(screen.queryByText("Blob completo")).not.toBeInTheDocument();
    expect(region.textContent).toContain("Directorio");
    expect(
      screen.getByRole("link", { name: /ver en github/i }),
    ).toHaveAttribute("href", treeHref);
  });

  it("enlaza a GitHub en una pestaña nueva con rel seguro", () => {
    render(<ProvenanceHeader {...props} />);

    const link = screen.getByRole("link", { name: /ver en github/i });
    expect(link).toHaveAttribute("href", props.githubHref);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("no filtra credenciales ni datos internos aunque viajen en el snapshot", () => {
    render(
      <ProvenanceHeader
        {...props}
        snapshot={{
          ...snapshot,
          canonicalUrl:
            "postgres://internal-user:supersecret@example.invalid/db",
        }}
      />,
    );

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/postgres/i);
    expect(text).not.toMatch(/supersecret/i);
    expect(text).not.toMatch(/database_url/i);
  });

  it("idioma global: copys y fecha en inglés", () => {
    render(<ProvenanceHeader {...props} lang="en" />);

    expect(
      screen.getByRole("region", { name: "Content provenance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Provenance details")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view on github/i }),
    ).toBeInTheDocument();
    const englishDate = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
    }).format(new Date(snapshot.importedAt));
    expect(screen.getByText(englishDate)).toBeInTheDocument();
    expect(
      screen.queryByText("Detalles de procedencia"),
    ).not.toBeInTheDocument();
  });

  it("etiqueta el enlace de espejo sin cambiar el repo de origen", () => {
    render(<ProvenanceHeader {...props} mirrorLabel="espejo" />);

    const link = screen.getByRole("link", {
      name: /ver en github \(espejo\)/i,
    });
    expect(link).toHaveAttribute("href", props.githubHref);
    expect(screen.getByText("example-org/example-repo")).toBeInTheDocument();
  });

  it("ADR-018: etiqueta automáticamente un href de otro repo como espejo", () => {
    const mirrorHref =
      "https://github.com/example-user/example-fork/blob/0123456789abcdef0123456789abcdef01234567/content/projects/alpha-unit/README.es.md";
    render(<ProvenanceHeader {...props} githubHref={mirrorHref} />);

    const link = screen.getByRole("link", {
      name: /ver en github \(espejo\)/i,
    });
    expect(link).toHaveAttribute("href", mirrorHref);
    // El repo de origen sigue mostrándose como texto.
    expect(screen.getByText("example-org/example-repo")).toBeInTheDocument();
  });

  it("ADR-018: en inglés la etiqueta automática es `mirror`", () => {
    const mirrorHref =
      "https://github.com/example-user/example-fork/blob/0123456789abcdef0123456789abcdef01234567/content/projects/alpha-unit/README.es.md";
    render(<ProvenanceHeader {...props} githubHref={mirrorHref} lang="en" />);

    expect(
      screen.getByRole("link", { name: /view on github \(mirror\)/i }),
    ).toBeInTheDocument();
  });

  it("avisa en tono neutro cuando el snapshot terminó con errores", () => {
    render(
      <ProvenanceHeader
        {...props}
        snapshot={{
          ...snapshot,
          status: "complete_with_errors",
          errorCount: 2,
        }}
      />,
    );

    expect(
      screen.getByText(/2 archivo\(s\) sin importar/i),
    ).toBeInTheDocument();
  });
});
