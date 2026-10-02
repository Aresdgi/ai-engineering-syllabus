// @vitest-environment node
/**
 * Route handler `GET/HEAD /source-files/<path>` (ADR-018): bytes íntegros,
 * tipos seguros por media type, traversal → 404, revalidación ETag/304 y
 * ausencia de trazas en errores. Datos sintéticos neutros (AC-0.10).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFileBytes } from "@/course";
import type { SourceFileBytes } from "@/course/types";
import { GET, HEAD } from "./route";

vi.mock("@/course", () => ({ getFileBytes: vi.fn() }));

const mockedGetFileBytes = vi.mocked(getFileBytes);

const BLOB_SHA = "a".repeat(40);

function makeFile(overrides: Partial<SourceFileBytes> = {}): SourceFileBytes {
  return {
    path: "content/projects/alpha-unit/preview.png",
    mediaType: "image/png",
    blobSha: BLOB_SHA,
    bytes: new Uint8Array([137, 80, 78, 71]),
    ...overrides,
  };
}

function makeRequest(headers?: HeadersInit): Request {
  return new Request(
    "http://localhost/source-files/content/projects/alpha-unit/preview.png",
    { headers },
  );
}

function makeContext(segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /source-files/<path>", () => {
  it("sirve una imagen raster con su tipo, bytes íntegros y cabeceras seguras", async () => {
    const file = makeFile();
    mockedGetFileBytes.mockResolvedValue(file);

    const response = await GET(
      makeRequest(),
      makeContext(["content", "projects", "alpha-unit", "preview.png"]),
    );

    expect(response.status).toBe(200);
    expect(mockedGetFileBytes).toHaveBeenCalledWith(
      "content/projects/alpha-unit/preview.png",
    );
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("etag")).toBe(`"${BLOB_SHA}"`);
    expect(response.headers.get("cache-control")).toContain("max-age=");
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox",
    );
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      137, 80, 78, 71,
    ]);
  });

  it("sirve html como text/plain para no ejecutarlo", async () => {
    const html = "<h1>alpha</h1>";
    mockedGetFileBytes.mockResolvedValue(
      makeFile({
        mediaType: "text/html",
        bytes: new TextEncoder().encode(html),
      }),
    );

    const response = await GET(makeRequest(), makeContext(["page.html"]));

    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(await response.text()).toBe(html);
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  it.each([
    ["text/markdown"],
    ["text/css"],
    ["application/json"],
    ["application/sql"],
    ["image/svg+xml"],
  ])("sirve %s como texto plano", async (mediaType) => {
    mockedGetFileBytes.mockResolvedValue(
      makeFile({ mediaType, bytes: new TextEncoder().encode("alpha") }),
    );

    const response = await GET(makeRequest(), makeContext(["file.txt"]));

    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  it("sirve un binario no textual como descarga", async () => {
    mockedGetFileBytes.mockResolvedValue(
      makeFile({
        mediaType: "application/octet-stream",
        bytes: new Uint8Array([0, 1, 2]),
      }),
    );

    const response = await GET(makeRequest(), makeContext(["archive.bin"]));

    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("content-disposition")).toBe("attachment");
  });

  it("sirve PDF inline con su tipo", async () => {
    mockedGetFileBytes.mockResolvedValue(
      makeFile({
        mediaType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7"),
      }),
    );

    const response = await GET(makeRequest(), makeContext(["report.pdf"]));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
  });

  it("decodifica %xx en los segmentos antes de buscar el path exacto", async () => {
    mockedGetFileBytes.mockResolvedValue(
      makeFile({ path: "content/notes/with space.md" }),
    );

    const response = await GET(
      makeRequest(),
      makeContext(["content", "notes", "with%20space.md"]),
    );

    expect(response.status).toBe(200);
    expect(mockedGetFileBytes).toHaveBeenCalledWith(
      "content/notes/with space.md",
    );
  });

  it("acepta segmentos ya decodificados (params de Next)", async () => {
    mockedGetFileBytes.mockResolvedValue(makeFile());

    const response = await GET(
      makeRequest(),
      makeContext(["content", "notes", "with space.md"]),
    );

    expect(response.status).toBe(200);
    expect(mockedGetFileBytes).toHaveBeenCalledWith(
      "content/notes/with space.md",
    );
  });

  it("devuelve 404 sin consultar si el archivo no existe en el snapshot", async () => {
    mockedGetFileBytes.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeContext(["missing.md"]));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("devuelve 304 con If-None-Match exacto, débil o en lista", async () => {
    mockedGetFileBytes.mockResolvedValue(makeFile());

    for (const value of [
      `"${BLOB_SHA}"`,
      `W/"${BLOB_SHA}"`,
      `"other", "${BLOB_SHA}"`,
      "*",
    ]) {
      const response = await GET(
        makeRequest({ "if-none-match": value }),
        makeContext(["preview.png"]),
      );
      expect(response.status, `If-None-Match: ${value}`).toBe(304);
      expect(response.headers.get("etag")).toBe(`"${BLOB_SHA}"`);
      expect(await response.text()).toBe("");
    }
  });

  it("ignora un If-None-Match que no coincide", async () => {
    mockedGetFileBytes.mockResolvedValue(makeFile());

    const response = await GET(
      makeRequest({ "if-none-match": '"otro"' }),
      makeContext(["preview.png"]),
    );

    expect(response.status).toBe(200);
  });

  it("no expone trazas si la capa de datos falla", async () => {
    mockedGetFileBytes.mockRejectedValue(
      new Error("postgres://user:secret@host/db caído"),
    );

    const response = await GET(makeRequest(), makeContext(["preview.png"]));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
  });

  it.each([
    [["..", "etc", "passwd"]],
    [["content", "..", "secret.md"]],
    [["content", ".."]],
    [["%2e%2e", "etc"]],
    [["content%2F..%2Fsecret.md"]],
    [["a\\b.md"]],
    [["a\0b.md"]],
    [["content", "", "file.md"]],
    [[]],
  ])(
    "rechaza el path sospechoso %j con 404 sin tocar la capa de datos",
    async (segments) => {
      const response = await GET(
        makeRequest(),
        makeContext(segments as string[]),
      );

      expect(response.status).toBe(404);
      expect(mockedGetFileBytes).not.toHaveBeenCalled();
    },
  );
});

describe("HEAD /source-files/<path>", () => {
  it("responde 200 con las mismas cabeceras y sin cuerpo", async () => {
    mockedGetFileBytes.mockResolvedValue(makeFile());

    const response = await HEAD(
      makeRequest(),
      makeContext(["content", "projects", "alpha-unit", "preview.png"]),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("etag")).toBe(`"${BLOB_SHA}"`);
    expect(await response.text()).toBe("");
  });
});
