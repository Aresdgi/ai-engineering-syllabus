import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalArchiveItem } from "@/course/types";
import type { MarkdownUrl, MarkdownUrlResolver } from "@/lib/markdown/types";

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
  getArchivedItemByCanonicalUrl: vi.fn(),
  resolveArchivedAlias: vi.fn(),
  resolveArchivedVariant: vi.fn(),
  createExternalArchiveResolver: vi.fn(),
}));

vi.mock("@/course", async () => {
  const routes =
    await vi.importActual<typeof import("@/course/routes")>("@/course/routes");
  return {
    parseArchiveTarget: routes.parseArchiveTarget,
    getArchivedItemByCanonicalUrl: courseMocks.getArchivedItemByCanonicalUrl,
    resolveArchivedAlias: courseMocks.resolveArchivedAlias,
    resolveArchivedVariant: courseMocks.resolveArchivedVariant,
    createExternalArchiveResolver: courseMocks.createExternalArchiveResolver,
  };
});

import ArchivePage, { generateMetadata } from "@/app/archive/[...path]/page";

afterEach(() => {
  cleanup();
  i18nMocks.getUiLanguage.mockResolvedValue("es");
  vi.restoreAllMocks();
});

const CAPTURED_AT = "2026-10-02T10:00:00.000Z";
const SHA_CONTENT = "a".repeat(64);
const SHA_ASSET = "b".repeat(64);

const SOURCE_URL = "https://example.com/lesson/fixture-lesson";
const RETIRED_URL = "https://example.com/lesson/retired-fixture";
const DESTINATION_URL = "https://example.com/es/lesson/equivalent-fixture";
const IMAGE_URL = "https://example.com/images/fixture-image.png";

function capturedItem(
  overrides: Partial<ExternalArchiveItem> = {},
): ExternalArchiveItem {
  return {
    id: "archive-item-captured",
    canonicalUrl: SOURCE_URL,
    kind: "lesson",
    language: "es",
    status: "captured",
    href: "/archive/example.com/lesson/fixture-lesson",
    waybackUrl: null,
    waybackCapturedAt: null,
    aliasOfCanonicalUrl: null,
    originalUrl: SOURCE_URL,
    host: "example.com",
    title: "Fixture lesson",
    content: [
      "# Document heading",
      "",
      "Literal body with `code`.",
      "",
      `![Fixture image](${IMAGE_URL})`,
    ].join("\n"),
    contentSha256: SHA_CONTENT,
    sourceRepository: "example-org/example-content",
    sourceCommit: "c".repeat(40),
    sourcePath: "content/fixture-lesson.es.md",
    capturedAt: CAPTURED_AT,
    method: "registry-api+github-raw",
    httpStatus: 200,
    ...overrides,
  };
}

function destinationItem(
  overrides: Partial<ExternalArchiveItem> = {},
): ExternalArchiveItem {
  return capturedItem({
    id: "archive-item-destination",
    canonicalUrl: DESTINATION_URL,
    originalUrl: DESTINATION_URL,
    href: "/archive/example.com/es/lesson/equivalent-fixture",
    title: "Equivalent fixture lesson",
    language: "es",
    sourcePath: "content/equivalent-fixture.es.md",
    ...overrides,
  });
}

function aliasItem(
  overrides: Partial<ExternalArchiveItem> = {},
): ExternalArchiveItem {
  return {
    id: "archive-item-alias",
    canonicalUrl: RETIRED_URL,
    kind: "lesson",
    language: null,
    status: "alias",
    href: "/archive/example.com/lesson/retired-fixture",
    waybackUrl: null,
    waybackCapturedAt: null,
    aliasOfCanonicalUrl: DESTINATION_URL,
    originalUrl: RETIRED_URL,
    host: "example.com",
    title: null,
    content: null,
    contentSha256: null,
    sourceRepository: null,
    sourceCommit: null,
    sourcePath: null,
    capturedAt: CAPTURED_AT,
    method: "user-alias",
    httpStatus: null,
    ...overrides,
  };
}

const TOOL_URL = "https://example.com/tool/fixture-tool";
const TOOL_WAYBACK_URL =
  "http://web.archive.org/web/20260613092255/https://example.com/tool/fixture-tool";
