/**
 * Esquema único de URLs del navegador del syllabus (dueño W1).
 *
 * W2 (rutas), W3 (presentación) y el resolvedor de enlaces de Markdown usan
 * estas funciones para no duplicar formato de rutas. Son puras: no tocan la
 * base de datos ni conocen el snapshot activo.
 *
 * Idioma global: los href ya no emiten `?lang`; la variante mostrada la decide
 * la cookie global `lang` (ver `@/lib/i18n`). El parámetro `lang` se acepta
 * por compatibilidad y se ignora. Un `?lang` heredado en una URL tampoco
 * cambia la variante.
 */

import type { CourseLanguage } from "./types";

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment);
}

/** `/source-files/<path>` con cada segmento codificado (ADR-018). */
export function sourceFileHref(path: string): string {
  const encoded = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeSegment)
    .join("/");
  return `/source-files/${encoded}`;
}

/** `/projects` */
export function projectsIndexHref(_lang?: CourseLanguage): string {
  void _lang;
  return "/projects";
}

/** `/projects/<slug>` */
export function projectHref(slug: string, _lang?: CourseLanguage): string {
  void _lang;
  return `/projects/${encodeSegment(slug)}`;
}

/** `/projects/<padre>/<slug>` */
export function subprojectHref(
  parentSlug: string,
  slug: string,
  _lang?: CourseLanguage,
): string {
  void _lang;
  return `/projects/${encodeSegment(parentSlug)}/${encodeSegment(slug)}`;
}

/** `/contexts` */
export function contextsIndexHref(): string {
  return "/contexts";
}

/**
 * `/contexts/<slug>[?doc=<ruta relativa al contexto>]`.
 * Sin `doc`, la vista muestra el documento preferido del contexto.
 */
export function contextHref(slug: string, docRelativePath?: string): string {
  const base = `/contexts/${encodeSegment(slug)}`;
  if (docRelativePath === undefined) {
    return base;
  }
  return `${base}?doc=${encodeURIComponent(docRelativePath)}`;
}

/** `/lessons` */
export function lessonsIndexHref(): string {
  return "/lessons";
}

/** `/lessons/<slug>` */
export function lessonHref(slug: string, _lang?: CourseLanguage): string {
  void _lang;
  return `/lessons/${encodeSegment(slug)}`;
}

/** Normaliza `searchParams.lang`; cualquier otro valor (o array vacío) es `null`. */
export function parseLangParam(
  value: string | string[] | undefined,
): CourseLanguage | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "es" || candidate === "en") {
    return candidate;
  }
  return null;
}
