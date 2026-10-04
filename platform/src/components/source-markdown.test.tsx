import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceMarkdown } from "@/components/source-markdown";
import type { MarkdownUrl, MarkdownUrlResolver } from "@/lib/markdown/types";
import {
  parseSourceFixtureManifest,
  SOURCE_FIXTURES_MANIFEST_NAME,
  SOURCE_FIXTURES_RELATIVE_DIR,
} from "@/source/fixtures";

afterEach(cleanup);

const PLATFORM_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const FIXTURES_ROOT = path.join(PLATFORM_ROOT, SOURCE_FIXTURES_RELATIVE_DIR);
const CONTENT_ROOT = path.resolve(PLATFORM_ROOT, "..", "content");

type CorpusFile = { path: string; content: string };

function readIfText(file: string): string | null {
  try {
    const content = readFileSync(file, "utf8");
    return content.includes("\u0000") ? null : content;
  } catch {
    return null;
  }
}

function listMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function loadFixtureFiles(): CorpusFile[] {
  const manifestPath = path.join(FIXTURES_ROOT, SOURCE_FIXTURES_MANIFEST_NAME);
  if (!existsSync(manifestPath)) {
    return [];
  }
  const parsed = parseSourceFixtureManifest(readFileSync(manifestPath, "utf8"));
  if (!parsed.ok) {
    throw new Error(
      `El manifiesto de fixtures es inválido: ${parsed.messages.join("; ")}`,
    );
  }
  return parsed.manifest.fixtures.flatMap((fixture): CorpusFile[] => {
    const file = path.join(
      FIXTURES_ROOT,
      fixture.commit,
      ...fixture.path.split("/"),
    );
    const content = readIfText(file);
    return content === null ? [] : [{ path: file, content }];
  });
}

let fixtureFiles: CorpusFile[] | null = null;
let contentFiles: CorpusFile[] | null = null;

function loadContentFiles(): CorpusFile[] {
  if (!existsSync(CONTENT_ROOT)) {
    return [];
  }
  contentFiles ??= listMarkdownFiles(CONTENT_ROOT).flatMap(
    (file): CorpusFile[] => {
      const content = readIfText(file);
      return content === null ? [] : [{ path: file, content }];
    },
  );
  return contentFiles;
}

/**
 * Localiza en runtime un archivo real del corpus que cumple `predicate`.
 * Primero busca entre los fixtures declarados en el manifiesto (ADR-009) y,
 * si el fixture aún no existe, cae al corpus real de `content/`. Nunca se
 * escribe un slug, título ni path educativo en este archivo.
 */
function findVerbatimWhere(
  predicate: (file: CorpusFile) => boolean,
): CorpusFile {
  fixtureFiles ??= loadFixtureFiles();
  const fromFixtures = fixtureFiles.find(predicate);
  if (fromFixtures) {
    return fromFixtures;
  }

  const fromContent = loadContentFiles().find(predicate);
  if (fromContent) {
    return fromContent;
  }

  throw new Error("El corpus real no contiene ningún archivo esperado");
}

function findVerbatim(needle: string): CorpusFile {
  return findVerbatimWhere((file) => file.content.includes(needle));
}

function extractElement(content: string, opening: string): string {
  const start = content.indexOf(opening);
  if (start === -1) {
    throw new Error(`No se encontró "${opening}" en el archivo localizado`);
  }
  if (opening.startsWith("<img") || opening.startsWith("<br")) {
    const end = content.indexOf(">", start);
    return content.slice(start, end + 1);
  }
  const tag = opening.slice(1, -1);
  const close = `</${tag}>`;
  const end = content.indexOf(close, start);
  if (end === -1) {
    throw new Error(`No se encontró el cierre de "${opening}"`);
  }
  return content.slice(start, end + close.length);
}

const passthroughResolver: MarkdownUrlResolver = (rawHref) => ({
  kind: "external",
  href: rawHref,
});

function renderMarkdown(
  markdown: string,
  resolveUrl: MarkdownUrlResolver = passthroughResolver,
) {
  return render(<SourceMarkdown markdown={markdown} resolveUrl={resolveUrl} />);
}

