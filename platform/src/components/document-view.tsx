import type * as React from "react";

import type { CourseLanguage } from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";

export type DocumentViewProps = {
  title: string;
  /**
   * `"p"` cuando el documento renderizado ya aporta su propio `<h1>` (D-01):
   * evita el doble encabezado de máximo nivel y deja el título de unidad como
   * kicker visualmente subordinado. Por defecto `"h1"`.
   */
  titleAs?: "h1" | "p";
  /** Idioma de los textos de interfaz de esta vista; por defecto `"es"`. */
  lang?: UiLanguage;
  /**
   * Idioma real del documento mostrado (`null` = sin idioma). Si se omite, se
   * usa `fallbackLanguage` y, en su defecto, `lang` (compatibilidad con las
   * páginas que aún pasan el idioma del documento por `lang`).
   */
  documentLanguage?: CourseLanguage | null;
  /**
   * Idioma real del documento cuando no existe variante del idioma de
   * interfaz: el cuerpo usa ese idioma y se pinta encima la nota neutra
   * "Solo disponible en inglés/español" (o su equivalente en inglés).
   */
  fallbackLanguage?: CourseLanguage | null;
  kicker?: React.ReactNode;
  provenance: React.ReactNode;
  /**
   * Compatibilidad con la API por página de la ola anterior: el selector de
   * idioma es global (cabecera del shell) y este slot se ignora. Se mantiene
   * aceptado para no romper los consumidores actuales.
   */
  languageSelector?: React.ReactNode;
  aside?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
};

type DocumentViewMessages = {
  back: string;
  fallback: Record<CourseLanguage, string>;
};

const messages: Record<UiLanguage, DocumentViewMessages> = {
  es: {
    back: "Volver",
    fallback: {
      en: "Solo disponible en inglés",
      es: "Solo disponible en español",
    },
  },
  en: {
    back: "Back",
    fallback: {
      en: "Only available in English",
      es: "Only available in Spanish",
    },
  },
};

export function DocumentView({
  title,
  titleAs = "h1",
  lang = "es",
  documentLanguage,
  fallbackLanguage,
  kicker,
  provenance,
  aside,
  backHref,
  backLabel,
  children,
}: DocumentViewProps) {
  const t = messages[lang];
  const bodyLanguage =
    documentLanguage !== undefined
      ? documentLanguage
      : fallbackLanguage != null
        ? fallbackLanguage
        : lang;
  const fallbackNote =
    fallbackLanguage != null && fallbackLanguage !== lang
      ? t.fallback[fallbackLanguage]
      : null;

  const titleClass =
    titleAs === "p"
      ? "text-base font-medium tracking-tight text-muted-foreground sm:text-lg"
      : "text-2xl font-semibold tracking-tight text-balance sm:text-3xl";

  return (
    <div className="flex w-full flex-col gap-8">
      {backHref ? (
        <a
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 ease-out hover-fine:text-foreground"
        >
          <span aria-hidden="true">&larr;</span>
          {backLabel ?? t.back}
        </a>
      ) : null}
      <header className="flex flex-col gap-4">
        {kicker ? (
          <div className="text-sm text-muted-foreground">{kicker}</div>
        ) : null}
        {titleAs === "p" ? (
          <p className={titleClass}>{title}</p>
        ) : (
          <h1 className={titleClass}>{title}</h1>
        )}
        {provenance}
      </header>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
        <div
          className="min-w-0 max-w-[65ch] flex-1"
          lang={bodyLanguage ?? undefined}
        >
          {fallbackNote ? (
            <p className="mb-6 text-sm text-muted-foreground">{fallbackNote}</p>
          ) : null}
          {children}
        </div>
        {aside ? (
          <aside className="w-full lg:w-72 lg:shrink-0">{aside}</aside>
        ) : null}
      </div>
    </div>
  );
}
