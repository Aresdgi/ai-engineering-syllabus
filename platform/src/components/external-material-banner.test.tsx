import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExternalMaterialBanner } from "@/components/external-material-banner";

afterEach(cleanup);

const ORIGINAL_URL = "https://example.com/lesson/fixture-lesson";
const WAYBACK_URL =
  "http://web.archive.org/web/20260613092255/https://example.com/lesson/fixture-lesson";
const CAPTURED_AT = "2026-10-02T10:00:00.000Z";
const WAYBACK_CAPTURED_AT = "2026-06-13T09:22:55.000Z";
const SHA256 = "a".repeat(64);
const METHOD = "registry-api+github-raw";

const esLongDate = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
});
const enLongDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
});

function renderBanner(
  overrides: Partial<Parameters<typeof ExternalMaterialBanner>[0]> = {},
) {
  return render(
    <ExternalMaterialBanner
      originalUrl={ORIGINAL_URL}
      capturedAt={CAPTURED_AT}
      method={METHOD}
      contentSha256={SHA256}
      {...overrides}
    />,
  );
}

describe("ExternalMaterialBanner: marcado literal de material externo (AC-2.5.3)", () => {
  it("es un role=note persistente con el texto literal, URL, fecha, método y hash", () => {
    renderBanner();

    const note = screen.getByRole("note", {
      name: "Material externo archivado",
    });
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(
      "Material externo archivado. No forma parte del repositorio.",
    );
    expect(note).not.toHaveAttribute("aria-live");

    const link = screen.getByRole("link", { name: new RegExp(ORIGINAL_URL) });
    expect(link).toHaveAttribute("href", ORIGINAL_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector(".sr-only")?.textContent).toContain(
      "se abre en una pestaña nueva",
    );

    expect(note).toHaveTextContent("Capturado el");
    expect(note).toHaveTextContent(esLongDate.format(new Date(CAPTURED_AT)));
    expect(note).toHaveTextContent(METHOD);
    expect(
      screen.getByText(`sha256:${SHA256.slice(0, 12)}…`),
    ).toBeInTheDocument();
    expect(screen.getByText(SHA256)).toBeInTheDocument();
    expect(screen.getByTitle(SHA256)).toBeInTheDocument();
  });

  it("traduce los copys neutros al inglés manteniendo la fecha local", () => {
    render(
      <ExternalMaterialBanner
        originalUrl={ORIGINAL_URL}
        capturedAt={CAPTURED_AT}
        method={METHOD}
        contentSha256={SHA256}
        lang="en"
      />,
    );

    const note = screen.getByRole("note", {
      name: "Archived external material",
    });
    expect(note).toHaveTextContent(
      "Archived external material. Not part of the repository.",
    );
    expect(note).toHaveTextContent("Captured on");
    expect(note).toHaveTextContent(enLongDate.format(new Date(CAPTURED_AT)));
    expect(note).toHaveTextContent("Original URL");
    expect(note).toHaveTextContent("Method");
    expect(note).toHaveTextContent("Hash");
  });

  it("muestra el respaldo Wayback solo cuando existe, marcado y con la fecha", () => {
    renderBanner({
      waybackUrl: WAYBACK_URL,
      waybackCapturedAt: WAYBACK_CAPTURED_AT,
    });

    const backup = screen.getByRole("link", {
      name: new RegExp(esLongDate.format(new Date(WAYBACK_CAPTURED_AT))),
    });
    expect(backup).toHaveAttribute("href", WAYBACK_URL);
    expect(backup).toHaveAttribute("target", "_blank");
    expect(backup).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Respaldo en Wayback Machine")).toBeInTheDocument();
  });

  it("sin respaldo ni hash no pinta esas filas", () => {
    renderBanner({ contentSha256: null, waybackUrl: null });

    expect(screen.queryByText(/sha256:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Respaldo en Wayback Machine"),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(1);
  });
});
