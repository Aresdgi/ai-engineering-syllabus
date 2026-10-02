import type { UiLanguage } from "@/lib/i18n";
import type { CourseSnapshot } from "@/course/types";

export type ProvenanceHeaderProps = {
  snapshot: CourseSnapshot;
  /** Path de la unidad; también visible cuando no hay documento concreto. */
  sourcePath: string;
  /** `null` cuando la procedencia describe un directorio, no un documento. */
  documentPath: string | null;
  /** `null` cuando la procedencia describe un directorio, no un documento. */
  blobSha: string | null;
  githubHref: string;
  /** Idioma global para los copys neutros de interfaz. */
  lang?: UiLanguage;
  /**
   * Etiqueta del enlace cuando apunta a un espejo distinto del repo de origen
   * (p. ej. "espejo"); el repo mostrado como texto sigue siendo el de origen.
   */
  mirrorLabel?: string;
};

type ProvenanceCopy = {
  region: string;
  commitSr: string;
  documentSr: string;
  directorySr: string;
  view: string;
  details: string;
  source: string;
  document: string;
  branch: string;
  fullCommit: string;
  fullBlob: string;
  snapshot: string;
  importedAt: string;
  errors: (count: number) => string;
  newTabHint: string;
  mirror: string;
};

const COPY: Record<UiLanguage, ProvenanceCopy> = {
  es: {
    region: "Procedencia del contenido",
    commitSr: "Commit ",
    documentSr: "Documento ",
    directorySr: "Directorio ",
    view: "Ver en GitHub",
    details: "Detalles de procedencia",
    source: "Fuente",
    document: "Documento",
    branch: "Rama",
    fullCommit: "Commit completo",
    fullBlob: "Blob completo",
    snapshot: "Snapshot",
    importedAt: "Importado el",
    errors: (count) =>
      `La importación terminó con ${count} archivo(s) sin importar.`,
    newTabHint: " (se abre en una pestaña nueva)",
    mirror: "espejo",
  },
  en: {
    region: "Content provenance",
    commitSr: "Commit ",
    documentSr: "Document ",
    directorySr: "Directory ",
    view: "View on GitHub",
    details: "Provenance details",
    source: "Source",
    document: "Document",
    branch: "Branch",
    fullCommit: "Full commit",
    fullBlob: "Full blob",
    snapshot: "Snapshot",
    importedAt: "Imported on",
    errors: (count) =>
      `The import finished with ${count} file(s) not imported.`,
    newTabHint: " (opens in a new tab)",
    mirror: "mirror",
  },
};

const DATE_LOCALES: Record<UiLanguage, string> = {
  es: "es-ES",
  en: "en-US",
};

const importedAtFormatters: Record<UiLanguage, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat(DATE_LOCALES.es, { dateStyle: "long" }),
  en: new Intl.DateTimeFormat(DATE_LOCALES.en, { dateStyle: "long" }),
};

function formatImportedAt(value: string, lang: UiLanguage): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : importedAtFormatters[lang].format(date);
}

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

/** `true` si el href no pertenece al repo de origen del snapshot (espejo). */
function pointsToMirror(snapshot: CourseSnapshot, githubHref: string): boolean {
  const origin = snapshot.canonicalUrl.replace(/\/+$/, "");
  if (origin === "") {
    return false;
  }
  return githubHref !== origin && !githubHref.startsWith(`${origin}/`);
}

/**
 * Procedencia compacta (D-04): una línea siempre visible con repo, commit
 * corto, path del documento o del directorio y enlace a GitHub, más un
 * `<details>` con el detalle completo. Con `documentPath`/`blobSha` nulos
 * (H-1/H-3) describe el directorio de la unidad: muestra `sourcePath` y el
 * `githubHref` a `tree@commit`, sin fila de blob.
 *
 * El repo mostrado como texto es siempre el de ORIGEN del snapshot; si el
 * `githubHref` apunta a otro repo (espejo, ADR-018) el enlace se etiqueta
 * como espejo, con `mirrorLabel` como texto opcional del llamante.
 */
export function ProvenanceHeader({
  snapshot,
  sourcePath,
  documentPath,
  blobSha,
  githubHref,
  lang = "es",
  mirrorLabel,
}: ProvenanceHeaderProps) {
  const copy = COPY[lang];
  const path = documentPath ?? sourcePath;
  const linkLabel =
    mirrorLabel !== undefined || pointsToMirror(snapshot, githubHref)
      ? `${copy.view} (${mirrorLabel ?? copy.mirror})`
      : copy.view;

  return (
    <section
      aria-label={copy.region}
      className="rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground"
    >
      <div className="text-xs leading-relaxed">
        <span className="font-medium text-foreground">
          {snapshot.owner}/{snapshot.name}
        </span>{" "}
        <span className="whitespace-nowrap">
          <span className="sr-only">{copy.commitSr}</span>
          <code
            className="font-mono text-foreground/80"
            title={`Commit ${snapshot.commitSha}`}
          >
            {shortSha(snapshot.commitSha)}
          </code>
        </span>{" "}
        <span className="sr-only">
          {documentPath ? copy.documentSr : copy.directorySr}
        </span>
        <code
          className="font-mono text-foreground/80 [overflow-wrap:anywhere]"
          title={path}
        >
          {path}
        </code>{" "}
        <a
          href={githubHref}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap rounded-sm font-medium text-foreground underline decoration-muted-foreground transition-colors duration-150 ease-out hover-fine:decoration-foreground"
        >
          {linkLabel}
          <span className="sr-only">{copy.newTabHint}</span>
        </a>
      </div>
      <details className="mt-2 border-t border-border/70 pt-2">
        <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">
          {copy.details}
        </summary>
        <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5">
          <dt>{copy.source}</dt>
          <dd>
            <code className="font-mono [overflow-wrap:anywhere]">
              {sourcePath}
            </code>
          </dd>
          {documentPath ? (
            <>
              <dt>{copy.document}</dt>
              <dd>
                <code className="font-mono [overflow-wrap:anywhere]">
                  {documentPath}
                </code>
              </dd>
            </>
          ) : null}
          <dt>{copy.branch}</dt>
          <dd>
            <code className="font-mono [overflow-wrap:anywhere]">
              {snapshot.ref}
            </code>
          </dd>
          <dt>{copy.fullCommit}</dt>
          <dd>
            <code className="font-mono select-all [overflow-wrap:anywhere]">
              {snapshot.commitSha}
            </code>
          </dd>
          {blobSha ? (
            <>
              <dt>{copy.fullBlob}</dt>
              <dd>
                <code className="font-mono select-all [overflow-wrap:anywhere]">
                  {blobSha}
                </code>
              </dd>
            </>
          ) : null}
          <dt>{copy.snapshot}</dt>
          <dd>
            <code className="font-mono [overflow-wrap:anywhere]">
              {snapshot.snapshotId}
            </code>
          </dd>
          <dt>{copy.importedAt}</dt>
          <dd>{formatImportedAt(snapshot.importedAt, lang)}</dd>
        </dl>
      </details>
      {snapshot.status === "complete_with_errors" ? (
        <p className="mt-2 border-t border-border/70 pt-2 text-destructive">
          {copy.errors(snapshot.errorCount)}
        </p>
      ) : null}
    </section>
  );
}
