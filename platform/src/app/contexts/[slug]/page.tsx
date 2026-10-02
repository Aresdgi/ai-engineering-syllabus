import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContextsDetail } from "@/components/catalog/contexts-detail";
import { SourceUnavailableState } from "@/components/source-unavailable-state";
import {
  createMarkdownUrlResolver,
  getActiveSnapshot,
  getContext,
  getDocument,
  listContextDocuments,
  listUnitAssets,
  resolveDocumentVariant,
} from "@/course";
import { extractDocumentTitle } from "@/course/title";
import type {
  CourseFileEntry,
  CourseLanguage,
  CourseTextDocument,
  CourseUnit,
} from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

type ContextPageMessages = {
  neutralTitle: string;
};

const MESSAGES: Record<UiLanguage, ContextPageMessages> = {
  es: { neutralTitle: "Contexto" },
  en: { neutralTitle: "Context" },
};

function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type ContextSelection = {
  /** `true` cuando `?doc` no corresponde a un documento real de la unidad. */
  invalid: boolean;
  document: CourseTextDocument | null;
  /** Idioma real del documento cuando no hay variante del idioma global. */
  fallbackLanguage: CourseLanguage | null;
};

const NO_SELECTION: ContextSelection = {
  invalid: false,
  document: null,
  fallbackLanguage: null,
};

const INVALID_SELECTION: ContextSelection = {
  invalid: true,
  document: null,
  fallbackLanguage: null,
};

/**
 * Resuelve el documento mostrado del contexto con el idioma global: `?doc` es
 * la ruta relativa literal de cualquiera de las variantes del par e identifica
 * el par; la variante mostrada es siempre la del idioma global (o la existente
 * con nota de fallback). Sin `?doc` se usa el documento preferido de la unidad.
 * `?doc` fuera del snapshot o de los documentos reales del contexto → inválido.
 */
async function resolveContextSelection(
  unit: CourseUnit,
  documents: readonly CourseFileEntry[],
  requestedDocument: string | undefined,
  lang: CourseLanguage,
): Promise<ContextSelection> {
  let basePath: string;
  if (requestedDocument !== undefined) {
    basePath = `${unit.sourcePath}/${requestedDocument}`;
  } else if (unit.preferredDocumentPath !== null) {
    basePath = unit.preferredDocumentPath;
  } else {
    return NO_SELECTION;
  }

  const resolved = await resolveDocumentVariant(basePath, lang);
  if (resolved === null) {
    return INVALID_SELECTION;
  }
  if (!documents.some((document) => document.path === resolved.path)) {
    return INVALID_SELECTION;
  }

  const document = await getDocument(resolved.path);
  if (!document || document.kind !== "text") {
    return INVALID_SELECTION;
  }

  return {
    invalid: false,
    document,
    fallbackLanguage: resolved.isFallback ? resolved.language : null,
  };
}

export async function generateMetadata(
  props: PageProps<"/contexts/[slug]">,
): Promise<Metadata> {
  await connection();
  const lang = await getUiLanguage();
  const snapshot = await getActiveSnapshot();
  if (!snapshot) {
    return { title: MESSAGES[lang].neutralTitle };
  }
  const { slug } = await props.params;
  const unit = await getContext(slug, lang);
  if (!unit) {
    return { title: MESSAGES[lang].neutralTitle };
  }
  const searchParams = await props.searchParams;
  const documents = await listContextDocuments(unit, lang);
  const selection = await resolveContextSelection(
    unit,
    documents,
    firstSearchParam(searchParams.doc),
    lang,
  );
  const documentTitle =
    selection.document === null
      ? null
      : extractDocumentTitle(selection.document.rawContent);
  return {
    title:
      documentTitle === null ? unit.slug : `${documentTitle} · ${unit.slug}`,
  };
}

export default async function ContextPage(
  props: PageProps<"/contexts/[slug]">,
) {
  await connection();
  const lang = await getUiLanguage();
  const snapshot = await getActiveSnapshot();
  if (!snapshot) {
    return <SourceUnavailableState lang={lang} />;
  }

  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const unit = await getContext(slug, lang);
  if (!unit) {
    notFound();
  }

  const documents = await listContextDocuments(unit, lang);
  const selection = await resolveContextSelection(
    unit,
    documents,
    firstSearchParam(searchParams.doc),
    lang,
  );
  if (selection.invalid) {
    notFound();
  }

  let resolver: MarkdownUrlResolver | null = null;
  if (selection.document !== null) {
    resolver = await createMarkdownUrlResolver(selection.document.path);
  }

  const assets = await listUnitAssets(unit);

  return (
    <ContextsDetail
      snapshot={snapshot}
      unit={unit}
      documents={documents}
      assets={assets}
      selectedDocument={selection.document}
      fallbackLanguage={selection.fallbackLanguage}
      lang={lang}
      resolver={resolver}
    />
  );
}
