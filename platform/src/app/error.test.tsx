import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import ErrorPage from "@/app/error";

afterEach(() => {
  cleanup();
  document.documentElement.lang = "";
  vi.restoreAllMocks();
});

describe("ErrorPage", () => {
  it("muestra el error neutro en español y Reintentar llama a retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    render(<ErrorPage error={new Error("fallo")} retry={retry} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No se pudo cargar el catálogo",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledTimes(1);

    const link = screen.getByRole("link", { name: "Volver a Proyectos" });
    expect(link).toHaveAttribute("href", "/projects");
    expect(link.className).toContain("decoration-muted-foreground");
    expect(link.className).not.toContain("decoration-border");
  });

  it("lee el idioma global de <html lang>", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.documentElement.lang = "en";

    render(<ErrorPage error={new Error("failure")} retry={() => {}} />);

    expect(
      await screen.findByRole("heading", {
        name: "Could not load the catalog",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Projects" }),
    ).toHaveAttribute("href", "/projects");
  });
});
