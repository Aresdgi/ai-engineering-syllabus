/**
 * Contratos de dominio de la capa `course/` (Hito 2 — navegador del syllabus).
 *
 * Solo tipos: sin I/O, sin base de datos y sin lógica. Este archivo es el
 * contrato congelado entre W0/W1/W2/W3 (ver `docs/milestones/M2_AUDIT_PLAN.md`
 * §6.3); cualquier cambio de firma se pacta antes con el coordinador.
 *
 * Regla de oro del Hito 2: ningún valor educativo se inventa. Todos los
 * títulos, descripciones, secciones, idiomas y órdenes salen del snapshot
 * SOURCE importado o de una derivación literal de él; si no hay snapshot,
 * las funciones devuelven `null`/`[]`.
 */

export type CourseLanguage = "es" | "en";

export type CourseLanguageEvidence = "suffix" | "pair-convention";

/** Snapshot activo: el último `complete`/`complete_with_errors` por `imported_at`. */
export type CourseSnapshot = {
  snapshotId: string;
  owner: string;
  name: string;
  canonicalUrl: string;
  ref: string;
  commitSha: string;
  importedAt: string; // ISO-8601
  status: "complete" | "complete_with_errors";
  errorCount: number;
};

export type CourseUnitKind = "project" | "subproject" | "context" | "lesson";

/**
 * Origen exacto del título de una unidad, en orden de precedencia:
 * etiqueta literal del README de proyectos > primer H1 del documento
 * preferido (sin frontmatter) > slug del path fuente.
 */
export type CourseTitleOrigin = "readme-label" | "document-h1" | "source-path";

export type CourseUnit = {
  kind: CourseUnitKind;
  /** Path posix en el repo fuente (`content/projects/<slug>`, …). */
  sourcePath: string;
  /** Último segmento del path. */
  slug: string;
  /** Solo subproyectos: slug del proyecto padre. */
  parentSlug: string | null;
  /** Literal de la fuente, nunca inventado. */
  title: string;
  titleOrigin: CourseTitleOrigin;
  /** Solo proyectos/subproyectos listados: descripción literal del README. */
  description: string | null;
  /** Posición de primera aparición en el README de proyectos; `null` si no listado. */
  order: number | null;
  /**
   * Número literal del ítem de lista ORDENADA del README de proyectos
   * (p. ej. `"0"`..`"70"`), tal cual aparece en el Markdown; `null` para
   * viñetas, enlaces sueltos y unidades no listadas.
   */
  listMarker: string | null;
  /** Encabezado `##` vigente en el README del idioma pedido; `null` si no listado. */
  orderSection: string | null;
  preferredDocumentPath: string | null;
  language: CourseLanguage | null;
  languageEvidence: CourseLanguageEvidence | null;
};

export type CourseTextDocument = {
  kind: "text";
  path: string;
  blobSha: string;
  mediaType: string;
  language: CourseLanguage | null;
  languageEvidence: CourseLanguageEvidence | null;
  rawContent: string;
};

export type CourseBinaryDocument = {
  kind: "binary";
  path: string;
  blobSha: string;
  mediaType: string;
  binaryReference: string;
};

export type CourseDocument = CourseTextDocument | CourseBinaryDocument;

export type LanguageVariant = {
  language: CourseLanguage;
  evidence: CourseLanguageEvidence;
  path: string;
  isPreferred: boolean;
};

export type CourseFileEntry = {
  /** Path completo en el repo fuente. */
  path: string;
  /** Path relativo al directorio de la unidad. */
  relativePath: string;
  mediaType: string;
  kind: "text" | "binary";
  /** Idioma ADR-012 del archivo elegido; `null` si el snapshot no lo declara. */
  language: CourseLanguage | null;
  /**
   * `true` cuando se pidió un idioma global y la variante devuelta es la otra
   * (no existe variante en el idioma pedido). Ausente en modo sin idioma.
   */
  isFallback?: boolean;
  href: string;
  hrefKind: "internal" | "source";
};

/**
 * Bytes de un archivo del snapshot activo, servidos por la propia app
 * (`GET /source-files/<path>`, ADR-018). Para texto son los bytes UTF-8 de
 * `raw_content`; para binarios, los de `source_blobs`.
 */
export type SourceFileBytes = {
  path: string;
  mediaType: string;
  blobSha: string;
  bytes: Uint8Array;
};

/** Resultado de elegir la variante de idioma de un documento (ADR-012). */
export type ResolvedDocumentVariant = {
  path: string;
  language: CourseLanguage | null;
  /** `true` si no existe la variante pedida y se devuelve otra real. */
  isFallback: boolean;
};

/** Índice de proyectos: README del idioma pedido + fuente del orden + unidades. */
export type ProjectsIndex = {
  readme: CourseTextDocument;
  orderSource: CourseTextDocument;
  units: CourseUnit[];
};

// --- Material externo archivado (Hito 2.5, plan §6.3 + §8) ------------------

/**
 * Estado de un item de EXTERNAL_ARCHIVE. `alias` es la decisión explícita del
 * usuario para las lecciones retiradas sin fuente: la fila no tiene copia
 * propia y apunta a la lección equivalente archivada.
 */
export type ExternalArchiveStatus =
  | "captured"
  | "unavailable"
  | "error"
  | "alias";

/**
 * Item del índice de archivo tal como lo consume el resolvedor de enlaces.
 * La clave del índice es `canonicalUrl`.
 */
export type ExternalArchiveLink = {
  id: string;
  canonicalUrl: string;
  kind: "lesson" | "tool";
  language: CourseLanguage | null;
  status: ExternalArchiveStatus;
  /** Ruta interna `/archive/<host>/<path…>` si hay copia propia (captured/alias). */
  href: string | null;
  waybackUrl: string | null;
  waybackCapturedAt: string | null;
  /** URL canónica de la lección destino cuando `status = "alias"`. */
  aliasOfCanonicalUrl: string | null;
};

/** Item completo de archivo (índice + contenido literal y procedencia). */
export type ExternalArchiveItem = ExternalArchiveLink & {
  originalUrl: string;
  host: string;
  /** Título literal de la fuente; nunca generado. */
  title: string | null;
  /** Markdown literal (solo lecciones con copia); nunca resumido/traducido. */
  content: string | null;
  contentSha256: string | null;
  sourceRepository: string | null;
  sourceCommit: string | null;
  sourcePath: string | null;
  capturedAt: string;
  method: string;
  httpStatus: number | null;
};
