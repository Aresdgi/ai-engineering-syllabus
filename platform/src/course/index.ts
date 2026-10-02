/**
 * API pública de la capa de lectura `course/` (ADR-013).
 *
 * Re-exporta tipos, rutas y derivaciones puras, y expone las funciones async
 * que W2 consume desde Server Components. Estas funciones nunca lanzan por
 * falta de configuración (sin `DATABASE_URL` o sin snapshot devuelven
 * `null`/`[]`); los errores reales de conexión se propagan con mensaje
 * redactado (`describeError`) para que `error.tsx` no filtre secretos.
 *
 * `import "server-only"`: importar este módulo desde un Client Component falla
 * en build; la UI tonta no puede acceder a la base por accidente.
 */

import "server-only";

import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";

import type { MarkdownUrlResolver } from "../lib/markdown/types";
import { describeError } from "../lib/redact";
import { getCourseDb } from "./database";
import { CourseReader, createCourseReader } from "./reader";
import type {
  CourseDocument,
  CourseFileEntry,
  CourseLanguage,
  CourseSnapshot,
  CourseUnit,
  LanguageVariant,
  ProjectsIndex,
  ResolvedDocumentVariant,
  SourceFileBytes,
} from "./types";

export * from "./types";
export * from "./routes";
export {
  exactOrderEntryFor,
  firstOrderEntryFor,
  PROJECTS_DIRECTORY,
  PROJECTS_ORDER_PATH,
  PROJECTS_PREFERRED_README_PATH,
  parseProjectOrder,
  type ProjectOrder,
  type ProjectOrderEntry,
} from "./order";
export { extractDocumentTitle, markdownInlineToText } from "./title";
export { languagePathCandidates } from "./language";
export {
  createMarkdownResolver,
  githubBlobUrl,
  githubTreeUrl,
  mirrorRepositoryUrl,
  normalizeRepositoryUrl,
  resolveMarkdownHref,
  shortSha,
  type MarkdownResolutionContext,
  type ResolverFile,
} from "./links";

type ProductionReader = CourseReader<
  NodePgQueryResultHKT,
  Record<string, never>
>;

let cachedReader: ProductionReader | null = null;

let cachedReaderHasDatabase = false;

function currentReader(): ProductionReader {
  const db = getCourseDb();
  const hasDatabase = db !== null;
  if (cachedReader === null || hasDatabase !== cachedReaderHasDatabase) {
    cachedReader = createCourseReader(db);
    cachedReaderHasDatabase = hasDatabase;
  }
  return cachedReader;
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new Error(describeError(error, process.env));
  }
}

export async function getActiveSnapshot(): Promise<CourseSnapshot | null> {
  return guarded(() => currentReader().getActiveSnapshot());
}

export async function getProjectsIndex(
  lang?: CourseLanguage,
): Promise<ProjectsIndex | null> {
  return guarded(() => currentReader().getProjectsIndex(lang));
}

export async function getProject(
  slug: string,
  lang?: CourseLanguage,
): Promise<CourseUnit | null> {
  return guarded(() => currentReader().getProject(slug, lang));
}

export async function listSubprojects(
  parent: CourseUnit,
  lang?: CourseLanguage,
): Promise<CourseUnit[]> {
  return guarded(() => currentReader().listSubprojects(parent, lang));
}

export async function getSubproject(
  parentSlug: string,
  slug: string,
  lang?: CourseLanguage,
): Promise<CourseUnit | null> {
  return guarded(() => currentReader().getSubproject(parentSlug, slug, lang));
}

export async function listContexts(
  lang?: CourseLanguage,
): Promise<CourseUnit[]> {
  return guarded(() => currentReader().listContexts(lang));
}

export async function getContext(
  slug: string,
  lang?: CourseLanguage,
): Promise<CourseUnit | null> {
  return guarded(() => currentReader().getContext(slug, lang));
}

export async function resolveDocumentVariant(
  path: string,
  lang: CourseLanguage,
): Promise<ResolvedDocumentVariant | null> {
  return guarded(() => currentReader().resolveDocumentVariant(path, lang));
}

export async function listContextDocuments(
  unit: CourseUnit,
  lang?: CourseLanguage,
): Promise<CourseFileEntry[]> {
  return guarded(() => currentReader().listContextDocuments(unit, lang));
}

export async function listUnitAssets(
  unit: CourseUnit,
): Promise<CourseFileEntry[]> {
  return guarded(() => currentReader().listUnitAssets(unit));
}

export async function listLessons(
  lang?: CourseLanguage,
): Promise<CourseUnit[]> {
  return guarded(() => currentReader().listLessons(lang));
}

export async function getLesson(
  slug: string,
  lang?: CourseLanguage,
): Promise<CourseUnit | null> {
  return guarded(() => currentReader().getLesson(slug, lang));
}

export async function getDocument(
  path: string,
): Promise<CourseDocument | null> {
  return guarded(() => currentReader().getDocument(path));
}

export async function getFileBytes(
  path: string,
): Promise<SourceFileBytes | null> {
  return guarded(() => currentReader().getFileBytes(path));
}

export async function listLanguageVariants(
  path: string,
): Promise<LanguageVariant[]> {
  return guarded(() => currentReader().listLanguageVariants(path));
}

export async function createMarkdownUrlResolver(
  fromPath: string,
): Promise<MarkdownUrlResolver> {
  return guarded(() => currentReader().createMarkdownUrlResolver(fromPath));
}