describe("SourceMarkdown: GFM, frontmatter y HTML embebido reales", () => {
  it("renderiza tablas GFM y oculta el frontmatter YAML del documento real", () => {
    const file = findVerbatimWhere(
      (candidate) =>
        candidate.content.startsWith("---\n") &&
        candidate.content.includes("| ---"),
    );

    const { container } = renderMarkdown(file.content);
    const text = container.textContent ?? "";

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("th").length).toBeGreaterThan(0);
    expect(container.querySelector("h1")).not.toBeNull();
    expect(text).not.toContain("tags:");
    expect(text).not.toContain("author:");
    expect(text.trimStart().startsWith("---")).toBe(false);
  });

  it("renderiza las task lists GFM del documento real como checkboxes deshabilitados", () => {
    const file = findVerbatim("- [ ]");

    const { container } = renderMarkdown(file.content);
    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );

    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((checkbox) => {
      expect(checkbox.disabled).toBe(true);
    });
  });

  it("renderiza el <details> verbatim del documento real conservando summary y texto", () => {
    const file = findVerbatim("<details>");
    const fragment = extractElement(file.content, "<details>");

    const { container } = renderMarkdown(fragment);
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");

    expect(details).not.toBeNull();
    expect(summary).not.toBeNull();

    const sourceDom = new DOMParser().parseFromString(fragment, "text/html");
    const sourceSummary = sourceDom.querySelector("summary");
    expect(sourceSummary).not.toBeNull();
    expect(summary?.textContent).toBe(sourceSummary?.textContent);
  });

  it("renderiza la <img> relativa verbatim del documento real con su alt y width literales", () => {
    const file = findVerbatim("<img");
    const fragment = extractElement(file.content, "<img");

    const sourceDom = new DOMParser().parseFromString(fragment, "text/html");
    const sourceImg = sourceDom.querySelector("img");
    expect(sourceImg).not.toBeNull();

    const rawSrc = sourceImg?.getAttribute("src") ?? "";
    const expectedHref = "https://raw.example.invalid/alpha-unit/asset.png";
    const seen: string[] = [];
    const resolveUrl: MarkdownUrlResolver = (rawHref) => {
      seen.push(rawHref);
      return {
        kind: "source",
        href: expectedHref,
        targetPath: "content/projects/alpha-unit/asset.png",
        targetKind: "raw",
      };
    };

    const { container } = renderMarkdown(fragment, resolveUrl);
    const img = container.querySelector("img");

    expect(seen).toEqual([rawSrc]);
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(expectedHref);
    expect(img?.getAttribute("alt")).toBe(sourceImg?.getAttribute("alt"));
    expect(img?.getAttribute("width")).toBe(sourceImg?.getAttribute("width"));
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("renderiza HTML crudo permitido (table, div, span, br) y conserva su texto", () => {
    const { container } = renderMarkdown(
      [
        "<div><span>alpha</span></div>",
        "",
        "<table>",
        "<thead><tr><th>alpha</th></tr></thead>",
        "<tbody><tr><td>beta</td></tr></tbody>",
        "</table>",
        "",
        "gamma<br />delta",
      ].join("\n"),
    );

    expect(container.querySelector("div span")?.textContent).toBe("alpha");
    expect(container.querySelectorAll("table th").length).toBe(1);
    expect(container.querySelector("table td")?.textContent).toBe("beta");
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.textContent).toContain("gamma");
    expect(container.textContent).toContain("delta");
  });

  it("aplica la alineación GFM de las tablas", () => {
    const { container } = renderMarkdown(
      ["| alpha | beta |", "| :--- | ---: |", "| gamma | delta |"].join("\n"),
    );

    const headers = container.querySelectorAll<HTMLTableCellElement>("th");
    expect(headers[0]?.style.textAlign).toBe("left");
    expect(headers[1]?.style.textAlign).toBe("right");
  });
});

