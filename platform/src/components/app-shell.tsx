import type * as React from "react";

import { LanguageSelector } from "@/components/language-selector";
import { NavLink } from "@/components/nav-link";
import { ThemeSelector } from "@/components/theme-selector";
import {
  contextsIndexHref,
  lessonsIndexHref,
  projectsIndexHref,
} from "@/course/routes";
import type { UiLanguage } from "@/lib/i18n";
import type { UiTheme } from "@/lib/theme";

type ShellMessages = {
  skip: string;
  navigation: string;
  projects: string;
  contexts: string;
  lessons: string;
  upcoming: readonly string[];
  upcomingTitle: string;
  upcomingNote: string;
  footer: string;
};

const messages: Record<UiLanguage, ShellMessages> = {
  es: {
    skip: "Saltar al contenido",
    navigation: "Principal",
    projects: "Proyectos",
    contexts: "Contextos",
    lessons: "Lecciones",
    upcoming: ["Buscar", "Tutor", "Progreso"],
    upcomingTitle: "Próximo hito",
    upcomingNote: "(próximo hito)",
    footer:
      "Contenido del repositorio fuente, con su procedencia en cada documento.",
  },
  en: {
    skip: "Skip to content",
    navigation: "Main",
    projects: "Projects",
    contexts: "Contexts",
    lessons: "Lessons",
    upcoming: ["Search", "Tutor", "Progress"],
    upcomingTitle: "Upcoming milestone",
    upcomingNote: "(upcoming milestone)",
    footer:
      "Content from the source repository, with its provenance on every document.",
  },
};

export type AppShellProps = {
  children: React.ReactNode;
  /** Idioma de interfaz (cookie global); por defecto `"es"`. */
  lang?: UiLanguage;
  /** Tema visual (cookie global); por defecto `"system"`. */
  theme?: UiTheme;
};

export function AppShell({
  children,
  lang = "es",
  theme = "system",
}: AppShellProps) {
  const t = messages[lang];

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
      >
        {t.skip}
      </a>
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:flex-nowrap sm:gap-x-6 sm:py-3">
          <a
            href={projectsIndexHref()}
            className="mr-auto shrink-0 text-sm leading-none font-semibold tracking-tight sm:leading-normal"
          >
            AI Engineering Study Platform
          </a>
          <nav
            aria-label={t.navigation}
            className="order-last w-full min-w-0 overflow-x-auto sm:order-none sm:w-auto sm:overflow-visible sm:py-0.5"
          >
            <ul className="flex flex-nowrap items-center gap-1">
              <li>
                <NavLink href={projectsIndexHref()} label={t.projects} />
              </li>
              <li>
                <NavLink href={contextsIndexHref()} label={t.contexts} />
              </li>
              <li>
                <NavLink href={lessonsIndexHref()} label={t.lessons} />
              </li>
              {t.upcoming.map((item) => (
                <li key={item} className="hidden lg:block">
                  <span
                    aria-disabled="true"
                    title={t.upcomingTitle}
                    className="inline-block cursor-not-allowed px-2.5 py-1 text-sm text-muted-foreground sm:py-1.5"
                  >
                    {item}
                    <span className="sr-only"> {t.upcomingNote}</span>
                  </span>
                </li>
              ))}
            </ul>
          </nav>
          <LanguageSelector lang={lang} />
          <ThemeSelector theme={theme} lang={lang} />
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:py-14"
      >
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          {t.footer}
        </div>
      </footer>
    </div>
  );
}
