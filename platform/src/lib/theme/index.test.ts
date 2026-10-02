import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_THEME,
  isUiTheme,
  nextUiTheme,
  parseUiTheme,
  themePreferenceHref,
  UI_THEME_COOKIE,
  UI_THEMES,
} from "./index";

describe("tema de interfaz (puro)", () => {
  it("expone el dominio y el nombre de cookie congelados", () => {
    expect(UI_THEME_COOKIE).toBe("theme");
    expect(UI_THEMES).toEqual(["light", "dark", "system"]);
    expect(DEFAULT_UI_THEME).toBe("system");
  });

  it("valida y normaliza; inválido o ausente → system", () => {
    expect(isUiTheme("light")).toBe(true);
    expect(isUiTheme("dark")).toBe(true);
    expect(isUiTheme("system")).toBe(true);
    expect(isUiTheme("sepia")).toBe(false);
    expect(isUiTheme(undefined)).toBe(false);
    expect(parseUiTheme("dark")).toBe("dark");
    expect(parseUiTheme("sepia")).toBe("system");
    expect(parseUiTheme(undefined)).toBe("system");
  });

  it("construye el href de preferencia con `next` codificado", () => {
    expect(themePreferenceHref("dark", "/projects")).toBe(
      "/preferences/theme/dark?next=%2Fprojects",
    );
    expect(
      themePreferenceHref("light", "/contexts/alpha-unit?doc=guia.md"),
    ).toBe(
      "/preferences/theme/light?next=%2Fcontexts%2Falpha-unit%3Fdoc%3Dguia.md",
    );
  });

  it("cicla claro → oscuro → sistema → claro", () => {
    expect(nextUiTheme("light")).toBe("dark");
    expect(nextUiTheme("dark")).toBe("system");
    expect(nextUiTheme("system")).toBe("light");
  });
});
