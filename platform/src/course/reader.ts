/**
 * Capa de lectura `course/` (ADR-013): solo lectura del snapshot SOURCE más
 * reciente terminado, con orden, títulos, idiomas y enlaces derivados en
 * lectura (jamás persistidos ni inventados).
 *
 * Reglas:
 * - Sin base inyectada (`null`), todas las funciones devuelven `null`/`[]`.
 * - Las consultas de lista nunca seleccionan `raw_content`; solo se leen los
 *   documentos concretos necesarios (README de proyectos, documento preferido
 *   para el H1 y el resolvedor de enlaces).
 * - El mapa de paths y las vistas internas se memoizan por `snapshotId` en la
 *   instancia; no hay N+1 por enlace. El índice de EXTERNAL_ARCHIVE no se
 *   memoiza con el snapshot (T-01): sus tablas son mutables y se releen por
 *   request.
 * - Los subproyectos se derivan en lectura: directorio hijo directo de un
 *   proyecto de primer nivel que contiene `learn.json` (excluye `.ocultos`).
 * - Cualquier escritura en base está prohibida: este módulo solo usa `select`.
 */

import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { cache } from "react";

import {
  sourceBlobs,
  sourceContexts,
  sourceFiles,
  sourceImportErrors,
  sourceLessons,
  sourceProjects,
  sourceRepositories,
  sourceSnapshots,
} from "../source/store/schema";
import type { MarkdownUrlResolver } from "../lib/markdown/types";
import { describeError } from "../lib/redact";
import {
  createExternalArchiveReader,
  type ExternalArchiveReader,
} from "./external-archive";
import {
  isCourseLanguage,
  isCourseLanguageEvidence,
  languagePathCandidates,
} from "./language";
import {
  createMarkdownResolver,
  mirrorRepositoryUrl,
  type MarkdownResolutionContext,
} from "./links";
import {
  exactOrderEntryFor,
  firstOrderEntryFor,
  parseProjectOrder,
  PROJECTS_DIRECTORY,
  PROJECTS_ORDER_PATH,
  PROJECTS_PREFERRED_README_PATH,
  type ProjectOrderEntry,
} from "./order";
import { basename, collectDirectories, relativePathWithin } from "./path-utils";
import {
  contextHref,
  lessonHref,
  projectHref,
  sourceFileHref,
  subprojectHref,
} from "./routes";
import { extractDocumentTitle, markdownInlineToText } from "./title";
import type {
  CourseDocument,
  CourseFileEntry,
  CourseLanguage,
  CourseLanguageEvidence,
  CourseSnapshot,
  CourseUnit,
  CourseUnitKind,
  ExternalArchiveLink,
  LanguageVariant,
  ProjectsIndex,
  ResolvedDocumentVariant,
  SourceFileBytes,
} from "./types";

const ACTIVE_SNAPSHOT_STATUSES = ["complete", "complete_with_errors"] as const;

const CONTEXTS_DIRECTORY = "content/contexts";

const LESSONS_DIRECTORY = "content/lessons";

const LEARN_JSON_FILE = "learn.json";

const README_ES_FILE = "README.es.md";

const README_EN_FILE = "README.md";

const TEXT_ENCODER = new TextEncoder();

/** Clave de par de idioma ADR-012: path sin sufijo `.md`/`.es.md`/`.en.md`. */
function markdownPairKey(path: string): string {
  return path.replace(/\.(?:es|en)\.md$/i, "").replace(/\.md$/i, "");
}

/** Normaliza los bytes que devuelve el driver a `Uint8Array`. */
function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof value === "string") {
    return TEXT_ENCODER.encode(value);
  }
  return null;
}

type FileRow = {
  path: string;
  blobSha: string;
  mediaType: string;
  language: CourseLanguage | null;
  languageEvidence: CourseLanguageEvidence | null;
  binaryReference: string | null;
  kind: "text" | "binary";
};

type UnitIndexRow = {
  sourcePath: string;
  preferredDocumentPath: string | null;
  language: CourseLanguage | null;
  languageEvidence: CourseLanguageEvidence | null;
};

type SubprojectRow = {
  sourcePath: string;
  slug: string;
  parentSlug: string;
  preferredDocumentPath: string | null;
};

type ResolverViews = {
  fileHrefs: Map<string, string>;
  directoryHrefs: Map<string, string>;
};

type SnapshotContext = {
  snapshot: CourseSnapshot;
  files: Map<string, FileRow>;
  directories: Set<string>;
  projects: UnitIndexRow[];
  contexts: UnitIndexRow[];
  lessons: UnitIndexRow[];
  rawContents: Map<string, string>;
  orderEntries: Map<string, ProjectOrderEntry[]>;
  views: ResolverViews | null;
};

function toLanguage(value: unknown): CourseLanguage | null {
  return isCourseLanguage(value) ? value : null;
}

