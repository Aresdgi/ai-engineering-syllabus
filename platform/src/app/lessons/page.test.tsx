import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSnapshot, CourseUnit } from "@/course/types";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

const i18nMocks = vi.hoisted(() => ({
  getUiLanguage: vi.fn(async () => "es" as "es" | "en"),
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiLanguage: i18nMocks.getUiLanguage,
}));

const courseMocks = vi.hoisted(() => ({
  getActiveSnapshot: vi.fn(),
  listLessons: vi.fn(),
}));

vi.mock("@/course", () => ({
  getActiveSnapshot: courseMocks.getActiveSnapshot,
  listLessons: courseMocks.listLessons,
}));

import LessonsPage, { generateMetadata } from "@/app/lessons/page";

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

beforeEach(() => {
  vi.clearAllMocks();
  courseMocks.getActiveSnapshot.mockResolvedValue(SNAPSHOT);
  courseMocks.listLessons.mockResolvedValue([
    lessonUnit("alpha-lesson", "Alpha lesson"),
    lessonUnit("beta-lesson", "Beta lesson"),
  ]);
});

describe("LessonsPage", () => {
  it("lista las lecciones en el orden que devuelve el lector en el idioma global", async () => {
    render(await LessonsPage());

    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/lessons/"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/lessons/alpha-lesson",
      "/lessons/beta-lesson",
    ]);
    expect(courseMocks.listLessons).toHaveBeenCalledWith("es");
    expect(
      screen.getByRole("heading", { level: 1, name: "Lecciones" }),
    ).toBeInTheDocument();
    // D-02: el slug literal de cada fila es visible.
    expect(screen.getAllByText("alpha-lesson").length).toBeGreaterThan(0);
    expect(screen.getAllByText("beta-lesson").length).toBeGreaterThan(0);
    // H-3: procedencia del directorio raíz.
    expect(
      screen.getByRole("region", { name: "Procedencia del contenido" }),
    ).toBeInTheDocument();
  });

  it("en inglés pide los títulos en inglés y traduce la interfaz", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.listLessons.mockResolvedValue([
      lessonUnit("alpha-lesson", "Alpha lesson"),
    ]);

    render(await LessonsPage());

    expect(courseMocks.listLessons).toHaveBeenCalledWith("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Lessons" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Content provenance" }),
    ).toBeInTheDocument();

    const metadata = await generateMetadata();
    expect(metadata).toEqual({ title: "Lessons" });
  });

  it("genera la metadata en español por defecto", async () => {
    expect(await generateMetadata()).toEqual({ title: "Lecciones" });
  });

  it("muestra el estado vacío neutro cuando no hay snapshot activo", async () => {
    courseMocks.getActiveSnapshot.mockResolvedValue(null);

    render(await LessonsPage());

    expect(
      screen.getByRole("heading", {
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
    expect(courseMocks.listLessons).not.toHaveBeenCalled();
  });
});
