import type * as React from "react";

import { SourceMarkdown } from "@/components/source-markdown";
import { UnitList } from "@/components/unit-list";
import { projectHref } from "@/course/routes";
import type { CourseUnit, ProjectsIndex } from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import type { MarkdownUrlResolver } from "@/lib/markdown/types";

export type ProjectsIndexGroup = {
  /** Encabezado `##` literal del README; `null` para las unidades sin listar. */
  heading: string | null;
  units: CourseUnit[];
};

/**
 * Agrupa las unidades por el encabezado literal del README conservando el
 * orden recibido (que ya viene del orden del README con los no listados al
 * final). Los grupos aparecen en orden de primera aparición; las unidades sin
 * posición se agrupan al final bajo un encabezado neutro.
 */
export function groupProjectsIntoSections(
  units: readonly CourseUnit[],
): ProjectsIndexGroup[] {
  const groups: ProjectsIndexGroup[] = [];
  const groupsByHeading = new Map<string, ProjectsIndexGroup>();
  const unlisted: CourseUnit[] = [];

  for (const unit of units) {
    if (unit.order === null || unit.orderSection === null) {
      unlisted.push(unit);
      continue;
    }
    let group = groupsByHeading.get(unit.orderSection);
    if (!group) {
      group = { heading: unit.orderSection, units: [] };
      groupsByHeading.set(unit.orderSection, group);
      groups.push(group);
    }
    group.units.push(unit);
  }

  if (unlisted.length > 0) {
    groups.push({ heading: null, units: unlisted });
  }

  return groups;
}

type ProjectsIndexMessages = {
  /**
   * Encabezado neutro para las unidades sin posición declarada en el README.
   * No describe contenido educativo: solo informa de que el índice del
   * repositorio no les asigna una posición.
   */
  unlisted: string;
  empty: string;
};

const messages: Record<UiLanguage, ProjectsIndexMessages> = {
  es: {
    unlisted: "Sin posición en el índice del repositorio",
    empty: "No hay proyectos importados.",
  },
  en: {
    unlisted: "No position in the repository index",
    empty: "No projects imported.",
  },
};

export type ProjectsIndexViewProps = {
  index: ProjectsIndex;
  resolveUrl: MarkdownUrlResolver;
  /** Idioma de interfaz (cookie global); por defecto `"es"`. */
  lang?: UiLanguage;
};

/**
 * Lista de proyectos del snapshot activo: todas las filas de `source_projects`
 * (AC-2.1), agrupadas por los encabezados literales del README del idioma
 * global y con la descripción literal renderizada como Markdown compacto
 * (D-03). El número que se muestra es el marcador literal de lista ordenada
 * del README (F-02/D-14); los ítems sin marcador no reciben ningún número. Los
 * subproyectos derivados no se añaden como filas: la vista de su proyecto
 * padre los enlaza en el aside. Los href ya no llevan `?lang`: la variante la
 * decide la cookie global.
 */
export function ProjectsIndexView({
  index,
  resolveUrl,
  lang = "es",
}: ProjectsIndexViewProps): React.ReactElement {
  const t = messages[lang];
  const sections = groupProjectsIntoSections(index.units).map((group) => ({
    heading: group.heading ?? t.unlisted,
    items: group.units.map((unit) => ({
      href: projectHref(unit.slug),
      title: unit.title,
      marker: unit.listMarker,
      description: unit.description ? (
        <SourceMarkdown
          markdown={unit.description}
          resolveUrl={resolveUrl}
          variant="compact"
          lang={lang}
        />
      ) : undefined,
    })),
  }));

  return <UnitList sections={sections} emptyLabel={t.empty} />;
}