function toEvidence(value: unknown): CourseLanguageEvidence | null {
  return isCourseLanguageEvidence(value) ? value : null;
}

function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function toUnitIndexRow(row: {
  sourcePath: string;
  preferredReadmePath: string | null;
  language: string | null;
  languageEvidence: string | null;
}): UnitIndexRow {
  return {
    sourcePath: row.sourcePath,
    preferredDocumentPath: row.preferredReadmePath,
    language: toLanguage(row.language),
    languageEvidence: toEvidence(row.languageEvidence),
  };
}

/** Ordena proyectos: listados por posición del README; no listados al final por path. */
function compareProjectUnits(a: CourseUnit, b: CourseUnit): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) {
    return a.order - b.order;
  }
  if (a.order !== null && b.order === null) {
    return -1;
  }
  if (a.order === null && b.order !== null) {
    return 1;
  }
  return comparePaths(a.sourcePath, b.sourcePath);
}

/**
 * Lector de EXTERNAL_ARCHIVE memoizado por request con `cache()` de React
 * (T-01), con la base del `CourseReader` como clave de identidad. Dentro de
 * una request todos los resolvedores comparten el índice de archivo; entre
 * requests se relee, porque `external_archive_*` es mutable (el CLI captura
 * desde otro proceso). Fuera de una request React no memoiza: cada llamada
 * construye un lector nuevo y relee.
 */
const externalArchiveForDatabase = cache(
  <
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
  >(
    db: PgDatabase<TQueryResult, TFullSchema> | null,
  ): ExternalArchiveReader => createExternalArchiveReader(db),
);

export class CourseReader<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> {
  private readonly contexts = new Map<
    string,
    Promise<SnapshotContext | null>
  >();

  constructor(
    private readonly db: PgDatabase<TQueryResult, TFullSchema> | null,
  ) {}

  // --- Snapshot activo ------------------------------------------------------

  async getActiveSnapshot(): Promise<CourseSnapshot | null> {
    if (!this.db) {
      return null;
    }
    const [row] = await this.db
      .select({
        snapshotId: sourceSnapshots.id,
        ref: sourceSnapshots.ref,
        commitSha: sourceSnapshots.commitSha,
        importedAt: sourceSnapshots.importedAt,
        status: sourceSnapshots.status,
        owner: sourceRepositories.owner,
        name: sourceRepositories.name,
        canonicalUrl: sourceRepositories.canonicalUrl,
      })
      .from(sourceSnapshots)
      .innerJoin(
        sourceRepositories,
        eq(sourceRepositories.id, sourceSnapshots.repositoryId),
      )
      .where(inArray(sourceSnapshots.status, [...ACTIVE_SNAPSHOT_STATUSES]))
      .orderBy(desc(sourceSnapshots.importedAt), desc(sourceSnapshots.id))
      .limit(1);

    if (!row) {
      return null;
    }

    const [errorRow] = await this.db
      .select({ total: count() })
      .from(sourceImportErrors)
      .where(eq(sourceImportErrors.snapshotId, row.snapshotId));

    return {
      snapshotId: row.snapshotId,
      owner: row.owner,
      name: row.name,
      canonicalUrl: row.canonicalUrl,
      ref: row.ref,
      commitSha: row.commitSha,
      importedAt: row.importedAt.toISOString(),
      status: row.status === "complete" ? "complete" : "complete_with_errors",
      errorCount: errorRow?.total ?? 0,
    };
  }

  // --- Contexto memoizado por snapshot --------------------------------------

  private async loadSnapshotContext(): Promise<SnapshotContext | null> {
    const snapshot = await this.getActiveSnapshot();
    if (!snapshot) {
      return null;
    }
    const cached = this.contexts.get(snapshot.snapshotId);
    if (cached) {
      return cached;
    }
    const promise = this.buildSnapshotContext(snapshot);
    this.contexts.set(snapshot.snapshotId, promise);
    return promise;
  }

