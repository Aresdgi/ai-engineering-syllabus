import { ProvenanceHeader } from "@/components/provenance-header";
import { UnitList } from "@/components/unit-list";
import { githubTreeUrl } from "@/course/links";
import { lessonHref } from "@/course/routes";
import type { CourseSnapshot, CourseUnit } from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";

/**
 * Path raíz de lecciones en el repo fuente: constante del contrato de datos
 * (no es contenido educativo), usada para la procedencia del directorio (H-3).
 */
const LESSONS_DIRECTORY = "content/lessons";

type LessonsIndexMessages = {
  title: string;
  empty: string;
};

const MESSAGES: Record<UiLanguage, LessonsIndexMessages> = {
  es: {
    title: "Lecciones",
    empty: "Todavía no hay lecciones que mostrar.",
  },
  en: {
    title: "Lessons",
    empty: "No lessons to show yet.",
  },
};

export type LessonsIndexProps = {
  snapshot: CourseSnapshot;
  lessons: readonly CourseUnit[];
  /** Idioma global de la interfaz; por defecto `"es"`. */
  lang?: UiLanguage;
};

/**
 * Vista de lista de lecciones (AC-2.6): orden recibido del lector
 * (`source_path`) y títulos literales de la fuente en el idioma global. Por
 * coherencia con `/contexts` (D-02) cada fila muestra su slug literal como
 * línea secundaria. H-3: procedencia compacta del directorio raíz, pinneada al
 * commit.
 */
export function LessonsIndex({
  snapshot,
  lessons,
  lang = "es",
}: LessonsIndexProps) {
  const t = MESSAGES[lang];

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t.title}
        </h1>
        <ProvenanceHeader
          snapshot={snapshot}
          sourcePath={LESSONS_DIRECTORY}
          documentPath={null}
          blobSha={null}
          githubHref={githubTreeUrl(snapshot, LESSONS_DIRECTORY)}
          lang={lang}
        />
      </div>
      <UnitList
        emptyLabel={t.empty}
        sections={[
          {
            heading: null,
            items: lessons.map((unit) => ({
              href: lessonHref(unit.slug),
              title: unit.title,
              meta: unit.slug,
            })),
          },
        ]}
      />
    </section>
  );
}
