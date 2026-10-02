import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_LANGUAGE,
  isSafeInternalPath,
  isUiLanguage,
  languagePreferenceHref,
  parseUiLanguage,
  safeNextPath,
  UI_LANGUAGE_COOKIE,
  UI_LANGUAGES,
} from "./index";

describe("i18n de interfaz (puro)", () => {
  it("expone el dominio de idioma y el nombre de cookie congelados", () => {
    expect(UI_LANGUAGE_COOKIE).toBe("lang");
    expect(UI_LANGUAGES).toEqual(["es", "en"]);
    expect(DEFAULT_UI_LANGUAGE).toBe("es");
  });

  it("valida y normaliza valores de idioma; inválido o ausente → es", () => {
    expect(isUiLanguage("es")).toBe(true);
    expect(isUiLanguage("en")).toBe(true);
    expect(isUiLanguage("fr")).toBe(false);
    expect(isUiLanguage(undefined)).toBe(false);
    expect(parseUiLanguage("en")).toBe("en");
    expect(parseUiLanguage("fr")).toBe("es");
    expect(parseUiLanguage(undefined)).toBe("es");
    expect(parseUiLanguage("")).toBe("es");
  });

  it("construye el href de preferencia con `next` codificado", () => {
    expect(languagePreferenceHref("en", "/contexts")).toBe(
      "/preferences/language/en?next=%2Fcontexts",
    );
    expect(
      languagePreferenceHref("es", "/contexts/alpha-unit?doc=guia.md"),
    ).toBe(
      "/preferences/language/es?next=%2Fcontexts%2Falpha-unit%3Fdoc%3Dguia.md",
    );
  });

  it("solo acepta rutas relativas internas", () => {
    expect(isSafeInternalPath("/contexts")).toBe(true);
    expect(isSafeInternalPath("/contexts?doc=a%2Fb.md")).toBe(true);
    expect(isSafeInternalPath("/")).toBe(true);

    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath("")).toBe(false);
    expect(isSafeInternalPath("contexts")).toBe(false);
    expect(isSafeInternalPath("//evil.example")).toBe(false);
    expect(isSafeInternalPath("https://evil.example")).toBe(false);
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalPath("/\\evil.example")).toBe(false);
    expect(isSafeInternalPath("/a\\b")).toBe(false);
    expect(isSafeInternalPath("/a\u0000b")).toBe(false);
    expect(isSafeInternalPath("/a\nb")).toBe(false);
  });

  it("resuelve `next` inseguro al catálogo de proyectos", () => {
    expect(safeNextPath("/contexts")).toBe("/contexts");
    expect(safeNextPath("//evil.example")).toBe("/projects");
    expect(safeNextPath("https://evil.example")).toBe("/projects");
    expect(safeNextPath("javascript:alert(1)")).toBe("/projects");
    expect(safeNextPath(null)).toBe("/projects");
    expect(safeNextPath(undefined)).toBe("/projects");
  });
});
