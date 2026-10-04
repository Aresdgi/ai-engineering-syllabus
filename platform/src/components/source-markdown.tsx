/* eslint-disable @next/next/no-img-element -- ADR-018: assets servidos por /source-files, sin next/image */

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { UiLanguage } from "@/lib/i18n";
import { markdownSanitizeSchema } from "@/lib/markdown/sanitize-schema";
import type { MarkdownUrl, MarkdownUrlResolver } from "@/lib/markdown/types";

type SourceMarkdownProps = {
  markdown: string;
  resolveUrl: MarkdownUrlResolver;
  variant?: "document" | "compact";
  /** Idioma global para los copys neutros de interfaz (ADR-018/idioma global). */
  lang?: UiLanguage;
};

type SourceMarkdownCopy = {
  newTabHint: string;
  brokenPrefix: string;
  brokenHint: string;
  /** Sufijo visible del enlace interno a una copia archivada (AC-2.5.4). */
  archiveSuffix: string;
  /** Etiqueta del respaldo Wayback de una herramienta (AC-2.5.5). */
  wayback: string;
  /** Nombre accesible neutro de un bloque de código desplazable (D-02). */
  codeBlock: string;
  /** Nombre accesible neutro de un ítem de lista de tareas (D-03). */
  taskItem: string;
};

const COPY: Record<UiLanguage, SourceMarkdownCopy> = {
  es: {
    newTabHint: " (se abre en una pestaña nueva)",
    brokenPrefix: "Enlace roto en el origen",
    brokenHint: " (enlace roto)",
    archiveSuffix: "(copia archivada)",
    wayback: "Respaldo en Wayback Machine",
    codeBlock: "Bloque de código",
    taskItem: "Elemento de tarea",
  },
  en: {
    newTabHint: " (opens in a new tab)",
    brokenPrefix: "Broken link in the source",
    brokenHint: " (broken link)",
    archiveSuffix: "(archived copy)",
    wayback: "Wayback Machine backup",
    codeBlock: "Code block",
    taskItem: "Task item",
  },
};

const INTERNAL_SOURCE_PREFIX = "/source-files/";

const DATE_LOCALES: Record<UiLanguage, string> = {
  es: "es-ES",
  en: "en-US",
};

const backupDateFormatters: Record<UiLanguage, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat(DATE_LOCALES.es, { dateStyle: "medium" }),
  en: new Intl.DateTimeFormat(DATE_LOCALES.en, { dateStyle: "medium" }),
};

function formatBackupDate(value: string, lang: UiLanguage): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : backupDateFormatters[lang].format(date);
}

const archiveSuffixClass =
  "ml-1 text-[0.7em] font-normal whitespace-nowrap text-muted-foreground";

const backupLinkClass =
  "ml-1 rounded-sm text-xs font-normal text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors duration-150 ease-out hover-fine:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const linkClass =
  "font-medium underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover-fine:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const brokenClass = "underline decoration-dotted underline-offset-4";

const brokenHintClass = "ml-1 text-xs font-normal";

function imageClass(compact: boolean): string {
  return compact
    ? "h-auto max-w-full rounded-md border border-border"
    : "my-5 h-auto max-w-full rounded-md border border-border";
}

function externalHint(lang: UiLanguage): ReactElement {
  return <span className="sr-only">{COPY[lang].newTabHint}</span>;
}

function BrokenText({
  rawHref,
  lang,
  children,
}: {
  rawHref: string;
  lang: UiLanguage;
  children: ReactNode;
}): ReactElement {
  const copy = COPY[lang];
  return (
    <span
      aria-disabled="true"
      className="cursor-not-allowed text-destructive"
      title={rawHref ? `${copy.brokenPrefix}: ${rawHref}` : copy.brokenPrefix}
    >
      <span className={brokenClass}>{children}</span>
      <span className={brokenHintClass}>{copy.brokenHint}</span>
    </span>
  );
}