  private async buildSnapshotContext(
    snapshot: CourseSnapshot,
  ): Promise<SnapshotContext> {
    const db = this.db;
    if (!db) {
      throw new Error("CourseReader sin base de datos");
    }
    const [fileRows, projectRows, contextRows, lessonRows] = await Promise.all([
      db
        .select({
          path: sourceFiles.path,
          blobSha: sourceFiles.blobSha,
          mediaType: sourceFiles.mediaType,
          language: sourceFiles.language,
          languageEvidence: sourceFiles.languageEvidence,
          binaryReference: sourceFiles.binaryReference,
        })
        .from(sourceFiles)
        .where(eq(sourceFiles.snapshotId, snapshot.snapshotId)),
      db
        .select({
          sourcePath: sourceProjects.sourcePath,
          preferredReadmePath: sourceProjects.preferredReadmePath,
          language: sourceProjects.language,
          languageEvidence: sourceProjects.languageEvidence,
        })
        .from(sourceProjects)
        .where(eq(sourceProjects.snapshotId, snapshot.snapshotId))
        .orderBy(asc(sourceProjects.sourcePath)),
      db
        .select({
          sourcePath: sourceContexts.sourcePath,
          preferredReadmePath: sourceContexts.preferredReadmePath,
          language: sourceContexts.language,
          languageEvidence: sourceContexts.languageEvidence,
        })
        .from(sourceContexts)
        .where(eq(sourceContexts.snapshotId, snapshot.snapshotId))
        .orderBy(asc(sourceContexts.sourcePath)),
      db
        .select({
          sourcePath: sourceLessons.sourcePath,
          preferredReadmePath: sourceLessons.preferredReadmePath,
          language: sourceLessons.language,
          languageEvidence: sourceLessons.languageEvidence,
        })
        .from(sourceLessons)
        .where(eq(sourceLessons.snapshotId, snapshot.snapshotId))
        .orderBy(asc(sourceLessons.sourcePath)),
    ]);

    const files = new Map<string, FileRow>();
    for (const row of fileRows) {
      files.set(row.path, {
        path: row.path,
        blobSha: row.blobSha,
        mediaType: row.mediaType,
        language: toLanguage(row.language),
        languageEvidence: toEvidence(row.languageEvidence),
        binaryReference: row.binaryReference,
        kind: row.binaryReference === null ? "text" : "binary",
      });
    }

    return {
      snapshot,
      files,
      directories: collectDirectories(files.keys()),
      projects: projectRows.map(toUnitIndexRow),
      contexts: contextRows.map(toUnitIndexRow),
      lessons: lessonRows.map(toUnitIndexRow),
      rawContents: new Map(),
      orderEntries: new Map(),
      views: null,
    };
  }

  // --- Lecturas auxiliares --------------------------------------------------

  private async loadRawContents(
    context: SnapshotContext,
    paths: readonly string[],
  ): Promise<void> {
    const missing = [
      ...new Set(
        paths.filter(
          (path) =>
            !context.rawContents.has(path) &&
            context.files.get(path)?.kind === "text",
        ),
      ),
    ];
    if (missing.length === 0 || !this.db) {
      return;
    }
    const rows = await this.db
      .select({ path: sourceFiles.path, rawContent: sourceFiles.rawContent })
      .from(sourceFiles)
      .where(
        and(
          eq(sourceFiles.snapshotId, context.snapshot.snapshotId),
          inArray(sourceFiles.path, missing),
        ),
      );
    for (const row of rows) {
      if (row.rawContent !== null) {
        context.rawContents.set(row.path, row.rawContent);
      }
    }
  }

  private async loadOrderEntries(
    context: SnapshotContext,
    readmePath: string,
  ): Promise<ProjectOrderEntry[]> {
    const cached = context.orderEntries.get(readmePath);
    if (cached) {
      return cached;
    }
    const file = context.files.get(readmePath);
    if (!file || file.kind !== "text") {
      context.orderEntries.set(readmePath, []);
      return [];
    }
    await this.loadRawContents(context, [readmePath]);
    const content = context.rawContents.get(readmePath);
    const entries =
      content === undefined ? [] : [...parseProjectOrder(content).entries];
    context.orderEntries.set(readmePath, entries);
    return entries;
  }

  private projectsReadmeFor(
    context: SnapshotContext,
    lang?: CourseLanguage,
  ): string {
    const hasSpanish = context.files.has(PROJECTS_PREFERRED_README_PATH);
    if (lang === "en") {
      return context.files.has(PROJECTS_ORDER_PATH)
        ? PROJECTS_ORDER_PATH
        : PROJECTS_PREFERRED_README_PATH;
    }
    return hasSpanish ? PROJECTS_PREFERRED_README_PATH : PROJECTS_ORDER_PATH;
  }

  private async readDocumentTitle(
    context: SnapshotContext,
    path: string | null,
  ): Promise<string | null> {
    if (path === null) {
      return null;
    }
    const file = context.files.get(path);
    if (!file || file.kind !== "text") {
      return null;
    }
    await this.loadRawContents(context, [path]);
    const content = context.rawContents.get(path);
    return content === undefined ? null : extractDocumentTitle(content);
  }

  private cachedTitle(
    context: SnapshotContext,
    path: string | null,
  ): string | null {
    if (path === null) {
      return null;
    }
    const content = context.rawContents.get(path);
    return content === undefined ? null : extractDocumentTitle(content);
  }

  private unitLanguage(
    context: SnapshotContext,
    row: UnitIndexRow,
  ): {
    language: CourseLanguage | null;
    languageEvidence: CourseLanguageEvidence | null;
  } {
    const file = row.preferredDocumentPath
      ? context.files.get(row.preferredDocumentPath)
      : undefined;
    if (file && file.language !== null) {
      return {
        language: file.language,
        languageEvidence: file.languageEvidence,
      };
    }
    return {
      language: row.language,
      languageEvidence: row.languageEvidence,
    };
  }

