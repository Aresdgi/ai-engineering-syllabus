import type { UiLanguage } from "@/lib/i18n";

/**
 * Aviso persistente de material externo archivado (AC-2.5.3).
 *
 * Requisitos literales del plan M2B (`docs/milestones/M2B_AUDIT_PLAN.md` §5.4):
 * - Texto exacto: «Material externo archivado. No forma parte del repositorio.»
 *   (EN: «Archived external material. Not part of the repository.»).
 * - `role="note"`: no es un toast ni se puede descartar; permanece encima del
 *   contenido mientras se lee.
 * - URL original como enlace externo, fecha de captura en formato local del
 *   idioma, método literal y `sha256:` abreviado con el hash completo accesible.
 * - Respaldo Wayback solo si existe.
 *
 * Solo copys neutros de interfaz: ningún texto educativo se inventa.
 */

export type ExternalMaterialBannerProps = {
  /** URL original del material (la del corpus o la que resolvió la captura). */
  originalUrl: string;
  /** Fecha ISO-8601 de la captura. */
  capturedAt: string;
  /** Método literal de captura (`registry-api+github-raw`, `manual`, …). */
  method: string;
  /** SHA-256 del contenido literal; `null` si no aplica. */
  contentSha256?: string | null;
  /** Respaldo Wayback de una herramienta, si existe (AC-2.5.5). */
  waybackUrl?: string | null;
  waybackCapturedAt?: string | null;
  /** Idioma global para los copys neutros de interfaz. */
  lang?: UiLanguage;
};

type ExternalMaterialBannerCopy = {
  region: string;
  notice: string;
  originalUrl: string;
  capturedAt: string;
  method: string;
  hash: string;
  wayback: string;
  newTabHint: string;
};

const COPY: Record<UiLanguage, ExternalMaterialBannerCopy> = {
  es: {
    region: "Material externo archivado",
    notice: "Material externo archivado. No forma parte del repositorio.",
    originalUrl: "URL original",
    capturedAt: "Capturado el",
    method: "Método",
    hash: "Hash",
    wayback: "Respaldo en Wayback Machine",
    newTabHint: " (se abre en una pestaña nueva)",
  },
  en: {
    region: "Archived external material",
    notice: "Archived external material. Not part of the repository.",
    originalUrl: "Original URL",
    capturedAt: "Captured on",
    method: "Method",
    hash: "Hash",
    wayback: "Wayback Machine backup",
    newTabHint: " (opens in a new tab)",
  },
};

const DATE_LOCALES: Record<UiLanguage, string> = {
  es: "es-ES",
  en: "en-US",
};

const dateFormatters: Record<UiLanguage, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat(DATE_LOCALES.es, { dateStyle: "long" }),
  en: new Intl.DateTimeFormat(DATE_LOCALES.en, { dateStyle: "long" }),
};

function formatDate(value: string | null, lang: UiLanguage): string | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : dateFormatters[lang].format(date);
}

const SHORT_SHA_LENGTH = 12;

function shortSha256(sha256: string): string {
  return sha256.length > SHORT_SHA_LENGTH
    ? `${sha256.slice(0, SHORT_SHA_LENGTH)}…`
    : sha256;
}

const linkClass =
  "rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover-fine:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Bloque `role="note"` con el marcado literal exigido. Es un componente de
 * servidor puro (sin estado ni interacción): el aviso no se descarta.
 */
export function ExternalMaterialBanner({
  originalUrl,
  capturedAt,
  method,
  contentSha256 = null,
  waybackUrl = null,
  waybackCapturedAt = null,
  lang = "es",
}: ExternalMaterialBannerProps) {
  const copy = COPY[lang];
  const capturedLabel = formatDate(capturedAt, lang);
  const waybackLabel = formatDate(waybackCapturedAt, lang);

  return (
    <section
      role="note"
      aria-label={copy.region}
      className="rounded-lg border border-border bg-muted/30 px-4 py-3.5 text-sm leading-relaxed"
    >
      <p className="font-medium text-foreground text-balance">{copy.notice}</p>
      <dl className="mt-2.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dt>{copy.originalUrl}</dt>
        <dd className="min-w-0">
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} [overflow-wrap:anywhere]`}
          >
            {originalUrl}
            <span className="sr-only">{copy.newTabHint}</span>
          </a>
        </dd>
        <dt>{copy.capturedAt}</dt>
        <dd>{capturedLabel}</dd>
        <dt>{copy.method}</dt>
        <dd>
          <code className="font-mono [overflow-wrap:anywhere]">{method}</code>
        </dd>
        {contentSha256 ? (
          <>
            <dt>{copy.hash}</dt>
            <dd>
              <details className="inline-block max-w-full align-top">
                <summary
                  className="cursor-pointer font-mono marker:text-muted-foreground"
                  title={contentSha256}
                >
                  sha256:{shortSha256(contentSha256)}
                </summary>
                <code className="mt-1 block font-mono select-all text-foreground/80 [overflow-wrap:anywhere]">
                  {contentSha256}
                </code>
              </details>
            </dd>
          </>
        ) : null}
        {waybackUrl ? (
          <>
            <dt>{copy.wayback}</dt>
            <dd>
              <a
                href={waybackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} [overflow-wrap:anywhere]`}
              >
                {waybackLabel ?? waybackUrl}
                <span className="sr-only">{copy.newTabHint}</span>
              </a>
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
