import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LessonsDetail } from "@/components/catalog/lessons-detail";
import { SourceUnavailableState } from "@/components/source-unavailable-state";
import {
  createMarkdownUrlResolver,
  getActiveSnapshot,
  getDocument,
  getLesson,
  resolveDocumentVariant,
} from "@/course";
import { extractDocumentTitle } from "@/course/title";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

type LessonPageMessages = {
  neutralTitle: string;
};

const MESSAGES: Record<UiLanguage, LessonPageMessages> = {
  es: { neutralTitle: "Lección" },
  en: { neutralTitle: "Lesson" },
};

export async function generateMetadata(
  props: PageProps<"/lessons/[slug]">,
): Promise<Metadata> {
  await connection();
  const lang = await getUiLanguage();
  const snapshot = await getActiveSnapshot();
  if (!snapshot) {
    return { title: MESSAGES[lang].neutralTitle };
  }
  const { slug } = await props.params;
  const unit = await getLesson(slug, lang);
  if (!unit || unit.preferredDocumentPath === null) {
    return { title: unit?.title ?? MESSAGES[lang].neutralTitle };
  }

  const resolved = await resolveDocumentVariant(
    unit.preferredDocumentPath,
    lang,
  );
  if (resolved === null) {
    return { title: unit.title };
  }
  const document = await getDocument(resolved.path);
  const documentTitle =
    document && document.kind === "text"
      ? extractDocumentTitle(document.rawContent)
      : null;

  return { title: documentTitle ?? unit.title };
}

export default async function LessonPage(props: PageProps<"/lessons/[slug]">) {
  await connection();
  const lang = await getUiLanguage();
  const snapshot = await getActiveSnapshot();
  if (!snapshot) {
    return <SourceUnavailableState lang={lang} />;
  }

  const { slug } = await props.params;
  const unit = await getLesson(slug, lang);
  if (!unit || unit.preferredDocumentPath === null) {
    notFound();
  }

  const resolved = await resolveDocumentVariant(
    unit.preferredDocumentPath,
    lang,
  );
  if (resolved === null) {
    notFound();
  }

  const document = await getDocument(resolved.path);
  if (!document || document.kind !== "text") {
    notFound();
  }

  const resolver = await createMarkdownUrlResolver(document.path);

  return (
    <LessonsDetail
      snapshot={snapshot}
      unit={unit}
      document={document}
      fallbackLanguage={resolved.isFallback ? resolved.language : null}
      lang={lang}
      resolver={resolver}
    />
  );
}
