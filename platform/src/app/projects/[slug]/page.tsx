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
  githubBlobUrl,
  listSubprojects,
  resolveDocumentVariant,
} from "@/course";
import { projectsIndexHref, subprojectHref } from "@/course/routes";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

type ProjectPageMessages = {
  fallbackTitle: string;
  backToProjects: string;
  subprojects: string;
};

const messages: Record<UiLanguage, ProjectPageMessages> = {
  es: {
    fallbackTitle: "Proyecto",
    backToProjects: "Volver a Proyectos",
    subprojects: "Subproyectos",
  },
  en: {
    fallbackTitle: "Project",
    backToProjects: "Back to Projects",
    subprojects: "Subprojects",
  },
};

type ProjectPageProps = PageProps<"/projects/[slug]">;

export async function generateMetadata(
  props: ProjectPageProps,
): Promise<Metadata> {
  const [params, lang] = await Promise.all([props.params, getUiLanguage()]);
  const unit = await getProject(params.slug, lang);
  return { title: unit?.title ?? messages[lang].fallbackTitle };
}

/**
 * Vista de un proyecto en el idioma global (cookie `lang`): título y documento
 * salen de la variante real de ese idioma; si no existe, se muestra la que
 * haya con la nota neutra de fallback. Un `?lang` heredado se ignora (sin 404).
 */
export default async function ProjectPage(props: ProjectPageProps) {
  await connection();

  const [snapshot, lang, params] = await Promise.all([
    getActiveSnapshot(),
    getUiLanguage(),
    props.params,
  ]);
  if (!snapshot) {
    return <SourceUnavailableState lang={lang} />;
  }

  const unit = await getProject(params.slug, lang);
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
  const subprojects = await listSubprojects(unit, lang);
  const subprojectItems: DocumentNavItem[] = subprojects.map((subproject) => ({
    href: subprojectHref(unit.slug, subproject.slug),
    label: subproject.title,
    current: false,
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
        subprojectItems.length > 0 ? (
          <DocumentNav label={t.subprojects} items={subprojectItems} />
        ) : undefined
      }
      backHref={projectsIndexHref()}
      backLabel={t.backToProjects}
      resolveUrl={resolveUrl}
    />
  );
}