function renderLink(
  resolved: MarkdownUrl,
  title: string | undefined,
  children: ReactNode,
  lang: UiLanguage,
): ReactElement {
  if (resolved.kind === "internal") {
    return (
      <Link href={resolved.href} title={title} className={linkClass}>
        {children}
      </Link>
    );
  }

  if (resolved.kind === "external-archive") {
    return (
      <Link href={resolved.href} title={title} className={linkClass}>
        {children}
        <span className={archiveSuffixClass}>{COPY[lang].archiveSuffix}</span>
      </Link>
    );
  }

  if (resolved.kind === "external") {
    const original = (
      <a
        href={resolved.href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {children}
        {externalHint(lang)}
      </a>
    );
    if (resolved.backup === undefined) {
      return original;
    }
    return (
      <>
        {original}{" "}
        <a
          href={resolved.backup.href}
          target="_blank"
          rel="noopener noreferrer"
          className={backupLinkClass}
        >
          {`${COPY[lang].wayback} (${formatBackupDate(
            resolved.backup.capturedAt,
            lang,
          )})`}
          {externalHint(lang)}
        </a>
      </>
    );
  }

  if (resolved.kind === "source") {
    const internal = resolved.href.startsWith(INTERNAL_SOURCE_PREFIX);
    return (
      <a
        href={resolved.href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {children}
        {internal ? null : externalHint(lang)}
      </a>
    );
  }

  if (resolved.kind === "archive-asset") {
    return (
      <a href={resolved.href} title={title} className={linkClass}>
        {children}
      </a>
    );
  }

  return (
    <BrokenText rawHref={resolved.rawHref} lang={lang}>
      {children}
    </BrokenText>
  );
}

function renderImage(
  resolved: MarkdownUrl,
  alt: string | undefined,
  title: string | undefined,
  width: string | number | undefined,
  height: string | number | undefined,
  compact: boolean,
  lang: UiLanguage,
): ReactElement {
  if (resolved.kind === "broken") {
    return (
      <BrokenText rawHref={resolved.rawHref} lang={lang}>
        {alt || resolved.rawHref}
      </BrokenText>
    );
  }

  return (
    <img
      src={resolved.href}
      alt={alt ?? ""}
      title={title}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={imageClass(compact)}
    />
  );
}

function headingClass(compact: boolean, documentClass: string): string {
  return compact ? "my-0 text-sm font-semibold text-balance" : documentClass;
}

function createComponents(
  resolveUrl: MarkdownUrlResolver,
  compact: boolean,
  lang: UiLanguage,
): Components {
  return {
    h1: ({ children }) => (
      <h1
        className={headingClass(
          compact,
          "mt-10 mb-4 scroll-mt-24 text-3xl font-semibold tracking-tight text-balance",
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={headingClass(
          compact,
          "mt-10 mb-3 scroll-mt-24 text-2xl font-semibold tracking-tight text-balance",
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={headingClass(
          compact,
          "mt-8 mb-3 scroll-mt-24 text-xl font-semibold text-balance",
        )}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className={headingClass(
          compact,
          "mt-6 mb-2 scroll-mt-24 text-lg font-semibold text-balance",
        )}
      >
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5
        className={headingClass(
          compact,
          "mt-6 mb-2 scroll-mt-24 text-base font-semibold",
        )}
      >
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6
        className={headingClass(
          compact,
          "mt-6 mb-2 scroll-mt-24 text-sm font-semibold",
        )}
      >
        {children}
      </h6>
    ),
    p: ({ children }) => (
      <p className={compact ? "my-0" : "my-4"}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul
        className={`${compact ? "my-0" : "my-4"} list-disc space-y-1.5 pl-6 marker:text-muted-foreground has-[input]:list-none has-[input]:pl-0`}
      >
        {children}
      </ul>
    ),
    ol: ({ children, start }) => (
      <ol
        start={start}
        className={`${compact ? "my-0" : "my-4"} list-decimal space-y-1.5 pl-6 marker:text-muted-foreground`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote
        className={`${compact ? "my-0" : "my-5"} border-l-2 border-border pl-4 text-muted-foreground [&_code]:text-foreground`}
      >
        {children}
      </blockquote>
    ),
    pre: ({ children }) => (
      <pre
        tabIndex={0}
        aria-label={COPY[lang].codeBlock}
        className={`${compact ? "my-0" : "my-5"} overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit`}
      >
        {children}
      </pre>
    ),
    code: ({ children }) => (
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.875em]">
        {children}
      </code>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    del: ({ children }) => (
      <del className="text-muted-foreground">{children}</del>
    ),
    a: ({ href, title, children }) => {
      if (typeof href !== "string" || href.length === 0) {
        return (
          <BrokenText rawHref="" lang={lang}>
            {children}
          </BrokenText>
        );
      }
      if (href.startsWith("#")) {
        return (
          <a href={href} title={title} className={linkClass}>
            {children}
          </a>
        );
      }
      return renderLink(resolveUrl(href), title, children, lang);
    },
    img: ({ src, alt, title, width, height }) => {
      if (typeof src !== "string" || src.length === 0) {
        return (
          <BrokenText rawHref="" lang={lang}>
            {alt ?? ""}
          </BrokenText>
        );
      }
      return renderImage(
        resolveUrl(src),
        alt,
        title,
        width,
        height,
        compact,
        lang,
      );
    },
    hr: () => (
      <hr className={compact ? "my-0 border-border" : "my-8 border-border"} />
    ),
    br: () => <br />,
    table: ({ children }) => (
      <div
        className={`${compact ? "my-0" : "my-5"} w-full overflow-x-auto rounded-lg border border-border [&_tr:last-child>*]:border-b-0`}
      >
        <table className="w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children, style }) => (
      <th
        style={style}
        className="border-b border-border px-3 py-2 font-medium"
      >
        {children}
      </th>
    ),
    td: ({ children, style }) => (
      <td style={style} className="border-b border-border px-3 py-2 align-top">
        {children}
      </td>
    ),
    details: ({ children }) => (
      <details
        className={`${compact ? "my-0" : "my-5"} rounded-lg border border-border bg-muted/30 px-4 py-3`}
      >
        {children}
      </details>
    ),
    summary: ({ children }) => (
      <summary className="cursor-pointer font-medium marker:text-muted-foreground">
        {children}
      </summary>
    ),
    input: ({ checked, disabled }) => (
      <input
        type="checkbox"
        aria-label={COPY[lang].taskItem}
        className="mr-2 size-4 translate-y-[0.5px] accent-foreground"
        defaultChecked={Boolean(checked)}
        disabled={Boolean(disabled)}
        readOnly
      />
    ),
  };
}

export function SourceMarkdown({
  markdown,
  resolveUrl,
  variant = "document",
  lang = "es",
}: SourceMarkdownProps): ReactElement {
  const compact = variant === "compact";
  return (
    <div
      className={
        compact
          ? "w-full break-words text-sm leading-relaxed text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          : "w-full max-w-[65ch] break-words text-base leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFrontmatter]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        components={createComponents(resolveUrl, compact, lang)}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
