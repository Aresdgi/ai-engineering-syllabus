import { DocumentNav, type DocumentNavItem } from "@/components/document-nav";
import { DocumentView } from "@/components/document-view";
import { ProvenanceHeader } from "@/components/provenance-header";
import { SourceMarkdown } from "@/components/source-markdown";
import { UnitList } from "@/components/unit-list";
import { githubBlobUrl, githubTreeUrl } from "@/course/links";
import { contextsIndexHref } from "@/course/routes";
import { extractDocumentTitle } from "@/course/title";
import type {
  CourseFileEntry,
  CourseLanguage,
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

type ContextsDetailMessages = {
  kicker: string;
  documents: string;
  files: string;
  selectDocument: string;
  emptyDocuments: string;
  back: string;
  newTabHint: string;
  fallback: Record<CourseLanguage, string>;
};

const MESSAGES: Record<UiLanguage, ContextsDetailMessages> = {
  es: {
    kicker: "Contexto",
    documents: "Documentos",
    files: "Archivos",
    selectDocument: "Selecciona un documento de la lista para leerlo aquí.",
    emptyDocuments: "Este contexto no tiene documentos en el snapshot activo.",
    back: "Volver a Contextos",
    newTabHint: " (se abre en una pestaña nueva)",
    fallback: {
      en: "Solo disponible en inglés",
      es: "Solo disponible en español",
    },
  },
  en: {
    kicker: "Context",
    documents: "Documents",
    files: "Files",
    selectDocument: "Select a document from the list to read it here.",
    emptyDocuments: "This context has no documents in the active snapshot.",
    back: "Back to Contexts",
    newTabHint: " (opens in a new tab)",
    fallback: {
      en: "Only available in English",
      es: "Only available in Spanish",
    },
  },
};

export type ContextsDetailProps = {
  snapshot: CourseSnapshot;
  unit: CourseUnit;
  documents: readonly CourseFileEntry[];
  assets: readonly CourseFileEntry[];
  /** Documento mostrado; `null` cuando el contexto no declara preferido. */
  selectedDocument: CourseTextDocument | null;
  /**
   * Idioma real del documento mostrado cuando no existe variante del idioma
   * global: el cuerpo usa ese idioma y se pinta la nota neutra de fallback.
   */
  fallbackLanguage?: CourseLanguage | null;
  /** Idioma global de la interfaz; por defecto `"es"`. */
  lang?: UiLanguage;
  resolver: MarkdownUrlResolver | null;
};

function fallbackHint(
  entry: CourseFileEntry,
  t: ContextsDetailMessages,
): string | undefined {
  return entry.isFallback === true && entry.language !== null
    ? t.fallback[entry.language]
    : undefined;
}

/**
 * Vista de detalle de un contexto (AC-2.5, AC-2.10, AC-2.11, AC-2.12). Con el
 * idioma global, el aside lista solo la variante del idioma de cada par (la
 * otra queda marcada como fallback); el documento mostrado lo resuelve la
 * página. Sin documento seleccionado no se elige ningún "principal": se listan
 * los documentos reales y se pide una selección, mostrando la procedencia del
 * directorio de la unidad (H-1). El título de cabecera es siempre el slug
 * literal de la unidad (identidad neutra de idioma); el documento mostrado
 * aporta el único `<h1>` y su `lang` (D-01, D-05).
 */
export function ContextsDetail({
  snapshot,
  unit,
  documents,
  assets,
  selectedDocument,
  fallbackLanguage = null,
  lang = "es",
  resolver,
}: ContextsDetailProps) {
  const t = MESSAGES[lang];

  const navItems: DocumentNavItem[] = documents.map((document) => ({
    href: document.href,
    label: document.relativePath,
    current:
      selectedDocument !== null && selectedDocument.path === document.path,
    hint: fallbackHint(document, t),
  }));

  const documentTitle =
    selectedDocument === null
      ? null
      : extractDocumentTitle(selectedDocument.rawContent);

  const hasAside = selectedDocument !== null || assets.length > 0;

  const aside = hasAside ? (
    <div className="flex flex-col gap-8">
      {selectedDocument ? (
        <DocumentNav label={t.documents} items={navItems} />
      ) : null}
      {assets.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">
            {t.files}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {assets.map((asset) => (
              <li key={asset.path}>
                <a
                  href={asset.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium break-all underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover-fine:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {asset.relativePath}
                  <span className="sr-only">{t.newTabHint}</span>
                </a>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {asset.mediaType}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  ) : undefined;

  return (
    <DocumentView
      title={unit.slug}
      titleAs={documentTitle === null ? "h1" : "p"}
      lang={lang}
      documentLanguage={selectedDocument?.language ?? null}
      fallbackLanguage={fallbackLanguage}
      kicker={t.kicker}
      provenance={
        selectedDocument ? (
          <ProvenanceHeader
            snapshot={snapshot}
            sourcePath={unit.sourcePath}
            documentPath={selectedDocument.path}
            blobSha={selectedDocument.blobSha}
            githubHref={githubBlobUrl(snapshot, selectedDocument.path)}
            lang={lang}
          />
        ) : (
          <ProvenanceHeader
            snapshot={snapshot}
            sourcePath={unit.sourcePath}
            documentPath={null}
            blobSha={null}
            githubHref={githubTreeUrl(snapshot, unit.sourcePath)}
            lang={lang}
          />
        )
      }
      aside={aside}
      backHref={contextsIndexHref()}
      backLabel={t.back}
    >
      {selectedDocument !== null && resolver !== null ? (
        <SourceMarkdown
          markdown={selectedDocument.rawContent}
          resolveUrl={resolver}
          lang={lang}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">{t.selectDocument}</p>
          <UnitList
            emptyLabel={t.emptyDocuments}
            sections={[
              {
                heading: null,
                items: documents.map((document) => ({
                  href: document.href,
                  title: document.relativePath,
                  description: fallbackHint(document, t),
                })),
              },
            ]}
          />
        </div>
      )}
    </DocumentView>
  );
}
