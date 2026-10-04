// @vitest-environment node
/**
 * Route handler `GET/HEAD /archive-assets/<sha256>` (AC-2.5.8): bytes íntegros
 * por hash de contenido, allowlist de tipos raster, cabeceras seguras, 404/503
 * neutros e inexistencia de red. Datos sintéticos neutros (AC-0.10).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getArchivedAsset } from "@/course";
import { getCourseDatabaseUrl } from "@/course/database";
import { GET, HEAD } from "./route";

vi.mock("@/course", () => ({ getArchivedAsset: vi.fn() }));
vi.mock("@/course/database", () => ({ getCourseDatabaseUrl: vi.fn() }));

const mockedGetArchivedAsset = vi.mocked(getArchivedAsset);
const mockedGetCourseDatabaseUrl = vi.mocked(getCourseDatabaseUrl);

const SHA256 = "a".repeat(64);
const BYTES = new Uint8Array([137, 80, 78, 71]);

function makeRequest(headers?: HeadersInit): Request {
  return new Request(`http://localhost/archive-assets/${SHA256}`, { headers });
}

function makeContext(sha256: string) {
  return { params: Promise.resolve({ sha256 }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCourseDatabaseUrl.mockReturnValue("postgres://example/db");
  mockedGetArchivedAsset.mockResolvedValue({
    bytes: BYTES,
    contentType: "image/png",
  });
});

describe("GET /archive-assets/<sha256>", () => {
  it("sirve la imagen con bytes íntegros, ETag y cabeceras seguras", async () => {
    const response = await GET(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(200);
    expect(mockedGetArchivedAsset).toHaveBeenCalledWith(SHA256);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("etag")).toBe(`"${SHA256}"`);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox",
    );
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      137, 80, 78, 71,
    ]);
  });

  it("normaliza el hash a minúsculas antes de buscar y en el ETag", async () => {
    const response = await GET(
      makeRequest(),
      makeContext(SHA256.toUpperCase()),
    );

    expect(response.status).toBe(200);
    expect(mockedGetArchivedAsset).toHaveBeenCalledWith(SHA256);
    expect(response.headers.get("etag")).toBe(`"${SHA256}"`);
  });

  it.each(["image/png", "image/jpeg", "image/gif", "image/webp"])(
    "sirve el tipo raster permitido %s",
    async (contentType) => {
      mockedGetArchivedAsset.mockResolvedValue({ bytes: BYTES, contentType });

      const response = await GET(makeRequest(), makeContext(SHA256));

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(contentType);
    },
  );

  it("ignora parámetros del content type pero conserva el tipo base", async () => {
    mockedGetArchivedAsset.mockResolvedValue({
      bytes: BYTES,
      contentType: "image/png; charset=binary",
    });

    const response = await GET(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("devuelve 404 para un tipo no permitido sin exponer bytes", async () => {
    mockedGetArchivedAsset.mockResolvedValue({
      bytes: new TextEncoder().encode("<svg></svg>"),
      contentType: "image/svg+xml",
    });

    const response = await GET(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it.each([
    ["corto", "a".repeat(63)],
    ["largo", "a".repeat(65)],
    ["no hex", "z".repeat(64)],
    ["con path", "../../etc/passwd"],
    ["vacío", ""],
  ])(
    "rechaza el sha inválido (%s) con 404 sin consultar la base",
    async (_name, sha) => {
      const response = await GET(makeRequest(), makeContext(sha));

      expect(response.status).toBe(404);
      expect(mockedGetArchivedAsset).not.toHaveBeenCalled();
    },
  );

  it("devuelve 404 si el asset no existe", async () => {
    mockedGetArchivedAsset.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("responde 304 con If-None-Match exacto, débil o en lista", async () => {
    for (const value of [
      `"${SHA256}"`,
      `W/"${SHA256}"`,
      `"other", "${SHA256}"`,
      "*",
    ]) {
      const response = await GET(
        makeRequest({ "if-none-match": value }),
        makeContext(SHA256),
      );
      expect(response.status, `If-None-Match: ${value}`).toBe(304);
      expect(response.headers.get("etag")).toBe(`"${SHA256}"`);
      expect(await response.text()).toBe("");
    }
  });

  it("responde 503 neutro y sin cuerpo cuando no hay base configurada", async () => {
    mockedGetCourseDatabaseUrl.mockReturnValue(null);

    const response = await GET(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(mockedGetArchivedAsset).not.toHaveBeenCalled();
  });

  it("responde 503 neutro, sin trazas, si la capa de datos falla", async () => {
    mockedGetArchivedAsset.mockRejectedValue(
      new Error("postgres://user:secret@host/db caído"),
    );

    const response = await GET(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});

describe("HEAD /archive-assets/<sha256>", () => {
  it("responde 200 con las mismas cabeceras y sin cuerpo", async () => {
    const response = await HEAD(makeRequest(), makeContext(SHA256));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("etag")).toBe(`"${SHA256}"`);
    expect(await response.text()).toBe("");
  });
});
