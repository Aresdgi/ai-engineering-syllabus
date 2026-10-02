import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { languagePreferenceHref } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/contexts/alpha-unit"),
  useSearchParams: vi.fn(() => new URLSearchParams("doc=guia.md&lang=en")),
  buildHref: vi.fn(() => "#"),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
  useSearchParams: mocks.useSearchParams,
}));

import { LanguageSelector } from "@/components/language-selector";

afterEach(() => {
  cleanup();
  mocks.usePathname.mockReturnValue("/contexts/alpha-unit");
  mocks.useSearchParams.mockReturnValue(
    new URLSearchParams("doc=guia.md&lang=en"),
  );
  mocks.buildHref.mockClear();
});

describe("LanguageSelector global", () => {
  it("renderiza ES y EN con aria-current en el idioma activo", () => {
    render(<LanguageSelector lang="es" />);

    expect(
      screen.getByRole("navigation", { name: "Idioma" }),
    ).toBeInTheDocument();

    const spanish = screen.getByRole("link", { name: "Español" });
    const english = screen.getByRole("link", { name: "English" });

    expect(spanish).toHaveAttribute("aria-current", "true");
    expect(english).not.toHaveAttribute("aria-current");
    expect(english).toHaveAttribute("lang", "en");
    expect(english).toHaveAttribute("hreflang", "en");
    expect(spanish).toHaveAttribute("lang", "es");
    expect(spanish).toHaveAttribute("hreflang", "es");
  });

  it("enlaza a la preferencia quitando `lang` y conservando el resto del query", () => {
    render(<LanguageSelector lang="es" />);

    const expectedNext = "/contexts/alpha-unit?doc=guia.md";
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      languagePreferenceHref("en", expectedNext),
    );
    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
      "href",
      languagePreferenceHref("es", expectedNext),
    );
  });

  it("usa `es` por defecto y no toca la ruta si no hay query", () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
    render(<LanguageSelector />);

    expect(
      screen.getByRole("navigation", { name: "Idioma" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      languagePreferenceHref("en", "/contexts/alpha-unit"),
    );
  });

  it("en inglés el grupo y el activo cambian", () => {
    render(<LanguageSelector lang="en" />);

    expect(
      screen.getByRole("navigation", { name: "Language" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Español" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("ignora la API por página de la ola anterior (variants/currentPath/buildHref)", () => {
    const { container } = render(
      <LanguageSelector
        lang="es"
        variants={[]}
        currentPath="content/projects/alpha-unit/README.md"
        buildHref={mocks.buildHref}
      />,
    );

    expect(mocks.buildHref).not.toHaveBeenCalled();
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });
});
