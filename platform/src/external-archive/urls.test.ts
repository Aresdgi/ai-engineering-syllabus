// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  canonicalUrlHost,
  classifyUrl,
  isBlockedUrl,
  lessonUrlLanguage,
  stripTrailingUrlNoise,
} from "./urls";

describe("canonicalizeUrl", () => {
  it("normaliza host, barra final y puerto por defecto", () => {
    expect(canonicalizeUrl("https://4Geeks.com/lesson/How-To-Start/")).toBe(
      "https://4geeks.com/lesson/How-To-Start",
    );
    expect(canonicalizeUrl("https://4geeks.com:443/lesson/x")).toBe(
      "https://4geeks.com/lesson/x",
    );
    expect(canonicalizeUrl("HTTPS://Diagram.4Geeks.com/")).toBe(
      "https://diagram.4geeks.com",
    );
  });

  it("conserva la query y descarta el fragmento", () => {
    expect(
      canonicalizeUrl(
        "https://4geeksacademy.com/es/comparar-programas?lang=es",
      ),
    ).toBe("https://4geeksacademy.com/es/comparar-programas?lang=es");
    expect(canonicalizeUrl("https://4geeks.com/lesson/x#section")).toBe(
      "https://4geeks.com/lesson/x",
    );
  });

  it("recorta la puntuación final de los enlaces incrustados en Markdown", () => {
    expect(canonicalizeUrl("https://learn.4geeks.com`")).toBe(
      "https://learn.4geeks.com",
    );
    expect(
      canonicalizeUrl("https://playground.4geeks.com/tracker/api/v1/docs]"),
    ).toBe("https://playground.4geeks.com/tracker/api/v1/docs");
    expect(canonicalizeUrl("https://4geeksacademy.com.")).toBe(
      "https://4geeksacademy.com",
    );
    expect(canonicalizeUrl("https://4geeks.com/lesson/x).")).toBe(
      "https://4geeks.com/lesson/x",
    );
  });

  it("no rompe URLs legítimas con paréntesis equilibrados", () => {
    expect(canonicalizeUrl("https://en.wikipedia.org/wiki/Part_(album)")).toBe(
      "https://en.wikipedia.org/wiki/Part_(album)",
    );
  });

  it("devuelve null para lo que no es http(s) absoluta", () => {
    expect(canonicalizeUrl("/lesson/relativa")).toBeNull();
    expect(canonicalizeUrl("mailto:hola@4geeks.com")).toBeNull();
    expect(canonicalizeUrl("ftp://4geeks.com/lesson/x")).toBeNull();
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("no es una url")).toBeNull();
    expect(canonicalizeUrl("")).toBeNull();
  });

  it("es idempotente con las URL reales del inventario", () => {
    const real = [
      "https://4geeks.com/lesson/how-to-start-a-project",
      "https://playground.4geeks.com/tracker/api/v1/docs",
      "https://4geeksacademy.com/es/comparar-programas?lang=es",
      "https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3343",
    ];
    for (const url of real) {
      const once = canonicalizeUrl(url);
      expect(once).toBe(url);
      expect(canonicalizeUrl(once ?? "")).toBe(once);
    }
  });
});

describe("stripTrailingUrlNoise", () => {
  it("solo recorta al final, nunca en medio", () => {
    expect(stripTrailingUrlNoise("  https://x.com/a]., ")).toBe(
      "https://x.com/a",
    );
    expect(stripTrailingUrlNoise("https://x.com/a].b")).toBe(
      "https://x.com/a].b",
    );
  });
});

describe("classifyUrl (plan §1.1/§2)", () => {
  it("clasifica las URL reales del inventario", () => {
    expect(
      classifyUrl("https://4geeks.com/lesson/how-to-start-a-project"),
    ).toBe("lesson");
    expect(
      classifyUrl(
        "https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion",
      ),
    ).toBe("lesson");
    expect(
      classifyUrl("https://4geeks.com/en/lesson/how-to-start-a-project"),
    ).toBe("lesson");
    expect(classifyUrl("https://diagram.4geeks.com")).toBe("tool");
    expect(classifyUrl("https://learn.4geeks.com")).toBe("tool");
    expect(
      classifyUrl("https://playground.4geeks.com/tracker/api/v1/docs"),
    ).toBe("tool");
    expect(classifyUrl("https://4geeksacademy.com")).toBe("marketing");
    expect(
      classifyUrl("https://4geeksacademy.com/es/comparar-programas?lang=es"),
    ).toBe("marketing");
    expect(classifyUrl("https://www.4geeksacademy.com/compare-programs")).toBe(
      "marketing",
    );
    expect(classifyUrl("https://4geeks.com")).toBe("marketing");
    expect(classifyUrl("https://4geeks.com/es/pagina-normal")).toBe(
      "marketing",
    );
    expect(
      classifyUrl(
        "https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3343",
      ),
    ).toBe("out-of-scope");
    expect(classifyUrl("https://api.4geeks.com/v1/x")).toBe("out-of-scope");
  });

  it("devuelve null para hosts ajenos a 4Geeks", () => {
    expect(
      classifyUrl("https://github.com/breatheco-de/knowledge-base"),
    ).toBeNull();
    expect(
      classifyUrl("https://raw.githubusercontent.com/x/y/main/a.md"),
    ).toBeNull();
    expect(
      classifyUrl("https://user-images.githubusercontent.com/1/a.png"),
    ).toBeNull();
    expect(classifyUrl("https://4geeks.io")).toBeNull();
    expect(classifyUrl("https://not4geeks.com/lesson/x")).toBeNull();
  });
});

describe("isBlockedUrl (lista negra del plan §3.6)", () => {
  it("bloquea learn.4geeks.com y 4geeks.com/api/*", () => {
    expect(isBlockedUrl("https://learn.4geeks.com")).toBe(true);
    expect(isBlockedUrl("https://learn.4geeks.com/lesson/x")).toBe(true);
    expect(isBlockedUrl("https://4geeks.com/api/v1/registry")).toBe(true);
    expect(isBlockedUrl("https://4geeks.com/api")).toBe(true);
    expect(isBlockedUrl("https://4geeks.com/lesson/x")).toBe(false);
    expect(isBlockedUrl("https://diagram.4geeks.com")).toBe(false);
  });
});

describe("lessonUrlLanguage (regla de alias §8.3)", () => {
  it("lee el idioma de la URL y no de un contenido que no se consulta", () => {
    expect(
      lessonUrlLanguage(
        "https://4geeks.com/es/lesson/como-iniciar-un-proyecto",
      ),
    ).toBe("es");
    expect(
      lessonUrlLanguage("https://4geeks.com/lesson/how-to-start-a-project"),
    ).toBe("en");
    expect(
      lessonUrlLanguage("https://4geeks.com/en/lesson/how-to-start-a-project"),
    ).toBe("en");
    expect(lessonUrlLanguage("https://diagram.4geeks.com")).toBeNull();
  });
});

describe("canonicalUrlHost", () => {
  it("extrae el host en minúsculas", () => {
    expect(canonicalUrlHost("https://4Geeks.com/lesson/x")).toBe("4geeks.com");
    expect(canonicalUrlHost("no-url")).toBeNull();
  });
});