  private async buildProjectUnit(
    context: SnapshotContext,
    row: UnitIndexRow,
    orderEntries: readonly ProjectOrderEntry[],
    labelEntries: readonly ProjectOrderEntry[],
    lang?: CourseLanguage,
  ): Promise<CourseUnit> {
    const orderEntry = firstOrderEntryFor(orderEntries, row.sourcePath);
    const labelEntry =
      firstOrderEntryFor(labelEntries, row.sourcePath) ?? orderEntry;
    const language = this.unitLanguage(context, row);

    let title: string;
    let titleOrigin: CourseUnit["titleOrigin"];
    let description: string | null = null;
    if (labelEntry) {
      title = markdownInlineToText(labelEntry.label);
      titleOrigin = "readme-label";
      description = labelEntry.description;
    } else {
      // QA-F1: sin etiqueta en el README, el H1 sale de la variante real del
      // idioma pedido (el preferido es español aunque se pida inglés).
      const h1 = await this.readDocumentTitle(
        context,
        this.titlePathFor(context, row, lang),
      );
      title = h1 ?? basename(row.sourcePath);
      titleOrigin = h1 === null ? "source-path" : "document-h1";
    }

    return {
      kind: "project",
      sourcePath: row.sourcePath,
      slug: basename(row.sourcePath),
      parentSlug: null,
      title,
      titleOrigin,
      description,
      order: orderEntry?.position ?? null,
      listMarker: labelEntry?.listMarker ?? null,
      orderSection: labelEntry?.section ?? null,
      preferredDocumentPath: row.preferredDocumentPath,
      language: language.language,
      languageEvidence: language.languageEvidence,
    };
  }

