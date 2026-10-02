// @vitest-environment node
/**
 * `extractDocumentTitle`: H1 literal tras el frontmatter, sin decorar.
 * Los casos reales usan fixtures verbatim localizados en runtime.
 */

import { describe, expect, it } from "vitest";

import {
  fixturesMatching,
  readFixture,
  readFixtureEntry,
} from "./fixture-reader.test-helper";
import { parseProjectOrder } from "./order";
import { extractDocumentTitle, markdownInlineToText } from "./title";

describe("extractDocumentTitle", () => {
  it("extrae el H1 literal de una lección real con frontmatter", () => {
    const lesson = fixturesMatching(
      (entry) =>
        entry.path.startsWith("content/lessons/") &&
        entry.path.endsWith(".es.md"),
    )[0];
    expect(lesson).toBeDefined();
    const markdown = readFixtureEntry(lesson!);
    expect(markdown.startsWith("---")).toBe(true);

    const title = extractDocumentTitle(markdown);
    expect(title).not.toBeNull();
    expect(markdown).toContain(`\n# ${title}\n`);
    expect(title).not.toContain("---");
    expect(title?.startsWith("title:")).toBe(false);
  });

  it("extrae el H1 de un README real de proyecto sin frontmatter", () => {
    const readmes = fixturesMatching((entry) =>
      /^content\/projects\/[^/]+\/README\.md$/.test(entry.path),
    );
    expect(readmes.length).toBeGreaterThan(0);
    for (const readme of readmes) {
      const markdown = readFixtureEntry(readme);
      const expected = /^#\s+(.+?)\s*$/m.exec(markdown)?.[1] ?? null;
      expect(expected).not.toBeNull();
      expect(extractDocumentTitle(markdown)).toBe(expected);
    }
  });

  it("ignora un H1 dentro del frontmatter y los bloques de código", () => {
    const withFrontmatter = [
      "---",
      "title: Título del frontmatter",
      "# esto es un comentario YAML, no un encabezado",
      "---",
      "",
      "# Título real",
      "",
    ].join("\n");
    expect(extractDocumentTitle(withFrontmatter)).toBe("Título real");

    const withFence = [
      "# Documento",
      "",
      "```sh",
      "# esto es un comentario de shell",
      "```",
    ].join("\n");
    expect(extractDocumentTitle(withFence)).toBe("Documento");
  });

  it("devuelve el primer H1 aunque haya encabezados de menor nivel antes", () => {
    expect(extractDocumentTitle("## Comienza aquí\n\n# Título\n")).toBe(
      "Título",
    );
    expect(
      extractDocumentTitle("Introducción sin encabezado\n\n# Título"),
    ).toBe("Título");
  });

  it("F-05/H-4: convierte el H1 con Markdown inline a texto plano", () => {
    expect(extractDocumentTitle("# Un **título** con `código`\n")).toBe(
      "Un título con código",
    );
    expect(extractDocumentTitle("# Título con cierre ###\n")).toBe(
      "Título con cierre",
    );
  });

  it("devuelve null si no hay H1", () => {
    expect(extractDocumentTitle("## Solo nivel 2\n\nTexto\n")).toBeNull();
    expect(
      extractDocumentTitle("---\ntitle: x\n---\n\nSin encabezados\n"),
    ).toBeNull();
    expect(extractDocumentTitle("")).toBeNull();
  });
});

describe("markdownInlineToText (F-05/H-4)", () => {
  it("quita backticks de código inline sin tocar las palabras", () => {
    expect(markdownInlineToText("`./alpha-unit`")).toBe("./alpha-unit");
    expect(markdownInlineToText("Prefijo `code` sufijo")).toBe(
      "Prefijo code sufijo",
    );
  });

  it("quita énfasis fuerte, simple y tachado", () => {
    expect(markdownInlineToText("**negrita**")).toBe("negrita");
    expect(markdownInlineToText("__negrita__")).toBe("negrita");
    expect(markdownInlineToText("*cursiva*")).toBe("cursiva");
    expect(markdownInlineToText("_cursiva_")).toBe("cursiva");
    expect(markdownInlineToText("~~tachado~~")).toBe("tachado");
  });

  it("conserva el texto de enlaces e imágenes", () => {
    expect(markdownInlineToText("[Texto](./ruta.md)")).toBe("Texto");
    expect(markdownInlineToText("![Texto alternativo](./img.png)")).toBe(
      "Texto alternativo",
    );
    expect(markdownInlineToText("[`code`](./ruta.md)")).toBe("code");
    expect(markdownInlineToText("Ver [la guía](./guia.md) y más")).toBe(
      "Ver la guía y más",
    );
  });

  it("respeta los escapes de puntuación Markdown", () => {
    expect(markdownInlineToText("\\*no énfasis\\*")).toBe("*no énfasis*");
    expect(markdownInlineToText("\\`no código\\`")).toBe("`no código`");
    expect(markdownInlineToText("100\\% literal")).toBe("100% literal");
  });

  it("no toca guiones bajos dentro de palabras", () => {
    expect(markdownInlineToText("snake_case_name")).toBe("snake_case_name");
  });

  it("sobre el README real, ninguna etiqueta conserva decoración inline", () => {
    const readme = readFixture("projects/README.md");
    const entries = parseProjectOrder(readme).entries;
    const decorated = entries.filter(
      (entry) => entry.label.includes("`") || entry.label.includes("**"),
    );
    expect(decorated.length).toBeGreaterThan(0);
    for (const entry of decorated) {
      const plain = markdownInlineToText(entry.label);
      expect(plain).not.toContain("`");
      expect(plain).not.toContain("**");
      expect(plain).toContain(entry.sourcePath.split("/").pop() ?? "");
    }
  });
});