const WAYBACK_CAPTURED_AT = "2026-06-13T09:22:55.000Z";

function toolItem(
  overrides: Partial<ExternalArchiveItem> = {},
): ExternalArchiveItem {
  return {
    id: "archive-item-tool",
    canonicalUrl: TOOL_URL,
    kind: "tool",
    language: null,
    status: "captured",
    href: "/archive/example.com/tool/fixture-tool",
    waybackUrl: TOOL_WAYBACK_URL,
    waybackCapturedAt: WAYBACK_CAPTURED_AT,
    aliasOfCanonicalUrl: null,
    originalUrl: TOOL_URL,
    host: "example.com",
    title: null,
    content: null,
    contentSha256: null,
    sourceRepository: null,
    sourceCommit: null,
    sourcePath: null,
    capturedAt: CAPTURED_AT,
    method: "wayback-metadata",
    httpStatus: 200,
    ...overrides,
  };
}

const resolver: MarkdownUrlResolver = (rawHref): MarkdownUrl => {
  if (rawHref === IMAGE_URL) {
    return {
      kind: "archive-asset",
      href: `/archive-assets/${SHA_ASSET}`,
      sha256: SHA_ASSET,
    };
  }
  return { kind: "external", href: rawHref };
};

function renderPage(segments: string[]) {
  return ArchivePage({
    params: Promise.resolve({ path: segments }),
    searchParams: Promise.resolve({}),
  });
}

