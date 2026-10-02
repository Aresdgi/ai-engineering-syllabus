/**
 * Tema visual de interfaz (claro/oscuro/sistema) del navegador del syllabus.
 *
 * Módulo puro y seguro para componentes cliente; la lectura de la cookie en
 * servidor vive en `./server` (`getUiTheme`). La validación de `next` interno
 * reutiliza la de `@/lib/i18n` para no duplicar la política anti open-redirect.
 */

export type UiTheme = "light" | "dark" | "system";

export const UI_THEME_COOKIE = "theme";

export const UI_THEMES: readonly UiTheme[] = ["light", "dark", "system"];

export const DEFAULT_UI_THEME: UiTheme = "system";

export function isUiTheme(value: unknown): value is UiTheme {
  return value === "light" || value === "dark" || value === "system";
}

/** Valor inválido o ausente → `"system"` (respeta `prefers-color-scheme`). */
export function parseUiTheme(value: unknown): UiTheme {
  return isUiTheme(value) ? value : DEFAULT_UI_THEME;
}

/** `/preferences/theme/<theme>?next=<ruta+query codificado>`. */
export function themePreferenceHref(theme: UiTheme, next: string): string {
  return `/preferences/theme/${theme}?next=${encodeURIComponent(next)}`;
}

/** Siguiente valor del ciclo claro → oscuro → sistema → claro. */
export function nextUiTheme(theme: UiTheme): UiTheme {
  const index = UI_THEMES.indexOf(theme);
  return UI_THEMES[(index + 1) % UI_THEMES.length] ?? DEFAULT_UI_THEME;
}
