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

// --- Material externo archivado (Hito 2.5, plan §5.4 + §8) ------------------

function encodeArchivePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeSegment)
    .join("/");
}

/** Hostname simple (etiquetas alfanuméricas con guiones); sin puertos ni IPv6. */
const ARCHIVE_HOST_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

/**
 * `/archive/<host>/<path…>` con cada segmento codificado. El host se
 * normaliza a minúsculas (la clave canónica del archivo).
 */
export function archiveHref(host: string, path: string): string {
  const encodedHost = encodeSegment(host.trim().toLowerCase());
  const encodedPath = encodeArchivePath(path);
  return encodedPath === ""
    ? `/archive/${encodedHost}`
    : `/archive/${encodedHost}/${encodedPath}`;
}

/**
 * Segmentos de `/archive/[...path]` → `{ host, path }`. Devuelve `null` si la
 * ruta no es válida: segmentos vacíos, `.`/`..`, barras codificadas o `%xx`
 * mal formado. El host se normaliza a minúsculas.
 */
export function parseArchiveTarget(
  segments: readonly string[],
): { host: string; path: string } | null {
  if (segments.length === 0) {
    return null;
  }
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      value === "" ||
      value === "." ||
      value === ".." ||
      value.includes("/") ||
      value.includes("\\")
    ) {
      return null;
    }
    decoded.push(value);
  }
  const host = decoded[0]!.toLowerCase();
  if (!ARCHIVE_HOST_PATTERN.test(host)) {
    return null;
  }
  return { host, path: decoded.slice(1).join("/") };
}

/** `/archive-assets/<sha256>` con el hash codificado (ADR-018, AC-2.5.8). */
export function archiveAssetHref(sha256: string): string {
  return `/archive-assets/${encodeSegment(sha256)}`;
}
