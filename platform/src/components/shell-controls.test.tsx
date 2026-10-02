import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

import { LanguageSelector } from "@/components/language-selector";
import { NavLink } from "@/components/nav-link";
import { ThemeSelector } from "@/components/theme-selector";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function extractBlock(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`No se encontró el bloque: ${marker}`);
  }
  const open = source.indexOf("{", start + marker.length - 1);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }
  throw new Error(`Bloque sin cerrar: ${marker}`);
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`Token no encontrado: --${name}`);
  }
  return match[1].trim();
}

function parseOklch(value: string): { r: number; g: number; b: number } {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) {
    throw new Error(`Color oklch no soportado: ${value}`);
  }
  const lightness = Number(match[1]);
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  return {
    r: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function luminance(value: string): number {
  const color = parseOklch(value);
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes = [
  ["claro", extractBlock(css, ":root {")],
  ["oscuro", extractBlock(css, ".dark {")],
] as const;

const classTokens: Record<string, string> = {
  "bg-background": "background",
  "bg-foreground": "foreground",
  "bg-secondary": "secondary",
  "text-background": "background",
  "text-foreground": "foreground",
  "text-secondary-foreground": "secondary-foreground",
  "text-muted-foreground": "muted-foreground",
};

function classesOf(element: Element): string[] {
  return element.className.split(/\s+/).filter(Boolean);
}

function tokenFromClasses(
  classes: readonly string[],
  prefix: "bg-" | "text-",
): string | null {
  for (const className of classes) {
    if (!className.startsWith(prefix)) {
      continue;
    }
    const name = classTokens[className];
    if (name) {
      return name;
    }
  }
  return null;
}

function activeRatios(element: Element) {
  const classes = classesOf(element);
  const background = tokenFromClasses(classes, "bg-") ?? "background";
  const foreground = tokenFromClasses(classes, "text-") ?? "foreground";
  return {
    surface: (block: string) =>
      contrast(token(block, background), token(block, "background")),
    text: (block: string) =>
      contrast(token(block, foreground), token(block, background)),
  };
}

afterEach(() => {
  cleanup();
  mocks.usePathname.mockReturnValue("/projects");
});

describe("QA-D1: estado activo de los controles del shell", () => {
  it("QA-D1: el idioma activo ES|EN se distingue del fondo con ≥3:1 en claro y oscuro", () => {
    render(<LanguageSelector lang="es" />);

    const active = screen.getByRole("link", { name: "Español" });
    expect(active).toHaveAttribute("aria-current", "true");

    const classes = classesOf(active);
    expect(classes).toContain("bg-foreground");
    expect(classes).toContain("text-background");
    expect(classes).not.toContain("bg-secondary");

    const ratios = activeRatios(active);
    for (const [theme, block] of themes) {
      expect(
        ratios.surface(block),
        `fondo del idioma activo en tema ${theme}`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        ratios.text(block),
        `texto del idioma activo en tema ${theme}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(token(block, "muted-foreground"), token(block, "background")),
        `texto del idioma inactivo en tema ${theme}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("QA-D1: el enlace activo de la nav del shell usa el mismo indicador de alto contraste", () => {
    mocks.usePathname.mockReturnValue("/projects/alpha-unit");
    render(<NavLink href="/projects" label="Proyectos" />);

    const active = screen.getByRole("link", { name: "Proyectos" });
    expect(active).toHaveAttribute("aria-current", "page");

    const classes = classesOf(active);
    expect(classes).toContain("bg-foreground");
    expect(classes).toContain("text-background");
    expect(classes).not.toContain("bg-secondary");

    const ratios = activeRatios(active);
    for (const [theme, block] of themes) {
      expect(
        ratios.surface(block),
        `fondo del enlace activo en tema ${theme}`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        ratios.text(block),
        `texto del enlace activo en tema ${theme}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("QA-D1: el icono del control de tema mantiene ≥3:1 de no-texto en claro y oscuro", () => {
    render(<ThemeSelector theme="dark" />);

    const control = screen.getByRole("link", {
      name: "Tema actual: Oscuro. Cambiar a Sistema",
    });
    expect(classesOf(control)).toContain("text-muted-foreground");

    for (const [theme, block] of themes) {
      expect(
        contrast(token(block, "muted-foreground"), token(block, "background")),
        `icono del tema en tema ${theme}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
