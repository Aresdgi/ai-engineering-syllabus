import type {
  SourceContentRoot,
  SourceLanguageAssignment,
  SourcePath,
} from "../types";
import { SOURCE_CONTENT_ROOTS } from "../types";

/**
 * Bucket de un path del inventario:
 * - `projects` | `contexts` | `lessons`: dentro de una de las tres raíces.
 * - `auxiliary`: fuera de las raíces (no se importa como contenido de M1).
 */
export type SourceBucket = "projects" | "contexts" | "lessons" | "auxiliary";

const BUCKET_BY_ROOT: Readonly<
  Record<SourceContentRoot, Exclude<SourceBucket, "auxiliary">>
> = {
  "content/projects": "projects",
  "content/contexts": "contexts",
  "content/lessons": "lessons",
};

export function classifySourcePath(path: SourcePath): SourceBucket {
  for (const root of SOURCE_CONTENT_ROOTS) {
    if (path === root || path.startsWith(`${root}/`)) {
      return BUCKET_BY_ROOT[root];
    }
  }
  return "auxiliary";
}

const NO_LANGUAGE: SourceLanguageAssignment = {
  language: null,
  languageEvidence: null,
};

/**
 * Idioma por evidencia de path (nunca por contenido):
 * - `*.es.md` -> `es`/`suffix`.
 * - `*.en.md` -> `en`/`suffix`.
 * - `X.md` con `X.es.md` en el inventario -> `en`/`pair-convention`.
 * - resto -> `null`/`null`.
 */
export function resolveSourceLanguage(
  path: SourcePath,
  availablePaths: ReadonlySet<SourcePath>,
): SourceLanguageAssignment {
  if (path.endsWith(".es.md")) {
    return { language: "es", languageEvidence: "suffix" };
  }
  if (path.endsWith(".en.md")) {
    return { language: "en", languageEvidence: "suffix" };
  }
  if (path.endsWith(".md")) {
    const spanishPair = `${path.slice(0, -".md".length)}.es.md`;
    if (availablePaths.has(spanishPair)) {
      return { language: "en", languageEvidence: "pair-convention" };
    }
  }
  return NO_LANGUAGE;
}

/** `README.es.md` si existe; si no, `README.md`; si no, `null`. */
export function resolvePreferredProjectReadme(
  directory: SourcePath,
  availablePaths: ReadonlySet<SourcePath>,
): SourcePath | null {
  const candidates = [`${directory}/README.es.md`, `${directory}/README.md`];
  return candidates.find((candidate) => availablePaths.has(candidate)) ?? null;
}

/** Documento de lección: `<slug>.es.md` -> `<slug>.md` -> `<slug>.en.md`. */
export function resolvePreferredLessonDocument(
  directory: SourcePath,
  availablePaths: ReadonlySet<SourcePath>,
): SourcePath | null {
  const slug = directory.slice(directory.lastIndexOf("/") + 1);
  const candidates = [
    `${directory}/${slug}.es.md`,
    `${directory}/${slug}.md`,
    `${directory}/${slug}.en.md`,
  ];
  return candidates.find((candidate) => availablePaths.has(candidate)) ?? null;
}

function baseName(path: SourcePath): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function isDirectChild(path: SourcePath, directory: SourcePath): boolean {
  const prefix = `${directory}/`;
  return path.startsWith(prefix) && !path.slice(prefix.length).includes("/");
}

/** Documentos `CONTEXT-*.md` directamente bajo el directorio, ordenados. */
export function listDirectContextDocuments(
  directory: SourcePath,
  availablePaths: ReadonlySet<SourcePath>,
): readonly SourcePath[] {
  return [...availablePaths]
    .filter(
      (path) =>
        isDirectChild(path, directory) &&
        /^CONTEXT-.*\.md$/.test(baseName(path)),
    )
    .sort(comparePaths);
}

export function comparePaths(a: SourcePath, b: SourcePath): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function contextDocumentPriority(path: SourcePath): number {
  if (path.endsWith(".es.md")) return 0;
  if (path.endsWith(".en.md")) return 1;
  return 2;
}

/**
 * Documento preferido de un contexto: `README.es.md` -> `README.md` -> primer
 * `CONTEXT-*.es.md` -> primer `CONTEXT-*.en.md` -> primer `CONTEXT-*.md`.
 */
export function resolvePreferredContextDocument(
  directory: SourcePath,
  availablePaths: ReadonlySet<SourcePath>,
): SourcePath | null {
  const readmes = [`${directory}/README.es.md`, `${directory}/README.md`];
  const contextDocuments = [
    ...listDirectContextDocuments(directory, availablePaths),
  ].sort(
    (a, b) =>
      contextDocumentPriority(a) - contextDocumentPriority(b) ||
      comparePaths(a, b),
  );
  const candidates = [...readmes, ...contextDocuments];
  return candidates.find((candidate) => availablePaths.has(candidate)) ?? null;
}
