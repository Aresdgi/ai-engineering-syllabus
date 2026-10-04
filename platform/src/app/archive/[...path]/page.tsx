import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DocumentView } from "@/components/document-view";
import { ExternalMaterialBanner } from "@/components/external-material-banner";
import { SourceMarkdown } from "@/components/source-markdown";
import {
  createExternalArchiveResolver,
  getArchivedItemByCanonicalUrl,
  parseArchiveTarget,
  resolveArchivedAlias,
  resolveArchivedVariant,
} from "@/course";
import { extractDocumentTitle } from "@/course/title";
import type { CourseLanguage, ExternalArchiveItem } from "@/course/types";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

/**
 * Vista interna del material externo archivado (AC-2.5.3/5/8/10 + §8).
 *
 * - Solo lee la base propia (EXTERNAL_ARCHIVE) por URL canónica; ninguna
 *   petición saliente en el render (AC-2.5.8). Los enlaces al original y a
 *   Wayback existen, pero solo se activan si el usuario los pulsa.
 * - Contenido literal (AC-2.5.10): el frontmatter se oculta y el HTML se
 *   sanea (ADR-014); no hay resúmenes, traducciones ni títulos generados.
 * - `captured`: banner de material externo + contenido literal.
 * - herramienta `captured` sin contenido (p. ej. el playground): estado de
 *   herramienta con el banner, la URL original y el respaldo Wayback marcado
 *   con su fecha si existe (T-02).
 * - `alias` (§8, decisión del usuario): banner del DESTINO + aviso persistente
 *   de sustitución con enlace a la URL retirada y a la copia del equivalente.
 * - `unavailable`/`error`: estado neutro «No hay copia archivada disponible»
 *   + URL original.
 */

type ArchiveMessages = {
  unavailableTitle: string;
  toolTitle: string;
  toolNoBackup: string;
  originalUrl: string;
  aliasRegion: string;
  aliasBefore: string;
  aliasTitlePrefix: string;
  aliasTitleSuffix: string;
  aliasAfter: string;
  retiredOriginal: string;
  destinationArchived: string;
  newTabHint: string;
};

const MESSAGES: Record<UiLanguage, ArchiveMessages> = {
  es: {
    unavailableTitle: "No hay copia archivada disponible",
    toolTitle: "Herramienta externa enlazada",
    toolNoBackup: "Sin respaldo archivado disponible",
    originalUrl: "URL original",
    aliasRegion: "Sustitución de lección retirada",
    aliasBefore:
      "La lección original ya no existe en 4Geeks y no tiene copia archivada. En su lugar se muestra la lección de 4Geeks ",
    aliasTitlePrefix: "«",
    aliasTitleSuffix: "»",
    aliasAfter: ", elegida por el usuario como equivalente.",
    retiredOriginal: "Ver la URL original retirada",
    destinationArchived: "Ver la copia archivada de la lección equivalente",
    newTabHint: " (se abre en una pestaña nueva)",
  },
  en: {
    unavailableTitle: "No archived copy available",
    toolTitle: "Linked external tool",
    toolNoBackup: "No archived backup available",
    originalUrl: "Original URL",
    aliasRegion: "Retired lesson substitution",
    aliasBefore:
      "The original lesson no longer exists on 4Geeks and has no archived copy. The 4Geeks lesson ",
    aliasTitlePrefix: "“",
    aliasTitleSuffix: "”",
    aliasAfter: ", chosen by the user as an equivalent, is shown instead.",
    retiredOriginal: "View the retired original URL",
    destinationArchived: "View the archived copy of the equivalent lesson",
    newTabHint: " (opens in a new tab)",
  },
};

const linkClass =
  "rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover-fine:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** URL canónica del target del catch-all (`https://<host>[/<path>]`). */
function canonicalUrlFor(target: { host: string; path: string }): string {
  return target.path === ""
    ? `https://${target.host}`
    : `https://${target.host}/${target.path}`;
}

/**
 * Título de la vista: literal siempre. Precede el título del item; si no lo
 * hay, el primer H1 del documento; si tampoco, la URL canónica (dato de la
 * fuente). Con H1 en el cuerpo se usa `titleAs: "p"` para no duplicar el
 * encabezado de máximo nivel (D-01).
 */
function literalTitle(
  item: ExternalArchiveItem,
  content: string,
): { title: string; titleAs: "h1" | "p" } {
  const documentTitle = extractDocumentTitle(content);
  return {
    title: item.title ?? documentTitle ?? item.canonicalUrl,
    titleAs: documentTitle !== null ? "p" : "h1",
  };
}

function unavailableMetadataTitle(lang: UiLanguage): string {
  return MESSAGES[lang].unavailableTitle;
}

export async function generateMetadata(
  props: PageProps<"/archive/[...path]">,
): Promise<Metadata> {
  await connection();
  const lang = await getUiLanguage();
  const target = parseArchiveTarget((await props.params).path);
  if (target === null) {
    return { title: unavailableMetadataTitle(lang) };
  }
  const item = await getArchivedItemByCanonicalUrl(canonicalUrlFor(target));
  if (item === null) {
    return { title: unavailableMetadataTitle(lang) };
  }
  if (item.status === "captured" || item.status === "alias") {
    const { item: shown } = await resolveArchivedVariant(item, lang);
    if (shown.content !== null) {
      return { title: literalTitle(shown, shown.content).title };
    }
    if (shown.title !== null) {
      return { title: shown.title };
    }
    return {
      title:
        shown.kind === "tool"
          ? MESSAGES[lang].toolTitle
          : unavailableMetadataTitle(lang),
    };
  }
  return { title: unavailableMetadataTitle(lang) };
}

