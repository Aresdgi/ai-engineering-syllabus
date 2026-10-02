import type { Metadata } from "next";
import { connection } from "next/server";
import { LessonsIndex } from "@/components/catalog/lessons-index";
import { SourceUnavailableState } from "@/components/source-unavailable-state";
import { getActiveSnapshot, listLessons } from "@/course";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

const TITLES: Record<UiLanguage, string> = {
  es: "Lecciones",
  en: "Lessons",
};

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const lang = await getUiLanguage();
  return { title: TITLES[lang] };
}

export default async function LessonsPage() {
  await connection();
  const lang = await getUiLanguage();
  const snapshot = await getActiveSnapshot();
  if (!snapshot) {
    return <SourceUnavailableState lang={lang} />;
  }
  const lessons = await listLessons(lang);
  return <LessonsIndex snapshot={snapshot} lessons={lessons} lang={lang} />;
}