describe("SourceMarkdown: saneado de HTML no permitido", () => {
  it("elimina <script>, onerror y URLs javascript: conservando el texto", () => {
    const { container } = renderMarkdown(
      [
        '<script>alert("alpha")</script>',
        "",
        '<img src="https://example.com/alpha.png" onerror="alert(1)" alt="alpha image" />',
        "",
        "[alpha link](javascript:alert(1))",
      ].join("\n"),
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("style")).toBeNull();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("onerror")).toBeNull();

    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.textContent).toContain("alpha link");
  });

  it("elimina <iframe>, <object> y <embed>", () => {
    const { container } = renderMarkdown(
      [
        '<iframe src="https://example.com/alpha"></iframe>',
        '<object data="https://example.com/alpha"></object>',
        '<embed src="https://example.com/alpha" />',
      ].join("\n"),
    );

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("object")).toBeNull();
    expect(container.querySelector("embed")).toBeNull();
  });
});

describe("SourceMarkdown: resolución de URLs", () => {
  const urls: Record<string, MarkdownUrl> = {
    "./alpha.md": {
      kind: "internal",
      href: "/projects/alpha-unit",
      targetPath: "content/projects/alpha-unit/README.md",
    },
    "https://example.com/alpha-spec": {
      kind: "external",
      href: "https://example.com/alpha-spec",
    },
    "./beta.pdf": {
      kind: "source",
      href: "https://raw.example.invalid/commit/beta.pdf",
      targetPath: "content/projects/alpha-unit/beta.pdf",
      targetKind: "raw",
    },
    "./missing.md": {
      kind: "broken",
      href: null,
      rawHref: "./missing.md",
    },
  };

  const markdown = [
    "[alpha](./alpha.md)",
    "[beta](https://example.com/alpha-spec)",
    "[gamma](./beta.pdf)",
    "[delta](./missing.md)",
    "[epsilon](#section)",
  ].join("\n\n");

  function renderResolved() {
    const resolveUrl = vi.fn<MarkdownUrlResolver>(
      (rawHref) => urls[rawHref] ?? { kind: "broken", href: null, rawHref },
    );
    const view = renderMarkdown(markdown, resolveUrl);
    return { ...view, resolveUrl };
  }

  it("resuelve internal con next/link y conserva el texto", () => {
    const { container } = renderResolved();
    const link = container.querySelector('a[href="/projects/alpha-unit"]');
    expect(link?.textContent).toBe("alpha");
  });

  it("resuelve external con target y aviso accesible de salida", () => {
    const { container } = renderResolved();
    const link = container.querySelector(
      'a[href="https://example.com/alpha-spec"]',
    );

    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toContain("beta");
    expect(link?.querySelector(".sr-only")?.textContent).toContain(
      "se abre en una pestaña nueva",
    );
  });

  it("F-04: resuelve source con target, rel y el mismo aviso de salida que los externos", () => {
    const { container } = renderResolved();
    const link = container.querySelector(
      'a[href="https://raw.example.invalid/commit/beta.pdf"]',
    );

    expect(link?.textContent).toContain("gamma");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.querySelector(".sr-only")?.textContent).toContain(
      "se abre en una pestaña nueva",
    );
  });

  it("D-08: subraya con color de contraste y hover solo con puntero fino", () => {
    const { container } = renderResolved();
    const internal = container.querySelector('a[href="/projects/alpha-unit"]');
    const external = container.querySelector(
      'a[href="https://example.com/alpha-spec"]',
    );
    const source = container.querySelector(
      'a[href="https://raw.example.invalid/commit/beta.pdf"]',
    );

    for (const link of [internal, external, source]) {
      expect(link?.className).toContain("decoration-muted-foreground");
      expect(link?.className).not.toContain("decoration-border");
      expect(link?.className).toContain("hover-fine:decoration-foreground");
    }
  });

  it("D-09: resuelve broken sin href y con indicación visible y accesible", () => {
    const { container } = renderResolved();
    const broken = screen.getByText("delta");

    expect(broken.tagName).toBe("SPAN");
    const wrapper = broken.closest('[aria-disabled="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
    expect(wrapper).toHaveAttribute(
      "title",
      "Enlace roto en el origen: ./missing.md",
    );
    expect(wrapper?.textContent).toContain("enlace roto");
    expect(broken.closest("a")).toBeNull();
    expect(container.querySelector('a[href*="missing"]')).toBeNull();
  });

  it("deja las anclas tal cual sin llamar al resolvedor", () => {
    const { container, resolveUrl } = renderResolved();
    const anchor = container.querySelector('a[href="#section"]');

    expect(anchor?.textContent).toBe("epsilon");
    expect(resolveUrl).not.toHaveBeenCalledWith("#section");
  });

  it("D-09: muestra el alt literal y la indicación de enlace roto en una imagen rota", () => {
    const view = renderMarkdown(
      "![alpha diagram](./missing.png)",
      (rawHref) => ({ kind: "broken", href: null, rawHref }),
    );

    expect(view.container.querySelector("img")).toBeNull();
    const broken = screen.getByText("alpha diagram");
    expect(broken.tagName).toBe("SPAN");
    const wrapper = broken.closest('[aria-disabled="true"]');
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
    expect(wrapper).toHaveAttribute(
      "title",
      "Enlace roto en el origen: ./missing.png",
    );
    expect(wrapper?.textContent).toContain("enlace roto");
  });

  it("renderiza imágenes internas y externas como <img>", () => {
    const internalHref = "/assets/alpha.png";
    const externalHref = "https://example.com/beta.png";
    const { container } = renderMarkdown(
      ["![alpha](./alpha.png)", "![beta](https://example.com/beta.png)"].join(
        "\n\n",
      ),
      (rawHref) =>
        rawHref === "./alpha.png"
          ? { kind: "internal", href: internalHref, targetPath: "alpha.png" }
          : { kind: "external", href: externalHref },
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]?.getAttribute("src")).toBe(internalHref);
    expect(images[0]?.getAttribute("alt")).toBe("alpha");
    expect(images[1]?.getAttribute("src")).toBe(externalHref);
    expect(images[1]?.getAttribute("alt")).toBe("beta");
  });
});

