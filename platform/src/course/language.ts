/**
 * Reglas ADR-012 (§3.6 del plan) para las variantes de idioma de un path.
 *
 * Los candidatos se derivan del nombre del archivo (`X.es.md`, `X.en.md`,
 * `X.md`); la existencia y el idioma/evidencia reales los aporta el snapshot
 * (`source_files`), nunca una inferencia de contenido. Sin par real no hay
 * variante que ofrecer.
 */

import type { CourseLanguage, CourseLanguageEvidence } from "./types";

export function isCourseLanguage(value: unknown): value is CourseLanguage {
  return value === "es" || value === "en";
}

export function isCourseLanguageEvidence(
  value: unknown,
): value is CourseLanguageEvidence {
  return value === "suffix" || value === "pair-convention";
}

/**
 * Candidatos de variante para un path, empezando por el propio path:
 * - `X.es.md` → `[X.es.md, X.en.md, X.md]`
 * - `X.en.md` → `[X.en.md, X.es.md, X.md]`
 * - `X.md`    → `[X.md, X.es.md, X.en.md]`
 * - cualquier otro path → `[path]`
 */
export function languagePathCandidates(path: string): string[] {
  if (path.endsWith(".es.md")) {
    const base = path.slice(0, -".es.md".length);
    return [path, `${base}.en.md`, `${base}.md`];
  }
  if (path.endsWith(".en.md")) {
    const base = path.slice(0, -".en.md".length);
    return [path, `${base}.es.md`, `${base}.md`];
  }
  if (path.endsWith(".md")) {
    const base = path.slice(0, -".md".length);
    return [path, `${base}.es.md`, `${base}.en.md`];
  }
  return [path];
}
