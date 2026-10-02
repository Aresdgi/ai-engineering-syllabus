import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/projects"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
  useSearchParams: mocks.useSearchParams,
}));

import { AppShell } from "@/components/app-shell";
import { SourceUnavailableState } from "@/components/source-unavailable-state";

afterEach(() => {
  cleanup();
  mocks.usePathname.mockReturnValue("/projects");
});

function renderShell() {
  return render(
    <AppShell>
      <SourceUnavailableState />
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("expone los landmarks principales, el skip link y el contenido", () => {
    renderShell();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenido");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    const skipLink = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(skipLink).toHaveAttribute("href", "#contenido");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
  });

  it("enlaza las tres secciones reales del catálogo", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "Contextos" })).toHaveAttribute(
      "href",
      "/contexts",
    );
    expect(screen.getByRole("link", { name: "Lecciones" })).toHaveAttribute(
      "href",
      "/lessons",
    );
  });

  it("marca con aria-current la sección activa, incluidas rutas anidadas", () => {
    mocks.usePathname.mockReturnValue("/projects/alpha-unit");
    renderShell();

    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Contextos" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Lecciones" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("cambia la sección activa según la ruta", () => {
    mocks.usePathname.mockReturnValue("/lessons");
    renderShell();

    expect(screen.getByRole("link", { name: "Lecciones" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Proyectos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("mantiene Buscar, Tutor y Progreso deshabilitados como próximos hitos", () => {
    const { container } = renderShell();

    const disabled = Array.from(
      container.querySelectorAll("[aria-disabled='true']"),
    );
    expect(disabled.map((element) => element.textContent)).toEqual([
      "Buscar (próximo hito)",
      "Tutor (próximo hito)",
      "Progreso (próximo hito)",
    ]);

    for (const item of ["Buscar", "Tutor", "Progreso"]) {
      expect(
        screen.queryByRole("link", { name: new RegExp(item) }),
      ).not.toBeInTheDocument();
    }
  });

  it("incluye el selector global de idioma a la derecha de la navegación", () => {
    renderShell();

    expect(
      screen.getByRole("navigation", { name: "Idioma" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/preferences/language/en?next=%2Fprojects",
    );
  });

  it("incluye el control de tema junto al selector de idioma", () => {
    renderShell();

    expect(
      screen.getByRole("navigation", { name: "Tema" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Tema actual: Sistema. Cambiar a Claro",
      }),
    ).toHaveAttribute("href", "/preferences/theme/light?next=%2Fprojects");
  });

  it("en inglés traduce los textos de interfaz del shell", () => {
    render(
      <AppShell lang="en">
        <SourceUnavailableState lang="en" />
      </AppShell>,
    );

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#contenido");
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "Contexts" })).toHaveAttribute(
      "href",
      "/contexts",
    );
    expect(screen.getByRole("link", { name: "Lessons" })).toHaveAttribute(
      "href",
      "/lessons",
    );
    expect(screen.getByText("Content not synced yet")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Language" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Theme" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Current theme: System. Switch to Light",
      }),
    ).toBeInTheDocument();

    const disabled = Array.from(
      document.querySelectorAll("[aria-disabled='true']"),
    ).map((element) => element.textContent);
    expect(disabled).toEqual([
      "Search (upcoming milestone)",
      "Tutor (upcoming milestone)",
      "Progress (upcoming milestone)",
    ]);
  });

  it("D-12: a 375px la nav cabe en una línea y los ítems no disponibles se ocultan", () => {
    const { container } = renderShell();

    const headerBox = container.querySelector("header > div");
    expect(headerBox?.className).toContain("py-2");
    expect(headerBox?.className).toContain("sm:py-3");

    const brand = screen.getByRole("link", {
      name: "AI Engineering Study Platform",
    });
    expect(brand.className).toContain("leading-none");
    expect(brand.className).toContain("shrink-0");

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.className).toContain("min-w-0");
    expect(nav.className).toContain("overflow-x-auto");
    expect(nav.querySelector("ul")?.className).toContain("flex-nowrap");

    const disabled = Array.from(
      container.querySelectorAll("[aria-disabled='true']"),
    );
    for (const element of disabled) {
      const item = element.closest("li");
      expect(item?.className).toContain("hidden");
      expect(item?.className).toContain("lg:block");
    }
  });

  it("QA-D3: a 375px los controles van en la fila del título y la nav ocupa su propia fila completa", () => {
    const { container } = renderShell();

    const headerBox = container.querySelector("header > div");
    expect(headerBox?.className).toContain("flex-wrap");
    expect(headerBox?.className).toContain("sm:flex-nowrap");
    expect(headerBox?.className).toContain("gap-y-1");
    expect(headerBox?.className).toContain("py-2");
    expect(headerBox?.className).not.toMatch(/(^|\s)py-3(\s|$)/);

    const brand = screen.getByRole("link", {
      name: "AI Engineering Study Platform",
    });
    expect(brand.className).toContain("mr-auto");

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.className).toContain("order-last");
    expect(nav.className).toContain("w-full");
    expect(nav.className).toContain("sm:order-none");
    expect(nav.className).toContain("sm:w-auto");
    expect(nav.className).not.toContain("flex-1");

    const language = screen.getByRole("navigation", { name: "Idioma" });
    const theme = screen.getByRole("navigation", { name: "Tema" });
    expect(language.className).not.toContain("order-last");
    expect(theme.className).not.toContain("order-last");
    expect(language.className).not.toContain("w-full");
    expect(theme.className).not.toContain("w-full");

    const headerItems = Array.from(headerBox?.children ?? []).map(
      (item) => item.getAttribute("aria-label") ?? item.textContent,
    );
    expect(headerItems).toEqual([
      "AI Engineering Study Platform",
      "Principal",
      "Idioma",
      "Tema",
    ]);
  });
});
