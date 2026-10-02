import { cleanup, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUiLanguage: vi.fn(async () => "es" as "es" | "en"),
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiLanguage: mocks.getUiLanguage,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import NotFound from "@/app/not-found";

afterEach(() => {
  cleanup();
  mocks.getUiLanguage.mockResolvedValue("es");
});

describe("NotFound", () => {
  it("por defecto muestra el 404 neutro en español", async () => {
    render(await NotFound());

    expect(
      screen.getByRole("heading", { level: 1, name: "Página no encontrada" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Volver a Proyectos" });
    expect(link).toHaveAttribute("href", "/projects");
    expect(link.className).toContain("decoration-muted-foreground");
    expect(link.className).not.toContain("decoration-border");
  });

  it("en inglés traduce el 404 y conserva el enlace al catálogo", async () => {
    mocks.getUiLanguage.mockResolvedValueOnce("en");

    render(await NotFound());

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Projects" }),
    ).toHaveAttribute("href", "/projects");
  });
});
