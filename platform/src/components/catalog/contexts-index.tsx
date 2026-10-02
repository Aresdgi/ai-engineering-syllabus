import { ProvenanceHeader } from "@/components/provenance-header";
import { UnitList } from "@/components/unit-list";
import { githubTreeUrl } from "@/course/links";
import { contextHref } from "@/course/routes";
import type { CourseSnapshot, CourseUnit } from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";

/**
 * Path raíz de contextos en el repo fuente: constante del contrato de datos
 * (no es contenido educativo), usada para la procedencia del directorio (H-3).
 */
const CONTEXTS_DIRECTORY = "content/contexts";

type ContextsIndexMessages = {
  title: string;
  empty: string;
};

const MESSAGES: Record<UiLanguage, ContextsIndexMessages> = {
  es: {
    title: "Contextos",
    empty: "Todavía no hay contextos que mostrar.",
  },
  en: {
    title: "Contexts",
    empty: "No contexts to show yet.",
  },
};

export type ContextsIndexProps = {
  snapshot: CourseSnapshot;
  contexts: readonly CourseUnit[];
  /** Idioma global de la interfaz; por defecto `"es"`. */
  lang?: UiLanguage;
};

/**
 * Vista de lista de contextos (AC-2.4): orden recibido del lector
 * (`source_path`) y títulos literales de la fuente en el idioma global. D-02:
 * cada fila muestra además su slug literal para poder distinguir filas con
 * títulos repetidos. H-3: procedencia compacta del directorio raíz, pinneada
 * al commit.
 */
export function ContextsIndex({
  snapshot,
  contexts,
  lang = "es",
}: ContextsIndexProps) {
  const t = MESSAGES[lang];

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t.title}
        </h1>
        <ProvenanceHeader
          snapshot={snapshot}
          sourcePath={CONTEXTS_DIRECTORY}
          documentPath={null}
          blobSha={null}
          githubHref={githubTreeUrl(snapshot, CONTEXTS_DIRECTORY)}
          lang={lang}
        />
      </div>
      <UnitList
        emptyLabel={t.empty}
        sections={[
          {
            heading: null,
            items: contexts.map((unit) => ({
              href: contextHref(unit.slug),
              title: unit.title,
              meta: unit.slug,
            })),
          },
        ]}
      />
    </section>
  );
}
