// @vitest-environment node
/**
 * Rutas del material externo archivado (Hito 2.5, plan §5.4 + §8).
 *
 * Funciones puras: construyen `/archive/<host>/<path…>` y
 * `/archive-assets/<sha256>` y hacen el camino inverso con codificación segura
 * de segmentos. Los paths usados son los reales del corpus (sin tokens del
 * catálogo SOURCE).
 */

import { describe, expect, it } from "vitest";

import { archiveAssetHref, archiveHref, parseArchiveTarget } from "./routes";

const LESSON_HOST = "4geeks.com";
const LESSON_PATH = "lesson/how-to-start-a-project";
const RETIRED_PATH = "es/lesson/como-iniciar-un-proyecto-de-programacion";

describe("archiveHref", () => {
  it("construye /archive/<host>/<path> con la URL real del corpus", () => {
    expect(archiveHref(LESSON_HOST, LESSON_PATH)).toBe(
      "/archive/4geeks.com/lesson/how-to-start-a-project",
    );
    expect(archiveHref(LESSON_HOST, RETIRED_PATH)).toBe(
      "/archive/4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion",
    );
  });

  it("normaliza el host a minúsculas y codifica cada segmento", () => {
    expect(archiveHref("Diagram.4Geeks.com", "api/v1/docs")).toBe(
      "/archive/diagram.4geeks.com/api/v1/docs",
    );
    expect(archiveHref("example.com", "lesson/with space/ñ")).toBe(
      "/archive/example.com/lesson/with%20space/%C3%B1",
    );
  });

  it("ignora barras repetidas y finales", () => {
    expect(archiveHref(LESSON_HOST, "/lesson//how-to-start-a-project/")).toBe(
      "/archive/4geeks.com/lesson/how-to-start-a-project",
    );
    expect(archiveHref(LESSON_HOST, "")).toBe("/archive/4geeks.com");
  });
});

describe("parseArchiveTarget", () => {
  it("decodifica los segmentos y normaliza el host", () => {
    expect(
      parseArchiveTarget(["4geeks.com", "lesson", "how-to-start-a-project"]),
    ).toEqual({ host: "4geeks.com", path: LESSON_PATH });
    expect(
      parseArchiveTarget(["4Geeks.com", "es", "lesson", "with%20space"]),
    ).toEqual({ host: "4geeks.com", path: "es/lesson/with space" });
  });

  it("rechaza rutas inválidas sin lanzar", () => {
    expect(parseArchiveTarget([])).toBeNull();
    expect(parseArchiveTarget(["4geeks.com", ""])).toBeNull();
    expect(parseArchiveTarget(["4geeks.com", "."])).toBeNull();
    expect(parseArchiveTarget(["4geeks.com", "..", "etc"])).toBeNull();
    expect(parseArchiveTarget(["4geeks.com", "lesson%2Fhidden"])).toBeNull();
    expect(parseArchiveTarget(["4geeks.com", "%E0%A4%A"])).toBeNull();
    expect(parseArchiveTarget([" "])).toBeNull();
    expect(parseArchiveTarget(["https:", "example.com", "x"])).toBeNull();
    expect(parseArchiveTarget(["localhost:3000", "lesson"])).toBeNull();
    expect(parseArchiveTarget(["4geeks.com."])).toBeNull();
  });
});

describe("archiveAssetHref", () => {
  it("sirve el asset por sha256 sin tocar el hash", () => {
    const sha256 = "a".repeat(64);
    expect(archiveAssetHref(sha256)).toBe(`/archive-assets/${sha256}`);
  });

  it("codifica el hash si trae caracteres no seguros", () => {
    expect(archiveAssetHref("a b/c")).toBe("/archive-assets/a%20b%2Fc");
  });
});
