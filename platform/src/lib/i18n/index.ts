/**
 * i18n de interfaz del navegador del syllabus (Hito 2 — L1).
 *
 * Este módulo es puro y seguro para componentes cliente: no importa
 * `next/headers` ni `server-only`. La lectura de la cookie en servidor vive en
 * `./server` (`getUiLanguage`), para que el bundle cliente no arrastre APIs de
 * request.
 *
 * Regla de contenido: aquí solo hay copys neutros de interfaz y utilidades de
 * URL; ningún texto educativo se inventa ni se traduce (ADR-012).
 */

export type UiLanguage = "es" | "en";

export const UI_LANGUAGE_COOKIE = "lang";

export const UI_LANGUAGES: readonly UiLanguage[] = ["es", "en"];

export const DEFAULT_UI_LANGUAGE: UiLanguage = "es";

const FALLBACK_NEXT_PATH = "/projects";

export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "es" || value === "en";
}

/** Valor inválido o ausente → `"es"` (idioma por defecto del usuario). */
export function parseUiLanguage(value: unknown): UiLanguage {
  return isUiLanguage(value) ? value : DEFAULT_UI_LANGUAGE;
}

/** `/preferences/language/<lang>?next=<ruta+query codificado>`. */
export function languagePreferenceHref(lang: UiLanguage, next: string): string {
  return `/preferences/language/${lang}?next=${encodeURIComponent(next)}`;
}

/**
 * Solo rutas internas: empiezan por `/`, no son protocol-relative (`//`), no
 * usan backslash (los navegadores lo equiparan a `/`) y no llevan caracteres
 * de control. `https://…`, `javascript:` o `//evil` quedan fuera.
 */
export function isSafeInternalPath(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (!value.startsWith("/")) {
    return false;
  }
  if (value.startsWith("//") || value.includes("\\")) {
    return false;
  }
  return !/[\u0000-\u001f\u007f]/.test(value);
}

/** `next` seguro o `/projects` si falta, es externo o es sospechoso. */
export function safeNextPath(value: string | null | undefined): string {
  return isSafeInternalPath(value) ? value : FALLBACK_NEXT_PATH;
}
