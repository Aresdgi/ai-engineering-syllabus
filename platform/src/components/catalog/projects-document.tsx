import type * as React from "react";

import { DocumentView } from "@/components/document-view";
import { ProvenanceHeader } from "@/components/provenance-header";
import { SourceMarkdown } from "@/components/source-markdown";
import { extractDocumentTitle } from "@/course/title";
import type {
  CourseLanguage,
  CourseSnapshot,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

export type ProjectDocumentViewProps = {
  snapshot: CourseSnapshot;
  unit: CourseUnit;
  document: CourseTextDocument;
  githubHref: string;
  /** Idioma de interfaz (cookie global); por defecto `"es"`. */
  lang?: UiLanguage;
  /**
   * Idioma real del documento cuando no existe variante del idioma global: el
   * cuerpo usa ese idioma y `DocumentView` pinta encima la nota neutra
   * "Solo disponible en …"/"Only available in …".
   */
  fallbackLanguage?: CourseLanguage | null;
  aside?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  resolveUrl: MarkdownUrlResolver;
};

/**
 * Vista de lectura compartida por `/projects/[slug]` y
 * `/projects/[slug]/[subslug]`: documento real de la unidad en el idioma
 * global (o la variante existente con nota de fallback), cabecera de
 * procedencia y aside opcional (subproyectos). El selector de idioma es global
 * (shell, L1): aquí no se renderiza ninguno por página. Presentación pura:
 * todos los datos llegan ya resueltos.
 */
export function ProjectDocumentView({
  snapshot,
  unit,
  document,
  githubHref,
  lang = "es",
  fallbackLanguage,
  aside,
  backHref,
  backLabel,
  resolveUrl,
}: ProjectDocumentViewProps): React.ReactElement {
  // D-01: si el documento renderizado ya trae su H1, el título de unidad pasa a
  // texto subordinado y el H1 del documento queda como único encabezado de
  // máximo nivel. D-05/D-06: el `lang` del cuerpo es el del documento mostrado.
  const hasDocumentTitle = extractDocumentTitle(document.rawContent) !== null;

  return (
    <DocumentView
      title={unit.title}
      titleAs={hasDocumentTitle ? "p" : "h1"}
      lang={lang}
      documentLanguage={
        fallbackLanguage == null ? document.language : undefined
      }
      fallbackLanguage={fallbackLanguage}
      provenance={
        <ProvenanceHeader
          snapshot={snapshot}
          sourcePath={unit.sourcePath}
          documentPath={document.path}
          blobSha={document.blobSha}
          githubHref={githubHref}
          lang={lang}
        />
      }
      aside={aside}
      backHref={backHref}
      backLabel={backLabel}
    >
      <SourceMarkdown
        markdown={document.rawContent}
        resolveUrl={resolveUrl}
        lang={lang}
      />
    </DocumentView>
  );
}