function ArchiveUnavailableState({
  originalUrl,
  lang,
}: {
  originalUrl: string;
  lang: UiLanguage;
}) {
  const t = MESSAGES[lang];
  return (
    <div className="flex w-full max-w-[65ch] flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {t.unavailableTitle}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t.originalUrl}{" "}
        <a
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} [overflow-wrap:anywhere]`}
        >
          {originalUrl}
          <span className="sr-only">{t.newTabHint}</span>
        </a>
      </p>
    </div>
  );
}

/**
 * Estado de una herramienta `captured` sin copia de contenido (T-02): no hay
 * Markdown que renderizar, así que se muestra el banner de material externo
 * —con la URL original y el respaldo Wayback fechado si existe— y, cuando no
 * hay respaldo, el aviso neutro «Sin respaldo archivado disponible».
 */
function ArchivedToolView({
  item,
  lang,
}: {
  item: ExternalArchiveItem;
  lang: UiLanguage;
}) {
  const t = MESSAGES[lang];
  return (
    <div className="flex w-full max-w-[65ch] flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {item.title ?? t.toolTitle}
      </h1>
      <ExternalMaterialBanner
        originalUrl={item.originalUrl}
        capturedAt={item.capturedAt}
        method={item.method}
        contentSha256={item.contentSha256}
        waybackUrl={item.waybackUrl}
        waybackCapturedAt={item.waybackCapturedAt}
        lang={lang}
      />
      {item.waybackUrl === null ? (
        <p className="text-sm text-muted-foreground">{t.toolNoBackup}</p>
      ) : null}
    </div>
  );
}

function AliasSubstitutionNotice({
  destinationTitle,
  retiredOriginalUrl,
  destinationHref,
  lang,
}: {
  destinationTitle: string;
  retiredOriginalUrl: string;
  destinationHref: string;
  lang: UiLanguage;
}) {
  const t = MESSAGES[lang];
  return (
    <section
      role="note"
      aria-label={t.aliasRegion}
      className="mb-8 rounded-lg border border-border bg-muted/30 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground"
    >
      <p>
        {t.aliasBefore}
        <strong className="font-medium text-foreground">
          {t.aliasTitlePrefix}
          {destinationTitle}
          {t.aliasTitleSuffix}
        </strong>
        {t.aliasAfter}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a
          href={retiredOriginalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} [overflow-wrap:anywhere]`}
        >
          {t.retiredOriginal}
          <span className="sr-only">{t.newTabHint}</span>
        </a>
        <Link href={destinationHref} className={linkClass}>
          {t.destinationArchived}
        </Link>
      </p>
    </section>
  );
}

function ArchivedLessonView({
  item,
  content,
  lang,
  fallbackLanguage,
  alias,
}: {
  item: ExternalArchiveItem;
  content: string;
  lang: UiLanguage;
  fallbackLanguage: CourseLanguage | null;
  alias?: { retiredOriginalUrl: string; destinationHref: string };
}) {
  const resolver = createExternalArchiveResolver(item);
  const { title, titleAs } = literalTitle(item, content);

  return (
    <DocumentView
      title={title}
      titleAs={titleAs}
      lang={lang}
      documentLanguage={item.language}
      fallbackLanguage={fallbackLanguage}
      provenance={
        <ExternalMaterialBanner
          originalUrl={item.originalUrl}
          capturedAt={item.capturedAt}
          method={item.method}
          contentSha256={item.contentSha256}
          waybackUrl={item.waybackUrl}
          waybackCapturedAt={item.waybackCapturedAt}
          lang={lang}
        />
      }
    >
      {alias ? (
        <AliasSubstitutionNotice
          destinationTitle={title}
          retiredOriginalUrl={alias.retiredOriginalUrl}
          destinationHref={alias.destinationHref}
          lang={lang}
        />
      ) : null}
      <SourceMarkdown markdown={content} resolveUrl={resolver} lang={lang} />
    </DocumentView>
  );
}

export default async function ArchivePage(
  props: PageProps<"/archive/[...path]">,
) {
  await connection();
  const [lang, params] = await Promise.all([getUiLanguage(), props.params]);
  const target = parseArchiveTarget(params.path);
  if (target === null) {
    notFound();
  }
  const item = await getArchivedItemByCanonicalUrl(canonicalUrlFor(target));
  if (item === null) {
    notFound();
  }

  if (item.status === "captured" && item.content !== null) {
    const { item: shown, isFallback } = await resolveArchivedVariant(
      item,
      lang,
    );
    if (shown.content === null) {
      return (
        <ArchiveUnavailableState originalUrl={item.originalUrl} lang={lang} />
      );
    }
    return (
      <ArchivedLessonView
        item={shown}
        content={shown.content}
        lang={lang}
        fallbackLanguage={isFallback ? shown.language : null}
      />
    );
  }

  if (item.status === "alias") {
    const aliasTarget = await resolveArchivedAlias(item);
    if (aliasTarget === null) {
      return (
        <ArchiveUnavailableState originalUrl={item.originalUrl} lang={lang} />
      );
    }
    const { item: shown, isFallback } = await resolveArchivedVariant(
      item,
      lang,
    );
    if (
      shown.status !== "captured" ||
      shown.content === null ||
      shown.href === null
    ) {
      return (
        <ArchiveUnavailableState originalUrl={item.originalUrl} lang={lang} />
      );
    }
    return (
      <ArchivedLessonView
        item={shown}
        content={shown.content}
        lang={lang}
        fallbackLanguage={isFallback ? shown.language : null}
        alias={{
          retiredOriginalUrl: item.originalUrl,
          destinationHref: shown.href,
        }}
      />
    );
  }

  if (item.status === "captured" && item.kind === "tool") {
    return <ArchivedToolView item={item} lang={lang} />;
  }

  return <ArchiveUnavailableState originalUrl={item.originalUrl} lang={lang} />;
}
