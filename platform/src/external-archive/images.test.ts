// @vitest-environment node
import { describe, expect, it } from "vitest";

import { HttpClient, type FetchLike } from "./http";
import {
  ARCHIVE_ASSET_CONTENT_TYPES,
  detectImageContentType,
  extractImageReferences,
  ImageDownloader,
  sha256Hex,
  UnsupportedImageError,
} from "./images";
import { RobotsGate, RobotsDeniedError } from "./robots";
import {
  fixtureBytes,
  fixtureText,
  loadExternalArchiveFixtureManifest,
  markdownFixtureRelativePath,
} from "./test-fixtures";

function createFetchMock(routes: Readonly<Record<string, () => Response>>): {
  fetch: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    const route = routes[input];
    if (route === undefined) {
      throw new Error(`fetch no mockeado: ${input}`);
    }
    return route();
  };
  return { fetch: fetchImpl, calls };
}

describe("extractImageReferences (Markdown literal real)", () => {
  it("extrae las 19 referencias reales de los 3 ficheros pinneados", () => {
    const english = extractImageReferences(
      fixtureText(markdownFixtureRelativePath("how-to-start-a-project.md")),
    );
    const spanish = extractImageReferences(
      fixtureText(markdownFixtureRelativePath("how-to-start-a-project.es.md")),
    );
    const codespaces = extractImageReferences(
      fixtureText(markdownFixtureRelativePath("what-is-github-codespaces.md")),
    );

    expect(english).toHaveLength(7);
    expect(spanish).toHaveLength(7);
    expect(codespaces).toHaveLength(5);
    expect(english[0]).toEqual({
      originalUrl:
        "https://raw.githubusercontent.com/breatheco-de/knowledge-base/main/images/template.png",
      alt: "Using a template",
      syntax: "markdown",
    });
    expect(codespaces[0]).toEqual({
      originalUrl:
        "https://github.com/breatheco-de/knowledge-base/blob/main/images/github-codespaces-explanation.png?raw=true",
      alt: "what is a github codespace",
      syntax: "markdown",
    });
  });

  it("también reconoce <img src> y títulos de Markdown", () => {
    const references = extractImageReferences(
      [
        '![alt uno](https://example.com/a.png "titulo")',
        '<img src="https://example.com/b.png" alt="alt dos" width="10">',
      ].join("\n"),
    );
    expect(references).toEqual([
      {
        originalUrl: "https://example.com/a.png",
        alt: "alt uno",
        syntax: "markdown",
      },
      {
        originalUrl: "https://example.com/b.png",
        alt: "alt dos",
        syntax: "html",
      },
    ]);
  });
});

describe("detectImageContentType (magic bytes)", () => {
  it("detecta las imágenes reales del fixture y su sha256", () => {
    const manifest = loadExternalArchiveFixtureManifest();
    for (const relativePath of [
      "images/github-exaplantion.png",
      "images/github-codespaces-explanation.png",
    ]) {
      const bytes = fixtureBytes(relativePath);
      expect(detectImageContentType(bytes)).toBe("image/png");
      const entry = manifest.files.find((file) => file.path === relativePath);
      expect(entry).toBeDefined();
      expect(sha256Hex(bytes)).toBe(entry?.sha256);
      expect(bytes.byteLength).toBe(entry?.byte_size);
    }
  });

  it("detecta raster y svg por firma; el svg no es archivable (O-01)", () => {
    const gif = new TextEncoder().encode("GIF89a....");
    expect(detectImageContentType(gif)).toBe("image/gif");
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    expect(detectImageContentType(svg)).toBe("image/svg+xml");
    expect(ARCHIVE_ASSET_CONTENT_TYPES).not.toContain("image/svg+xml");
    expect(
      detectImageContentType(new TextEncoder().encode("<html>hola</html>")),
    ).toBeNull();
    expect(detectImageContentType(new Uint8Array())).toBeNull();
  });
});

describe("ImageDownloader", () => {
  it("verifica el tipo por magic bytes aunque el header mienta", async () => {
    const manifest = loadExternalArchiveFixtureManifest();
    const entry = manifest.files.find(
      (file) => file.path === "images/github-exaplantion.png",
    );
    const bytes = fixtureBytes("images/github-exaplantion.png");
    const mock = createFetchMock({
      "https://raw.githubusercontent.com/robots.txt": () =>
        new Response(null, { status: 404 }),
      "https://raw.githubusercontent.com/breatheco-de/knowledge-base/main/images/a.png":
        () =>
          new Response(bytes, {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
    });
    const http = new HttpClient({ fetch: mock.fetch, retries: 0 });
    const downloader = new ImageDownloader(http, {
      robots: new RobotsGate(http),
    });

    const image = await downloader.download(
      "https://raw.githubusercontent.com/breatheco-de/knowledge-base/main/images/a.png",
    );

    expect(image.contentType).toBe("image/png");
    expect(image.sha256).toBe(entry?.sha256);
    expect(image.byteSize).toBe(bytes.byteLength);
    expect(image.originalUrl).toBe(
      "https://raw.githubusercontent.com/breatheco-de/knowledge-base/main/images/a.png",
    );
  });

  it("rechaza bytes que no son de la allowlist", async () => {
    const mock = createFetchMock({
      "https://example.com/robots.txt": () =>
        new Response(null, { status: 404 }),
      "https://example.com/a.png": () =>
        new Response("no soy una imagen", { status: 200 }),
    });
    const http = new HttpClient({ fetch: mock.fetch, retries: 0 });
    const downloader = new ImageDownloader(http, {
      robots: new RobotsGate(http),
    });
    await expect(
      downloader.download("https://example.com/a.png"),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it("rechaza un SVG con motivo claro: /archive-assets no lo sirve (O-01)", async () => {
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    const mock = createFetchMock({
      "https://example.com/robots.txt": () =>
        new Response(null, { status: 404 }),
      "https://example.com/a.svg": () =>
        new Response(svg, {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        }),
    });
    const http = new HttpClient({ fetch: mock.fetch, retries: 0 });
    const downloader = new ImageDownloader(http, {
      robots: new RobotsGate(http),
    });

    const rejection: unknown = await downloader
      .download("https://example.com/a.svg")
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(rejection).toBeInstanceOf(UnsupportedImageError);
    expect((rejection as Error).message).toContain("image/svg+xml");
    expect((rejection as Error).message).toContain("/archive-assets");
  });

  it("nunca pide una imagen de la lista negra (learn.4geeks.com)", async () => {
    const mock = createFetchMock({});
    const http = new HttpClient({ fetch: mock.fetch, retries: 0 });
    const downloader = new ImageDownloader(http, {
      robots: new RobotsGate(http),
    });
    await expect(
      downloader.download("https://learn.4geeks.com/img/a.png"),
    ).rejects.toBeInstanceOf(RobotsDeniedError);
    expect(mock.calls).toEqual([]);
  });
});