describe("SourceMarkdown: idioma global e hrefs internos servidos por la app", () => {
  it("traduce los copys neutros al inglés", () => {
    const { container } = render(
      <SourceMarkdown
        markdown={[
          "[alpha](./missing.md)",
          "",
          "[beta](https://example.com/alpha-spec)",
        ].join("\n")}
        resolveUrl={(rawHref) =>
          rawHref === "./missing.md"
            ? { kind: "broken", href: null, rawHref }
            : { kind: "external", href: rawHref }
        }
        lang="en"
      />,
    );

    const broken = container.querySelector('[aria-disabled="true"]');
    expect(broken?.getAttribute("title")).toBe(
      "Broken link in the source: ./missing.md",
    );
    expect(broken?.textContent).toContain("(broken link)");

    const external = container.querySelector(
      'a[href="https://example.com/alpha-spec"]',
    );
    expect(external?.querySelector(".sr-only")?.textContent).toContain(
      "(opens in a new tab)",
    );
    expect(external?.querySelector(".sr-only")?.textContent).not.toContain(
      "pestaña",
    );
  });

  it("los enlaces source internos abren en pestaña nueva sin aviso de salida", () => {
    const href = "/source-files/content/projects/alpha-unit/beta.pdf";
    const { container } = renderMarkdown("[gamma](./beta.pdf)", () => ({
      kind: "source",
      href,
      targetPath: "content/projects/alpha-unit/beta.pdf",
      targetKind: "raw",
    }));

    const link = container.querySelector(`a[href="${href}"]`);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.querySelector(".sr-only")).toBeNull();
    expect(link?.textContent).toBe("gamma");
  });

  it("renderiza la imagen servida por /source-files como <img>", () => {
    const src = "/source-files/content/projects/alpha-unit/.learn/preview.png";
    const { container } = renderMarkdown(
      "![alpha](./.learn/preview.png)",
      () => ({
        kind: "source",
        href: src,
        targetPath: "content/projects/alpha-unit/.learn/preview.png",
        targetKind: "raw",
      }),
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(src);
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });
});

