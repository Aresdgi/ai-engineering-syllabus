import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ProjectDocumentView } from "@/components/catalog/projects-document";
import { DocumentNav, type DocumentNavItem } from "@/components/document-nav";
import { SourceUnavailableState } from "@/components/source-unavailable-state";
import {
  createMarkdownUrlResolver,
  getActiveSnapshot,
  getDocument,
  getProject,
  getSubproject,
  githubBlobUrl,
  listSubprojects,
  resolveDocumentVariant,
} from "@/course";
import { projectHref, subprojectHref } from "@/course/routes";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

type SubprojectPageMessages = {
  fallbackTitle: string;
  backToProject: string;
  subprojects: string;
};

const messages: Record<UiLanguage, SubprojectPageMessages> = {
  es: {
    fallbackTitle: "Subproyecto",
    backToProject: "Volver al proyecto",
    subprojects: "Subproyectos",
  },
  en: {
    fallbackTitle: "Subproject",
    backToProject: "Back to project",
    subprojects: "Subprojects",
  },
};

type SubprojectPageProps = PageProps<"/projects/[slug]/[subslug]">;

export async function generateMetadata(
  props: SubprojectPageProps,
): Promise<Metadata> {
  const [params, lang] = await Promise.all([props.params, getUiLanguage()]);
  const unit = await getSubproject(params.slug, params.subslug, lang);
  return { title: unit?.title ?? messages[lang].fallbackTitle };
}

/**
 * Vista de un subproyecto derivado en lectura en el idioma global (cookie
 * `lang`): mismo contrato que la vista del proyecto padre. Un `?lang` heredado
 * se ignora (sin 404).
 */
export default async function SubprojectPage(props: SubprojectPageProps) {
  await connection();

  const [snapshot, lang, params] = await Promise.all([
    getActiveSnapshot(),
    getUiLanguage(),
    props.params,
  ]);
  if (!snapshot) {
    return <SourceUnavailableState lang={lang} />;
  }

  const parent = await getProject(params.slug, lang);
  if (!parent) {
    notFound();
  }

  const unit = await getSubproject(params.slug, params.subslug, lang);
  if (!unit || unit.preferredDocumentPath === null) {
    notFound();
  }

  const variant = await resolveDocumentVariant(
    unit.preferredDocumentPath,
    lang,
  );
  if (!variant) {
    notFound();
  }

  const document = await getDocument(variant.path);
  if (!document || document.kind !== "text") {
    notFound();
  }

  const t = messages[lang];
  const resolveUrl = await createMarkdownUrlResolver(document.path);
  const siblings = await listSubprojects(parent, lang);
  const siblingItems: DocumentNavItem[] = siblings.map((sibling) => ({
    href: subprojectHref(parent.slug, sibling.slug),
    label: sibling.title,
    current: sibling.slug === unit.slug,
  }));

  return (
    <ProjectDocumentView
      snapshot={snapshot}
      unit={unit}
      document={document}
      githubHref={githubBlobUrl(snapshot, document.path)}
      lang={lang}
      fallbackLanguage={variant.isFallback ? variant.language : null}
      aside={
        siblingItems.length > 1 ? (
          <DocumentNav label={t.subprojects} items={siblingItems} />
        ) : undefined
      }
      backHref={projectHref(parent.slug)}
      backLabel={t.backToProject}
      resolveUrl={resolveUrl}
    />
  );
}
