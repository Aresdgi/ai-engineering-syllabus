import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { themePreferenceHref } from "@/lib/theme";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/projects"),
  useSearchParams: vi.fn(() => new URLSearchParams("lang=en")),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
  useSearchParams: mocks.useSearchParams,
}));

import { ThemeSelector } from "@/components/theme-selector";

afterEach(() => {
  cleanup();
  mocks.usePathname.mockReturnValue("/projects");
  mocks.useSearchParams.mockReturnValue(new URLSearchParams("lang=en"));
});

describe("ThemeSelector", () => {
  it("por defecto muestra el estado sistema y cicla a claro", () => {
    render(<ThemeSelector />);

    const control = screen.getByRole("link", {
      name: "Tema actual: Sistema. Cambiar a Claro",
    });
    expect(control).toHaveAttribute(
      "href",
      themePreferenceHref("light", "/projects"),
    );
    expect(control).toHaveAttribute("data-theme", "system");
    expect(control.querySelector("svg")).not.toBeNull();
  });

  it("cicla claro → oscuro y oscuro → sistema", () => {
    render(<ThemeSelector theme="light" />);
    expect(
      screen.getByRole("link", {
        name: "Tema actual: Claro. Cambiar a Oscuro",
      }),
    ).toHaveAttribute("href", themePreferenceHref("dark", "/projects"));

    cleanup();

    render(<ThemeSelector theme="dark" />);
    expect(
      screen.getByRole("link", {
        name: "Tema actual: Oscuro. Cambiar a Sistema",
      }),
    ).toHaveAttribute("href", themePreferenceHref("system", "/projects"));
  });

  it("en inglés traduce el texto accesible", () => {
    render(<ThemeSelector theme="dark" lang="en" />);

    const control = screen.getByRole("link", {
      name: "Current theme: Dark. Switch to System",
    });
    expect(control).toHaveAttribute(
      "href",
      themePreferenceHref("system", "/projects"),
    );
    expect(control).toHaveAttribute("aria-label");
    expect(control).toHaveAttribute("title");
  });

  it("conserva el query sin `lang` en el next", () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams("lang=en&doc=guia.md"),
    );
    render(<ThemeSelector theme="system" />);

    expect(
      screen.getByRole("link", {
        name: "Tema actual: Sistema. Cambiar a Claro",
      }),
    ).toHaveAttribute(
      "href",
      themePreferenceHref("light", "/projects?doc=guia.md"),
    );
  });
});