describe("SourceMarkdown: prosa y bloques", () => {
  it("renderiza jerarquía de encabezados, listas, cita y bloques de código", () => {
    const { container } = renderMarkdown(
      [
        "# alpha",
        "## beta",
        "### gamma",
        "Texto con **negrita**, *énfasis* y `código`.",
        "",
        "- uno",
        "- dos",
        "",
        "1. primero",
        "2. segundo",
        "",
        "> cita neutra",
        "",
        "```",
        "const alpha = 1;",
        "```",
        "",
        "---",
      ].join("\n"),
    );

    expect(container.querySelector("h1")?.textContent).toBe("alpha");
    expect(container.querySelector("h2")?.textContent).toBe("beta");
    expect(container.querySelector("h3")?.textContent).toBe("gamma");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelector("blockquote")?.textContent).toContain(
      "cita neutra",
    );
    expect(container.querySelector("pre code")?.textContent).toContain(
      "const alpha = 1;",
    );
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("conserva el start de una lista ordenada que empieza en 0", () => {
    const { container } = renderMarkdown(
      ["0. alpha", "1. beta", "2. gamma"].join("\n"),
    );

    expect(container.querySelector("ol")?.getAttribute("start")).toBe("0");
  });

  it("envuelve la tabla en un contenedor con scroll propio", () => {
    const { container } = renderMarkdown(
      ["| alpha |", "| --- |", "| beta |"].join("\n"),
    );

    const wrapper = container.querySelector("table")?.parentElement;
    expect(wrapper?.className).toContain("overflow-x-auto");
  });
});

describe("SourceMarkdown: material archivado y respaldo Wayback (Hito 2.5)", () => {
  it("resuelve external-archive como enlace interno con indicador visible", () => {
    const href = "/archive/example.com/lesson/fixture-lesson";
    const { container } = render(
      <SourceMarkdown
        markdown="[alpha](https://example.com/lesson/fixture-lesson)"
        resolveUrl={() => ({
          kind: "external-archive",
          href,
          originalHref: "https://example.com/lesson/fixture-lesson",
          archiveId: "fixture-archive-id",
        })}
      />,
    );

    const link = container.querySelector(`a[href="${href}"]`);
    expect(link?.textContent).toContain("alpha");
    expect(link?.textContent).toContain("(copia archivada)");
    expect(link?.getAttribute("target")).toBeNull();
  });

  it("traduce el indicador de copia archivada al inglés", () => {
    const { container } = render(
      <SourceMarkdown
        markdown="[alpha](https://example.com/lesson/fixture-lesson)"
        resolveUrl={() => ({
          kind: "external-archive",
          href: "/archive/example.com/lesson/fixture-lesson",
          originalHref: "https://example.com/lesson/fixture-lesson",
          archiveId: "fixture-archive-id",
        })}
        lang="en"
      />,
    );

    expect(container.textContent).toContain("(archived copy)");
  });

  it("mantiene el original y añade el respaldo Wayback marcado con la fecha", () => {
    const originalHref = "https://example.com/tool/fixture-tool";
    const backupHref =
      "http://web.archive.org/web/20260613092255/https://example.com/tool/fixture-tool";
    const capturedAt = "2026-06-13T09:22:55.000Z";
    const expectedDate = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
    }).format(new Date(capturedAt));

    const { container } = render(
      <SourceMarkdown
        markdown={`[alpha](${originalHref})`}
        resolveUrl={() => ({
          kind: "external",
          href: originalHref,
          backup: { href: backupHref, capturedAt },
        })}
      />,
    );

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", originalHref);
    expect(links[0]?.getAttribute("target")).toBe("_blank");
    expect(links[1]).toHaveAttribute("href", backupHref);
    expect(links[1]?.getAttribute("target")).toBe("_blank");
    expect(links[1]?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[1]?.textContent).toContain("Respaldo en Wayback Machine");
    expect(links[1]?.textContent).toContain(expectedDate);
  });

  it("renderiza las imágenes archive-asset desde /archive-assets con alt literal", () => {
    const sha = "a".repeat(64);
    const { container } = render(
      <SourceMarkdown
        markdown="![fixture image](https://example.com/images/fixture-image.png)"
        resolveUrl={() => ({
          kind: "archive-asset",
          href: `/archive-assets/${sha}`,
          sha256: sha,
        })}
      />,
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(`/archive-assets/${sha}`);
    expect(img?.getAttribute("alt")).toBe("fixture image");
  });
});