function metadataFor(segments: string[]) {
  return generateMetadata({
    params: Promise.resolve({ path: segments }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(capturedItem());
  courseMocks.resolveArchivedAlias.mockResolvedValue(null);
  courseMocks.resolveArchivedVariant.mockImplementation(
    async (item: ExternalArchiveItem) => ({ item, isFallback: false }),
  );
  courseMocks.createExternalArchiveResolver.mockReturnValue(resolver);
});

describe("ArchivePage: lección capturada", () => {
  it("muestra el banner literal, el título y el contenido literal con assets propios", async () => {
    const { container } = render(
      await renderPage(["example.com", "lesson", "fixture-lesson"]),
    );

    expect(courseMocks.getArchivedItemByCanonicalUrl).toHaveBeenCalledWith(
      SOURCE_URL,
    );
    expect(courseMocks.resolveArchivedVariant).toHaveBeenCalledWith(
      capturedItem(),
      "es",
    );

    const note = screen.getByRole("note", {
      name: "Material externo archivado",
    });
    expect(note).toHaveTextContent(
      "Material externo archivado. No forma parte del repositorio.",
    );
    expect(
      within(note).getByRole("link", { name: new RegExp(SOURCE_URL) }),
    ).toHaveAttribute("href", SOURCE_URL);

    const title = screen.getByText("Fixture lesson");
    expect(title.tagName).toBe("P");
    expect(
      screen.getByRole("heading", { level: 1, name: "Document heading" }),
    ).toBeInTheDocument();

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", `/archive-assets/${SHA_ASSET}`);
    expect(image).toHaveAttribute("alt", "Fixture image");
  });

  it("con el idioma global en inglés sirve el par y traduce la interfaz", async () => {
    const english = capturedItem({
      canonicalUrl: "https://example.com/lesson/fixture-lesson",
      language: "en",
      href: "/archive/example.com/lesson/fixture-lesson",
      content: "# English document heading\n\nEnglish literal body.\n",
      sourcePath: "content/fixture-lesson.md",
    });
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.resolveArchivedVariant.mockResolvedValue({
      item: english,
      isFallback: false,
    });

    render(await renderPage(["example.com", "lesson", "fixture-lesson"]));

    expect(courseMocks.resolveArchivedVariant).toHaveBeenCalledWith(
      capturedItem(),
      "en",
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "English document heading",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("note", { name: "Archived external material" }),
    ).toBeInTheDocument();
  });

  it("muestra la nota neutra de fallback cuando no existe la variante pedida", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");
    courseMocks.resolveArchivedVariant.mockResolvedValue({
      item: capturedItem(),
      isFallback: true,
    });

    const { container } = render(
      await renderPage(["example.com", "lesson", "fixture-lesson"]),
    );

    expect(screen.getByText("Only available in Spanish")).toBeInTheDocument();
    expect(container.querySelector("div[lang='es']")).not.toBeNull();
  });

  it("sanea el HTML del material externo (script y onerror fuera)", async () => {
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(
      capturedItem({
        content: [
          "# Document heading",
          "",
          '<script>alert("xss")</script>',
          "",
          `<img src="${IMAGE_URL}" onerror="alert(1)" alt="Fixture image" />`,
        ].join("\n"),
      }),
    );

    const { container } = render(
      await renderPage(["example.com", "lesson", "fixture-lesson"]),
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });

  it("no hace ninguna petición de red durante el render (AC-2.5.8)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(await renderPage(["example.com", "lesson", "fixture-lesson"]));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("devuelve 404 cuando el item no existe y no inventa contenido", async () => {
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(null);

    await expect(
      renderPage(["example.com", "lesson", "missing-fixture"]),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(courseMocks.createExternalArchiveResolver).not.toHaveBeenCalled();
  });

  it("genera metadata con el título literal", async () => {
    const metadata = await metadataFor([
      "example.com",
      "lesson",
      "fixture-lesson",
    ]);

    expect(metadata).toEqual({ title: "Fixture lesson" });
  });
});

describe("ArchivePage: alias de lección retirada (§8)", () => {
  function resolveAlias() {
    const destination = destinationItem();
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(aliasItem());
    courseMocks.resolveArchivedAlias.mockResolvedValue(destination);
    courseMocks.resolveArchivedVariant.mockResolvedValue({
      item: destination,
      isFallback: false,
    });
    return destination;
  }

  it("muestra el banner del destino y el aviso persistente de sustitución", async () => {
    const destination = resolveAlias();

    render(await renderPage(["example.com", "lesson", "retired-fixture"]));

    expect(courseMocks.resolveArchivedAlias).toHaveBeenCalledWith(aliasItem());
    expect(courseMocks.resolveArchivedVariant).toHaveBeenCalledWith(
      aliasItem(),
      "es",
    );

    const banner = screen.getByRole("note", {
      name: "Material externo archivado",
    });
    expect(
      within(banner).getByRole("link", { name: new RegExp(DESTINATION_URL) }),
    ).toHaveAttribute("href", DESTINATION_URL);

    const notice = screen.getByRole("note", {
      name: "Sustitución de lección retirada",
    });
    expect(notice).toHaveTextContent(
      "La lección original ya no existe en 4Geeks y no tiene copia archivada. En su lugar se muestra la lección de 4Geeks «Equivalent fixture lesson», elegida por el usuario como equivalente.",
    );

    const retiredLink = within(notice).getByRole("link", {
      name: /Ver la URL original retirada/,
    });
    expect(retiredLink).toHaveAttribute("href", RETIRED_URL);
    expect(retiredLink).toHaveAttribute("target", "_blank");
    expect(retiredLink).toHaveAttribute("rel", "noopener noreferrer");

    const destinationLink = within(notice).getByRole("link", {
      name: "Ver la copia archivada de la lección equivalente",
    });
    expect(destinationLink).toHaveAttribute(
      "href",
      "/archive/example.com/es/lesson/equivalent-fixture",
    );
    expect(destination.href).toBe(
      "/archive/example.com/es/lesson/equivalent-fixture",
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Document heading" }),
    ).toBeInTheDocument();
  });

  it("traduce el aviso al inglés", async () => {
    resolveAlias();
    i18nMocks.getUiLanguage.mockResolvedValue("en");

    render(await renderPage(["example.com", "lesson", "retired-fixture"]));

    const notice = screen.getByRole("note", {
      name: "Retired lesson substitution",
    });
    expect(notice).toHaveTextContent(
      "The original lesson no longer exists on 4Geeks and has no archived copy. The 4Geeks lesson “Equivalent fixture lesson”, chosen by the user as an equivalent, is shown instead.",
    );
  });

  it("degrada al estado neutro si el alias no tiene destino", async () => {
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(aliasItem());
    courseMocks.resolveArchivedAlias.mockResolvedValue(null);

    render(await renderPage(["example.com", "lesson", "retired-fixture"]));

    expect(
      screen.getByRole("heading", {
        name: "No hay copia archivada disponible",
      }),
    ).toBeInTheDocument();
  });
});

describe("ArchivePage: herramienta capturada sin contenido (T-02)", () => {
  const esLongDate = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" });

  beforeEach(() => {
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(toolItem());
  });

  it("muestra el banner, la URL original y el respaldo Wayback fechado", async () => {
    render(await renderPage(["example.com", "tool", "fixture-tool"]));

    expect(courseMocks.getArchivedItemByCanonicalUrl).toHaveBeenCalledWith(
      TOOL_URL,
    );
    expect(
      screen.queryByText("No hay copia archivada disponible"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Herramienta externa enlazada",
      }),
    ).toBeInTheDocument();

    const note = screen.getByRole("note", {
      name: "Material externo archivado",
    });
    expect(note).toHaveTextContent(
      "Material externo archivado. No forma parte del repositorio.",
    );
    expect(
      within(note).getByRole("link", { name: new RegExp(TOOL_URL) }),
    ).toHaveAttribute("href", TOOL_URL);

    const backup = within(note).getByRole("link", {
      name: new RegExp(esLongDate.format(new Date(WAYBACK_CAPTURED_AT))),
    });
    expect(backup).toHaveAttribute("href", TOOL_WAYBACK_URL);
    expect(backup).toHaveAttribute("target", "_blank");
    expect(backup).toHaveAttribute("rel", "noopener noreferrer");
    expect(note).toHaveTextContent("wayback-metadata");
    expect(courseMocks.createExternalArchiveResolver).not.toHaveBeenCalled();
  });

  it("sin respaldo Wayback conserva el original con el aviso neutro", async () => {
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(
      toolItem({ waybackUrl: null, waybackCapturedAt: null }),
    );

    render(await renderPage(["example.com", "tool", "fixture-tool"]));

    const note = screen.getByRole("note", {
      name: "Material externo archivado",
    });
    expect(
      within(note).getByRole("link", { name: new RegExp(TOOL_URL) }),
    ).toBeInTheDocument();
    expect(
      within(note).queryByRole("link", { name: /Wayback/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Sin respaldo archivado disponible"),
    ).toBeInTheDocument();
  });

  it("genera metadata con el título neutro de herramienta", async () => {
    await expect(
      metadataFor(["example.com", "tool", "fixture-tool"]),
    ).resolves.toEqual({ title: "Herramienta externa enlazada" });
  });

  it("traduce el estado de herramienta al inglés", async () => {
    i18nMocks.getUiLanguage.mockResolvedValue("en");

    render(await renderPage(["example.com", "tool", "fixture-tool"]));

    expect(
      screen.getByRole("heading", { level: 1, name: "Linked external tool" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("note", { name: "Archived external material" }),
    ).toBeInTheDocument();
  });
});

describe("ArchivePage: material no disponible", () => {
  it.each(["unavailable", "error"] as const)(
    "con status %s muestra el estado neutro y la URL original",
    async (status) => {
      courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(
        capturedItem({ status, content: null, contentSha256: null }),
      );

      render(await renderPage(["example.com", "lesson", "fixture-lesson"]));

      expect(
        screen.getByRole("heading", {
          name: "No hay copia archivada disponible",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: new RegExp(SOURCE_URL) }),
      ).toHaveAttribute("href", SOURCE_URL);
      expect(courseMocks.createExternalArchiveResolver).not.toHaveBeenCalled();
    },
  );

  it.each(["en", "es"] as const)(
    "traduce el estado neutro al idioma %s",
    async (uiLanguage) => {
      i18nMocks.getUiLanguage.mockResolvedValue(uiLanguage);
      courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(
        capturedItem({ status: "unavailable", content: null }),
      );

      render(await renderPage(["example.com", "lesson", "fixture-lesson"]));

      expect(
        screen.getByRole("heading", {
          name:
            uiLanguage === "es"
              ? "No hay copia archivada disponible"
              : "No archived copy available",
        }),
      ).toBeInTheDocument();
    },
  );

  it("genera metadata neutra cuando no hay copia", async () => {
    courseMocks.getArchivedItemByCanonicalUrl.mockResolvedValue(null);

    await expect(
      metadataFor(["example.com", "lesson", "missing-fixture"]),
    ).resolves.toEqual({ title: "No hay copia archivada disponible" });
  });
});
