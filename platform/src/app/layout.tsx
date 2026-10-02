import type { Metadata } from "next";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getUiLanguage } from "@/lib/i18n/server";
import { getUiTheme } from "@/lib/theme/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getUiLanguage();

  return {
    title: "AI Engineering Study Platform",
    description:
      lang === "en"
        ? "Study browser for the syllabus: projects, contexts and lessons imported from the source repository, with their provenance visible."
        : "Navegador de estudio del syllabus: proyectos, contextos y lecciones del repositorio fuente, con su procedencia visible.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [lang, theme] = await Promise.all([getUiLanguage(), getUiTheme()]);

  return (
    <html
      lang={lang}
      className={cn("antialiased", theme === "system" ? null : theme)}
    >
      <body>
        <AppShell lang={lang} theme={theme}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