describe("SourceMarkdown: accesibilidad de prosa y bloques (ronda post-QA M2B)", () => {
  it("D-01: el `code` dentro de `blockquote` pasa a primer plano (AA en claro)", () => {
    const { container } = renderMarkdown("> Texto con `alpha`.\n");

    const blockquote = container.querySelector("blockquote");
    expect(blockquote?.className).toContain("text-muted-foreground");
    expect(blockquote?.className).toContain("[&_code]:text-foreground");
    expect(blockquote?.querySelector("code")?.textContent).toBe("alpha");
  });

  it("D-02: el bloque `pre` desplazable es enfocable y tiene nombre accesible neutro", () => {
    const { container } = renderMarkdown("```\nconst alpha = 1;\n```\n");

    const pre = container.querySelector("pre");
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(pre).toHaveAttribute("aria-label", "Bloque de código");
  });

  it("D-02: traduce el nombre accesible del bloque de código al inglés", () => {
    const { container } = render(
      <SourceMarkdown
        markdown={"```\nconst alpha = 1;\n```\n"}
        resolveUrl={passthroughResolver}
        lang="en"
      />,
    );

    expect(container.querySelector("pre")).toHaveAttribute(
      "aria-label",
      "Code block",
    );
  });

  it("D-03: los checkboxes de listas de tareas tienen nombre accesible neutro", () => {
    const { container } = renderMarkdown(
      ["- [x] alpha", "- [ ] beta"].join("\n"),
    );

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAccessibleName("Elemento de tarea");
    });
  });

  it("D-03: traduce el nombre accesible de los checkboxes al inglés", () => {
    const { container } = render(
      <SourceMarkdown
        markdown={"- [x] alpha\n"}
        resolveUrl={passthroughResolver}
        lang="en"
      />,
    );

    expect(
      container.querySelector<HTMLInputElement>('input[type="checkbox"]'),
    ).toHaveAccessibleName("Task item");
  });

  it("D-04: el respaldo Wayback queda atenuado en reposo y solo cambia con hover fino", () => {
    const backupHref =
      "http://web.archive.org/web/20260613092255/https://example.com/tool/fixture-tool";
    const { container } = render(
      <SourceMarkdown
        markdown="[alpha](https://example.com/tool/fixture-tool)"
        resolveUrl={() => ({
          kind: "external",
          href: "https://example.com/tool/fixture-tool",
          backup: {
            href: backupHref,
            capturedAt: "2026-06-13T09:22:55.000Z",
          },
        })}
      />,
    );

    const backup = container.querySelector(`a[href="${backupHref}"]`);
    expect(backup?.className).toContain("text-muted-foreground");
    expect(backup?.className).toContain("hover-fine:text-foreground");
  });
});

describe("SourceMarkdown: variante compact (contrato M2-FX2)", () => {
  it("usa tamaño ≤ título de fila, color muted y sin márgenes de bloque", () => {
    const { container } = render(
      <SourceMarkdown
        markdown={["# Encabezado", "", "Texto con [enlace](./alpha.md)."].join(
          "\n",
        )}
        resolveUrl={passthroughResolver}
        variant="compact"
      />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("text-sm");
    expect(wrapper.className).toContain("text-muted-foreground");

    const heading = container.querySelector("h1");
    expect(heading?.className).toContain("text-sm");
    expect(heading?.className).not.toContain("text-3xl");

    const paragraph = container.querySelector("p");
    expect(paragraph?.className).toContain("my-0");
    expect(paragraph?.className).not.toContain("my-4");
  });

  it("mantiene la variante document por defecto con medida de lectura", () => {
    const { container } = renderMarkdown("Texto neutro");

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("max-w-[65ch]");
    expect(wrapper.className).toContain("text-base");
    expect(wrapper.className).toContain("text-foreground");
  });
});