  private deriveSubprojectRows(
    context: SnapshotContext,
    parentSourcePath: string,
  ): SubprojectRow[] {
    const prefix = `${parentSourcePath}/`;
    const names = new Set<string>();
    for (const path of context.files.keys()) {
      if (!path.startsWith(prefix)) {
        continue;
      }
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash <= 0) {
        continue;
      }
      const name = rest.slice(0, slash);
      if (name.startsWith(".")) {
        continue;
      }
      if (context.files.has(`${prefix}${name}/${LEARN_JSON_FILE}`)) {
        names.add(name);
      }
    }
    const parentSlug = basename(parentSourcePath);
    return [...names].sort(comparePaths).map((name) => {
      const directory = `${prefix}${name}`;
      const spanish = `${directory}/${README_ES_FILE}`;
      const english = `${directory}/${README_EN_FILE}`;
      const preferred = context.files.has(spanish)
        ? spanish
        : context.files.has(english)
          ? english
          : null;
      return {
        sourcePath: directory,
        slug: name,
        parentSlug,
        preferredDocumentPath: preferred,
      };
    });
  }

  private async buildSubprojectUnit(
    context: SnapshotContext,
    row: SubprojectRow,
    orderEntries: readonly ProjectOrderEntry[],
    labelEntries: readonly ProjectOrderEntry[],
    lang?: CourseLanguage,
  ): Promise<CourseUnit> {
    const orderEntry = exactOrderEntryFor(orderEntries, row.sourcePath);
    const labelEntry = exactOrderEntryFor(labelEntries, row.sourcePath);
    const language: UnitIndexRow = {
      sourcePath: row.sourcePath,
      preferredDocumentPath: row.preferredDocumentPath,
      language: null,
      languageEvidence: null,
    };
    const resolvedLanguage = this.unitLanguage(context, language);

    let title: string;
    let titleOrigin: CourseUnit["titleOrigin"];
    if (labelEntry) {
      title = markdownInlineToText(labelEntry.label);
      titleOrigin = "readme-label";
    } else {
      // QA-F1: mismo fallback que los proyectos, con la variante real del
      // idioma pedido.
      const h1 = await this.readDocumentTitle(
        context,
        this.titlePathFor(context, row, lang),
      );
      title = h1 ?? row.slug;
      titleOrigin = h1 === null ? "source-path" : "document-h1";
    }

    return {
      kind: "subproject",
      sourcePath: row.sourcePath,
      slug: row.slug,
      parentSlug: row.parentSlug,
      title,
      titleOrigin,
      description: labelEntry?.description ?? null,
      order: orderEntry?.position ?? null,
      listMarker: labelEntry?.listMarker ?? null,
      orderSection: labelEntry?.section ?? null,
      preferredDocumentPath: row.preferredDocumentPath,
      language: resolvedLanguage.language,
      languageEvidence: resolvedLanguage.languageEvidence,
    };
  }

  /** Variante del documento preferido en `lang`; el propio path si no existe. */
  private variantPathFor(
    context: SnapshotContext,
    path: string,
    lang: CourseLanguage,
  ): string {
    const direct = context.files.get(path);
    if (direct?.kind === "text" && direct.language === lang) {
      return path;
    }
    for (const candidate of languagePathCandidates(path)) {
      const file = context.files.get(candidate);
      if (file?.kind === "text" && file.language === lang) {
        return candidate;
      }
    }
    return path;
  }

  /** Path del que sale el H1 de una unidad para el idioma pedido. */
  private titlePathFor(
    context: SnapshotContext,
    row: { preferredDocumentPath: string | null },
    lang?: CourseLanguage,
  ): string | null {
    if (row.preferredDocumentPath === null) {
      return null;
    }
    return lang === undefined
      ? row.preferredDocumentPath
      : this.variantPathFor(context, row.preferredDocumentPath, lang);
  }

  private async buildIndexUnits(
    context: SnapshotContext,
    rows: readonly UnitIndexRow[],
    kind: CourseUnitKind,
    lang?: CourseLanguage,
  ): Promise<CourseUnit[]> {
    await this.loadRawContents(
      context,
      rows.map((row) => this.titlePathFor(context, row, lang)).filter(isString),
    );
    return rows.map((row) => {
      const h1 = this.cachedTitle(
        context,
        this.titlePathFor(context, row, lang),
      );
      const language = this.unitLanguage(context, row);
      return {
        kind,
        sourcePath: row.sourcePath,
        slug: basename(row.sourcePath),
        parentSlug: null,
        title: h1 ?? basename(row.sourcePath),
        titleOrigin: h1 === null ? "source-path" : "document-h1",
        description: null,
        order: null,
        listMarker: null,
        orderSection: null,
        preferredDocumentPath: row.preferredDocumentPath,
        language: language.language,
        languageEvidence: language.languageEvidence,
      };
    });
  }

  // --- API pública ----------------------------------------------------------

  async getProjectsIndex(lang?: CourseLanguage): Promise<ProjectsIndex | null> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return null;
    }
    const orderEntries = await this.loadOrderEntries(
      context,
      PROJECTS_ORDER_PATH,
    );
    const requestedReadme = this.projectsReadmeFor(context, lang);
    const labelEntries = await this.loadOrderEntries(context, requestedReadme);
    await this.loadRawContents(
      context,
      [
        requestedReadme,
        PROJECTS_ORDER_PATH,
        ...context.projects.map((row) => this.titlePathFor(context, row, lang)),
      ].filter(isString),
    );

    const units: CourseUnit[] = [];
    for (const row of context.projects) {
      units.push(
        await this.buildProjectUnit(
          context,
          row,
          orderEntries,
          labelEntries,
          lang,
        ),
      );
    }
    units.sort(compareProjectUnits);

    const readme = this.textDocument(context, requestedReadme);
    const orderSource = this.textDocument(context, PROJECTS_ORDER_PATH);
    if (!readme || !orderSource) {
      return null;
    }
    return { readme, orderSource, units };
  }

  async getProject(
    slug: string,
    lang?: CourseLanguage,
  ): Promise<CourseUnit | null> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return null;
    }
    const sourcePath = `${PROJECTS_DIRECTORY}/${slug}`;
    const row = context.projects.find(
      (candidate) => candidate.sourcePath === sourcePath,
    );
    if (!row) {
      return null;
    }
    const orderEntries = await this.loadOrderEntries(
      context,
      PROJECTS_ORDER_PATH,
    );
    const requestedReadme = this.projectsReadmeFor(context, lang);
    const labelEntries = await this.loadOrderEntries(context, requestedReadme);
    return this.buildProjectUnit(
      context,
      row,
      orderEntries,
      labelEntries,
      lang,
    );
  }

  async listSubprojects(
    parent: CourseUnit,
    lang?: CourseLanguage,
  ): Promise<CourseUnit[]> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return [];
    }
    const orderEntries = await this.loadOrderEntries(
      context,
      PROJECTS_ORDER_PATH,
    );
    const requestedReadme = this.projectsReadmeFor(context, lang);
    const labelEntries = await this.loadOrderEntries(context, requestedReadme);
    const rows = this.deriveSubprojectRows(context, parent.sourcePath);
    await this.loadRawContents(
      context,
      rows.map((row) => this.titlePathFor(context, row, lang)).filter(isString),
    );
    const units: CourseUnit[] = [];
    for (const row of rows) {
      units.push(
        await this.buildSubprojectUnit(
          context,
          row,
          orderEntries,
          labelEntries,
          lang,
        ),
      );
    }
    units.sort(compareProjectUnits);
    return units;
  }

  async getSubproject(
    parentSlug: string,
    slug: string,
    lang?: CourseLanguage,
  ): Promise<CourseUnit | null> {
    const parent = await this.getProject(parentSlug, lang);
    if (!parent) {
      return null;
    }
    const subprojects = await this.listSubprojects(parent, lang);
    return subprojects.find((unit) => unit.slug === slug) ?? null;
  }

  async listContexts(lang?: CourseLanguage): Promise<CourseUnit[]> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return [];
    }
    return this.buildIndexUnits(context, context.contexts, "context", lang);
  }

  async getContext(
    slug: string,
    lang?: CourseLanguage,
  ): Promise<CourseUnit | null> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return null;
    }
    const sourcePath = `${CONTEXTS_DIRECTORY}/${slug}`;
    const row = context.contexts.find(
      (candidate) => candidate.sourcePath === sourcePath,
    );
    if (!row) {
      return null;
    }
    const [unit] = await this.buildIndexUnits(context, [row], "context", lang);
    return unit ?? null;
  }

  async listLessons(lang?: CourseLanguage): Promise<CourseUnit[]> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return [];
    }
    return this.buildIndexUnits(context, context.lessons, "lesson", lang);
  }

  async getLesson(
    slug: string,
    lang?: CourseLanguage,
  ): Promise<CourseUnit | null> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return null;
    }
    const sourcePath = `${LESSONS_DIRECTORY}/${slug}`;
    const row = context.lessons.find(
      (candidate) => candidate.sourcePath === sourcePath,
    );
    if (!row) {
      return null;
    }
    const [unit] = await this.buildIndexUnits(context, [row], "lesson", lang);
    return unit ?? null;
  }

  /**
   * Elige la variante de idioma real del documento: la pedida si existe; si
   * no, la que exista con `isFallback: true`. `null` si el path no es un
   * documento de texto del snapshot activo.
   */
  async resolveDocumentVariant(
    path: string,
    lang: CourseLanguage,
  ): Promise<ResolvedDocumentVariant | null> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return null;
    }
    const file = context.files.get(path);
    if (!file || file.kind !== "text") {
      return null;
    }
    const variantPath = this.variantPathFor(context, path, lang);
    if (variantPath !== path) {
      return { path: variantPath, language: lang, isFallback: false };
    }
    if (file.language === lang) {
      return { path, language: lang, isFallback: false };
    }
    return {
      path,
      language: file.language,
      isFallback: file.language !== null,
    };
  }

  async getDocument(path: string): Promise<CourseDocument | null> {
    if (!this.db) {
      return null;
    }
    const snapshot = await this.getActiveSnapshot();
    if (!snapshot) {
      return null;
    }
    const [row] = await this.db
      .select({
        path: sourceFiles.path,
        blobSha: sourceFiles.blobSha,
        mediaType: sourceFiles.mediaType,
        language: sourceFiles.language,
        languageEvidence: sourceFiles.languageEvidence,
        rawContent: sourceFiles.rawContent,
        binaryReference: sourceFiles.binaryReference,
      })
      .from(sourceFiles)
      .where(
        and(
          eq(sourceFiles.snapshotId, snapshot.snapshotId),
          eq(sourceFiles.path, path),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    if (row.binaryReference !== null) {
      return {
        kind: "binary",
        path: row.path,
        blobSha: row.blobSha,
        mediaType: row.mediaType,
        binaryReference: row.binaryReference,
      };
    }
    if (row.rawContent === null) {
      return null;
    }
    return {
      kind: "text",
      path: row.path,
      blobSha: row.blobSha,
      mediaType: row.mediaType,
      language: toLanguage(row.language),
      languageEvidence: toEvidence(row.languageEvidence),
      rawContent: row.rawContent,
    };
  }

  /**
   * Todos los markdown bajo el directorio de la unidad, ordenados por path.
   * Con `lang`, de cada par ADR-012 se devuelve solo la variante en ese idioma
   * (o la existente con `isFallback: true`); sin idioma se devuelven tal cual.
   */
  async listContextDocuments(
    unit: CourseUnit,
    lang?: CourseLanguage,
  ): Promise<CourseFileEntry[]> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return [];
    }
    const entries: CourseFileEntry[] = [];
    if (lang === undefined) {
      for (const [path, file] of context.files) {
        const relative = relativePathWithin(unit.sourcePath, path);
        if (relative === null || file.mediaType !== "text/markdown") {
          continue;
        }
        entries.push({
          path,
          relativePath: relative,
          mediaType: file.mediaType,
          kind: "text",
          language: file.language,
          href:
            path === unit.preferredDocumentPath
              ? contextHref(unit.slug)
              : contextHref(unit.slug, relative),
          hrefKind: "internal",
        });
      }
    } else {
      const chosen = new Map<
        string,
        { path: string; relativePath: string; file: FileRow }
      >();
      for (const [path, file] of context.files) {
        const relative = relativePathWithin(unit.sourcePath, path);
        if (relative === null || file.mediaType !== "text/markdown") {
          continue;
        }
        const key = markdownPairKey(path);
        const current = chosen.get(key);
        if (
          current === undefined ||
          this.isBetterVariant(
            unit,
            lang,
            path,
            file,
            current.path,
            current.file,
          )
        ) {
          chosen.set(key, { path, relativePath: relative, file });
        }
      }
      for (const { path, relativePath, file } of chosen.values()) {
        entries.push({
          path,
          relativePath,
          mediaType: file.mediaType,
          kind: "text",
          language: file.language,
          isFallback: file.language !== lang,
          href:
            path === unit.preferredDocumentPath
              ? contextHref(unit.slug)
              : contextHref(unit.slug, relativePath),
          hrefKind: "internal",
        });
      }
    }
    entries.sort((a, b) => comparePaths(a.path, b.path));
    return entries;
  }

  /**
   * Prioridad de variante: idioma pedido > documento preferido de la unidad >
   * path lexicográfico (desempate determinista).
   */
  private isBetterVariant(
    unit: CourseUnit,
    lang: CourseLanguage,
    candidatePath: string,
    candidateFile: FileRow,
    currentPath: string,
    currentFile: FileRow,
  ): boolean {
    const score = (path: string, file: FileRow): number => {
      if (file.language === lang) {
        return 0;
      }
      if (path === unit.preferredDocumentPath) {
        return 1;
      }
      return 2;
    };
    const candidateScore = score(candidatePath, candidateFile);
    const currentScore = score(currentPath, currentFile);
    if (candidateScore !== currentScore) {
      return candidateScore < currentScore;
    }
    return comparePaths(candidatePath, currentPath) < 0;
  }

  /**
   * Archivos no markdown bajo el directorio de la unidad, ordenados por path.
   * Todos se sirven desde la propia app (`/source-files/`, ADR-018).
   */
  async listUnitAssets(unit: CourseUnit): Promise<CourseFileEntry[]> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return [];
    }
    const entries: CourseFileEntry[] = [];
    for (const [path, file] of context.files) {
      const relative = relativePathWithin(unit.sourcePath, path);
      if (relative === null || file.mediaType === "text/markdown") {
        continue;
      }
      entries.push({
        path,
        relativePath: relative,
        mediaType: file.mediaType,
        kind: file.kind,
        language: file.language,
        href: sourceFileHref(path),
        hrefKind: "source",
      });
    }
    entries.sort((a, b) => comparePaths(a.path, b.path));
    return entries;
  }

  /**
   * Bytes del archivo en el snapshot activo (ADR-018): texto → `raw_content`
   * UTF-8; binario → `source_blobs` por `blob_sha`. `null` si el path no
   * existe o faltan los bytes.
   */
  async getFileBytes(path: string): Promise<SourceFileBytes | null> {
    if (!this.db) {
      return null;
    }
    const snapshot = await this.getActiveSnapshot();
    if (!snapshot) {
      return null;
    }
    const [row] = await this.db
      .select({
        path: sourceFiles.path,
        blobSha: sourceFiles.blobSha,
        mediaType: sourceFiles.mediaType,
        rawContent: sourceFiles.rawContent,
        binaryReference: sourceFiles.binaryReference,
      })
      .from(sourceFiles)
      .where(
        and(
          eq(sourceFiles.snapshotId, snapshot.snapshotId),
          eq(sourceFiles.path, path),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    if (row.rawContent !== null) {
      return {
        path: row.path,
        mediaType: row.mediaType,
        blobSha: row.blobSha,
        bytes: TEXT_ENCODER.encode(row.rawContent),
      };
    }
    if (row.binaryReference === null) {
      return null;
    }
    const [blob] = await this.db
      .select({ bytes: sourceBlobs.bytes })
      .from(sourceBlobs)
      .where(eq(sourceBlobs.blobSha, row.blobSha))
      .limit(1);
    const bytes = blob === undefined ? null : toBytes(blob.bytes);
    if (bytes === null) {
      return null;
    }
    return {
      path: row.path,
      mediaType: row.mediaType,
      blobSha: row.blobSha,
      bytes,
    };
  }

  async listLanguageVariants(path: string): Promise<LanguageVariant[]> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return [];
    }
    const variants: LanguageVariant[] = [];
    const seen = new Set<string>();
    for (const candidate of languagePathCandidates(path)) {
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      const file = context.files.get(candidate);
      if (
        !file ||
        file.kind !== "text" ||
        file.language === null ||
        file.languageEvidence === null
      ) {
        continue;
      }
      variants.push({
        language: file.language,
        evidence: file.languageEvidence,
        path: candidate,
        isPreferred: false,
      });
    }
    if (variants.length === 0) {
      return [];
    }
    const preferredIndex = variants.findIndex(
      (variant) => variant.language === "es",
    );
    variants[preferredIndex === -1 ? 0 : preferredIndex].isPreferred = true;
    return variants;
  }

  async createMarkdownUrlResolver(
    fromPath: string,
  ): Promise<MarkdownUrlResolver> {
    const context = await this.loadSnapshotContext();
    if (!context) {
      return (rawHref) => ({ kind: "broken", href: null, rawHref });
    }
    const views = this.getViews(context);
    const resolutionContext: MarkdownResolutionContext = {
      fromPath,
      sourceLanguage: context.files.get(fromPath)?.language ?? null,
      files: context.files,
      directories: context.directories,
      fileHrefs: views.fileHrefs,
      directoryHrefs: views.directoryHrefs,
      snapshot: context.snapshot,
      repositoryUrl: mirrorRepositoryUrl(),
      externalArchive: await this.loadExternalArchiveIndex(),
    };
    return createMarkdownResolver(resolutionContext);
  }

  /**
   * Índice de EXTERNAL_ARCHIVE (URL canónica → item) para el resolvedor. No se
   * memoiza junto al snapshot (T-01): `external_archive_*` es mutable y el CLI
   * captura desde otro proceso, así que el lector se comparte solo dentro de la
   * request (`cache()` de React) y entre requests se relee. Si la base del
   * archivo no está disponible (migración ausente, error transitorio), degrada
   * a un índice vacío para no romper la lectura del curso.
   */
  private async loadExternalArchiveIndex(): Promise<
    ReadonlyMap<string, ExternalArchiveLink>
  > {
    return this.externalArchive()
      .createExternalArchiveIndex()
      .catch((error: unknown) => {
        console.error(
          `[course] índice de material archivado no disponible: ${describeError(error, process.env)}`,
        );
        return new Map<string, ExternalArchiveLink>();
      });
  }

  private externalArchive(): ExternalArchiveReader {
    return externalArchiveForDatabase(this.db);
  }

  // --- Vistas internas para el resolvedor -----------------------------------

  private getViews(context: SnapshotContext): ResolverViews {
    if (context.views) {
      return context.views;
    }
    const fileHrefs = new Map<string, string>();
    const directoryHrefs = new Map<string, string>();

    for (const row of context.projects) {
      const slug = basename(row.sourcePath);
      directoryHrefs.set(row.sourcePath, projectHref(slug));
      this.addDocumentVariants(
        context,
        row.preferredDocumentPath,
        () => projectHref(slug),
        fileHrefs,
      );
      for (const subproject of this.deriveSubprojectRows(
        context,
        row.sourcePath,
      )) {
        directoryHrefs.set(
          subproject.sourcePath,
          subprojectHref(subproject.parentSlug, subproject.slug),
        );
        this.addDocumentVariants(
          context,
          subproject.preferredDocumentPath,
          () => subprojectHref(subproject.parentSlug, subproject.slug),
          fileHrefs,
        );
      }
    }

    for (const row of context.contexts) {
      const slug = basename(row.sourcePath);
      directoryHrefs.set(row.sourcePath, contextHref(slug));
      const prefix = `${row.sourcePath}/`;
      for (const [path, file] of context.files) {
        if (!path.startsWith(prefix) || file.mediaType !== "text/markdown") {
          continue;
        }
        const relative = path.slice(prefix.length);
        fileHrefs.set(
          path,
          path === row.preferredDocumentPath
            ? contextHref(slug)
            : contextHref(slug, relative),
        );
      }
    }

    for (const row of context.lessons) {
      const slug = basename(row.sourcePath);
      directoryHrefs.set(row.sourcePath, lessonHref(slug));
      this.addDocumentVariants(
        context,
        row.preferredDocumentPath,
        () => lessonHref(slug),
        fileHrefs,
      );
    }

    const views: ResolverViews = { fileHrefs, directoryHrefs };
    context.views = views;
    return views;
  }

  private addDocumentVariants(
    context: SnapshotContext,
    preferredDocumentPath: string | null,
    buildHref: () => string,
    fileHrefs: Map<string, string>,
  ): void {
    if (preferredDocumentPath === null) {
      return;
    }
    for (const candidate of languagePathCandidates(preferredDocumentPath)) {
      const file = context.files.get(candidate);
      if (!file || file.kind !== "text" || fileHrefs.has(candidate)) {
        continue;
      }
      // El idioma de la variante lo decide la cookie global al navegar; el
      // resolvedor añade el cambio de idioma solo si cruza idiomas.
      fileHrefs.set(candidate, buildHref());
    }
  }

  private textDocument(
    context: SnapshotContext,
    path: string,
  ): (CourseDocument & { kind: "text" }) | null {
    const file = context.files.get(path);
    const rawContent = context.rawContents.get(path);
    if (!file || file.kind !== "text" || rawContent === undefined) {
      return null;
    }
    return {
      kind: "text",
      path,
      blobSha: file.blobSha,
      mediaType: file.mediaType,
      language: file.language,
      languageEvidence: file.languageEvidence,
      rawContent,
    };
  }
}

/** Construye un lector; `null` degrada a `null`/`[]` sin conectar. */
export function createCourseReader<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PgDatabase<TQueryResult, TFullSchema> | null,
): CourseReader<TQueryResult, TFullSchema> {
  return new CourseReader(db);
}
