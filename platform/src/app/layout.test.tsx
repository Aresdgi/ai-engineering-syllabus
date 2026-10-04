import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUiLanguage: vi.fn(async () => "es" as "es" | "en"),
  getUiTheme: vi.fn(async () => "system" as "light" | "dark" | "system"),
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiLanguage: mocks.getUiLanguage,
}));

vi.mock("@/lib/theme/server", () => ({
  getUiTheme: mocks.getUiTheme,
}));

import RootLayout, { generateMetadata } from "@/app/layout";

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

const lightTokens = extractBlock(css, ":root {");
const darkTokens = extractBlock(css, ".dark {");

describe("RootLayout / globals.css", () => {
  it("D-07: el oscuro se fuerza con .dark o sigue prefers-color-scheme sin .light", () => {
    expect(css).toContain("&:where(.dark, .dark *)");
    expect(css).toContain(":root:not(.light)");
    expect(css).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark/);
    expect(css).toMatch(/\.light\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toContain("color-scheme: light dark;");
    expect(token(lightTokens, "background")).not.toBe(
      token(darkTokens, "background"),
    );
    expect(token(lightTokens, "foreground")).not.toBe(
      token(darkTokens, "foreground"),
    );
  });

  it("D-07: texto, muted, estado roto y foco pasan AA en tema claro", () => {
    const background = token(lightTokens, "background");
    expect(
      contrast(token(lightTokens, "foreground"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(lightTokens, "muted-foreground"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(lightTokens, "destructive"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(lightTokens, "ring"), background),
    ).toBeGreaterThanOrEqual(3);
  });

  it("D-07: texto, muted, estado roto y foco pasan AA en tema oscuro", () => {
    const background = token(darkTokens, "background");
    expect(
      contrast(token(darkTokens, "foreground"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(darkTokens, "muted-foreground"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(darkTokens, "destructive"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(darkTokens, "ring"), background),
    ).toBeGreaterThanOrEqual(3);
  });

  it("D-01: el primer plano sobre --muted pasa AA en claro (código en blockquote)", () => {
    expect(
      contrast(token(lightTokens, "foreground"), token(lightTokens, "muted")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("D-04: el variant hover-fine aplica :hover bajo la media de puntero fino", () => {
    const block = extractBlock(css, "@custom-variant hover-fine");

    expect(block).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(block).toMatch(/&:hover\s*\{[^}]*@slot/);
  });

  it("D-16: globals.css no importa tw-animate-css", () => {
    expect(css).not.toContain("tw-animate-css");
  });
});

describe("RootLayout: idioma global de la interfaz", () => {
  it("html lang y el shell siguen el idioma de la cookie", async () => {
    mocks.getUiLanguage.mockResolvedValueOnce("en");

    const element = (await RootLayout({
      children: null,
      params: Promise.resolve({}),
    })) as ReactElement<{
      lang: string;
      children: ReactElement<{
        children: ReactElement<{ lang: string }>;
      }>;
    }>;

    expect(element.props.lang).toBe("en");
    expect(element.props.children.props.children.props.lang).toBe("en");
  });

  it("aplica la clase de tema global en <html> (system sin clase)", async () => {
    const renderLayout = () =>
      RootLayout({ children: null, params: Promise.resolve({}) });

    mocks.getUiTheme.mockResolvedValueOnce("dark");
    const dark = await renderLayout();
    expect(String(dark.props.className)).toContain("dark");

    mocks.getUiTheme.mockResolvedValueOnce("light");
    const light = await renderLayout();
    expect(String(light.props.className)).toContain("light");
    expect(String(light.props.className)).not.toContain("dark");

    mocks.getUiTheme.mockResolvedValueOnce("system");
    const system = await renderLayout();
    expect(String(system.props.className)).not.toMatch(/\b(dark|light)\b/);
  });

  it("metadata neutra en ambos idiomas", async () => {
    mocks.getUiLanguage.mockResolvedValue("en");
    const english = await generateMetadata();
    expect(english.title).toBe("AI Engineering Study Platform");
    expect(String(english.description)).toMatch(/Study browser/);

    mocks.getUiLanguage.mockResolvedValue("es");
    const spanish = await generateMetadata();
    expect(spanish.title).toBe("AI Engineering Study Platform");
    expect(String(spanish.description)).toMatch(/Navegador de estudio/);
  });
});
