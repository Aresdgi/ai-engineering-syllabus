import { DocumentView } from "@/components/document-view";
import { ProvenanceHeader } from "@/components/provenance-header";
import { SourceMarkdown } from "@/components/source-markdown";
import { githubBlobUrl } from "@/course/links";
import { lessonsIndexHref } from "@/course/routes";
import { extractDocumentTitle } from "@/course/title";
import type {
  CourseLanguage,
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

type LessonsDetailMessages = {
  kicker: string;
  back: string;
};

const MESSAGES: Record<UiLanguage, LessonsDetailMessages> = {
  es: { kicker: "Lección", back: "Volver a Lecciones" },
  en: { kicker: "Lesson", back: "Back to Lessons" },
};

export type LessonsDetailProps = {
  snapshot: CourseSnapshot;
  unit: CourseUnit;
  document: CourseTextDocument;
  /**
   * Idioma real del documento mostrado cuando no existe variante del idioma
   * global: el cuerpo usa ese idioma y se pinta la nota neutra de fallback.
   */
  fallbackLanguage?: CourseLanguage | null;
  /** Idioma global de la interfaz; por defecto `"es"`. */
  lang?: UiLanguage;
  resolver: MarkdownUrlResolver;
};

/**
 * Vista de detalle de una lección (AC-2.7, AC-2.11, AC-2.12): render fiel del
 * documento mostrado (frontmatter oculto por `SourceMarkdown`), variante
 * decidida por el idioma global (con nota neutra si solo existe la otra lengua)
 * y procedencia pinneada al commit del snapshot. El título de cabecera es el
 * H1 de la variante mostrada (H-5, D-06), como texto subordinado para no
 * duplicar el `<h1>` del documento (D-01).
 */
export function LessonsDetail({
  snapshot,
  unit,
  document,
  fallbackLanguage = null,
  lang = "es",
  resolver,
}: LessonsDetailProps) {
  const t = MESSAGES[lang];
  const documentTitle = extractDocumentTitle(document.rawContent);
  const title = documentTitle ?? unit.title;

  return (
    <DocumentView
      title={title}
      titleAs={documentTitle === null ? "h1" : "p"}
      lang={lang}
      documentLanguage={document.language}
      fallbackLanguage={fallbackLanguage}
      kicker={t.kicker}
      provenance={
        <ProvenanceHeader
          snapshot={snapshot}
          sourcePath={unit.sourcePath}
          documentPath={document.path}
          blobSha={document.blobSha}
          githubHref={githubBlobUrl(snapshot, document.path)}
          lang={lang}
        />
      }
      backHref={lessonsIndexHref()}
      backLabel={t.back}
    >
      <SourceMarkdown
        markdown={document.rawContent}
        resolveUrl={resolver}
        lang={lang}
      />
    </DocumentView>
  );
}
