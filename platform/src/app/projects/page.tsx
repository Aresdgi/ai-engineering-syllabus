import type { Metadata } from "next";
import { connection } from "next/server";

import { ProjectsIndexView } from "@/components/catalog/projects-index";
import { DocumentView } from "@/components/document-view";
import { ProvenanceHeader } from "@/components/provenance-header";
import { SourceUnavailableState } from "@/components/source-unavailable-state";
import {
  createMarkdownUrlResolver,
  getActiveSnapshot,
  getProjectsIndex,
  githubBlobUrl,
  PROJECTS_DIRECTORY,
} from "@/course";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

type ProjectsIndexMessages = {
  title: string;
  orderFrom: string;
  orderFromSame: string;
};

const messages: Record<UiLanguage, ProjectsIndexMessages> = {
  es: {
    title: "Proyectos",
    orderFrom: "Orden de la lista obtenido de",
    orderFromSame: "Orden de la lista obtenido de este documento.",
  },
  en: {
    title: "Projects",
    orderFrom: "List order obtained from",
    orderFromSame: "List order obtained from this document.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getUiLanguage();
  return { title: messages[lang].title };
}

/**
 * Índice de proyectos con el idioma global (cookie `lang`): secciones,
 * etiquetas y descripciones salen del README de ese idioma; el orden, del
 * README del repositorio. La procedencia visible cubre el README mostrado y,
 * cuando son archivos distintos, enlaza también la fuente del orden. Un `?lang`
 * heredado en la URL se ignora (sin 404): la variante la decide la cookie.
 */
export default async function ProjectsPage(props: PageProps<"/projects">) {
  // L2: un `?lang` heredado se ignora a propósito (la variante la decide la
  // cookie global); Next sigue pasando los props de la ruta, pero no se leen.
  void props;
  await connection();

  const [snapshot, lang] = await Promise.all([
    getActiveSnapshot(),
    getUiLanguage(),
  ]);
  if (!snapshot) {
    return <SourceUnavailableState lang={lang} />;
  }

  const index = await getProjectsIndex(lang);
  if (!index) {
    return <SourceUnavailableState lang={lang} />;
  }

  const resolveUrl = await createMarkdownUrlResolver(index.readme.path);
  const t = messages[lang];
  const orderFromSameDocument = index.orderSource.path === index.readme.path;

  return (
    <DocumentView
      title={t.title}
      lang={lang}
      provenance={
        <div className="flex flex-col gap-2">
          <ProvenanceHeader
            snapshot={snapshot}
            sourcePath={PROJECTS_DIRECTORY}
            documentPath={index.readme.path}
            blobSha={index.readme.blobSha}
            githubHref={githubBlobUrl(snapshot, index.readme.path)}
            lang={lang}
          />
          <p className="text-xs text-muted-foreground">
            {orderFromSameDocument ? (
              t.orderFromSame
            ) : (
              <>
                {t.orderFrom}{" "}
                <a
                  href={githubBlobUrl(snapshot, index.orderSource.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm font-medium text-foreground underline decoration-muted-foreground transition-colors duration-150 ease-out hover-fine:decoration-foreground"
                >
                  <code className="font-mono [overflow-wrap:anywhere]">
                    {index.orderSource.path}
                  </code>
                </a>
              </>
            )}
          </p>
        </div>
      }
    >
      <ProjectsIndexView index={index} resolveUrl={resolveUrl} lang={lang} />
    </DocumentView>
  );
}
