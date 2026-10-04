/**
 * Resolución de lecciones externas contra el registro público de assets de
 * BreatheCode (plan §3.3, opción B):
 *
 * 1. El slug sale del path de la URL de lección (`/lesson/<slug>`,
 *    `/es/lesson/<slug>`, `/en/lesson/<slug>`).
 * 2. `GET /v1/registry/asset/<slug>` devuelve título, idioma, ficheros
 *    (`url`/`readme_url`) y traducciones declaradas.
 * 3. Si la URL pide `/es/` y el asset del slug es inglés, se sigue la
 *    traducción ES declarada por el propio registro (p. ej.
 *    `https://4geeks.com/es/lesson/how-to-start-a-project` → fichero
 *    `how-to-start-a-project.es.md`). Así lo documenta el inventario real
 *    del plan §2.4; nunca se traduce nada por nuestra cuenta.
 *
 * `RegistryAsset` solo expone metadatos literales de la API; el contenido se
 * descarga de GitHub por separado (`github.ts`).
 */

import type { HttpClient } from "./http";
import { RobotsDeniedError, type RobotsGate } from "./robots";
import { lessonUrlLanguage } from "./urls";

export const REGISTRY_BASE_URL =
  "https://breathecode.herokuapp.com/v1/registry/asset/";

export type RegistryAsset = Readonly<{
  id: number;
  slug: string;
  title: string | null;
  /** Idioma declarado por la API (`us`, `es`, …); nunca inferido aquí. */
  lang: string | null;
  assetType: string | null;
  visibility: string | null;
  /** URL del fichero fuente en GitHub (`…/blob/<ref>/<path>`). */
  url: string | null;
  readmeUrl: string | null;
  translations: Readonly<Record<string, string>> | null;
  aliases: readonly string[];
  supersededBy: string | null;
}>;

export type LessonSource = Readonly<{
  slug: string;
  /** Asset efectivo (el del slug o su traducción ES declarada). */
  asset: RegistryAsset;
  /** Slug de la traducción seguida, si se siguió alguna. */
  followedTranslationSlug: string | null;
  language: "es" | "en" | null;
  /** URL `github.com/.../blob/...` del fichero declarado por la API. */
  fileUrl: string | null;
}>;

/** Slug de una URL de lección; `null` si el path no es `/…/lesson/<slug>`. */
export function parseLessonSlug(canonicalUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(canonicalUrl).pathname;
  } catch {
    return null;
  }
  const match = /^\/(?:es\/|en\/)?lesson\/([^/]+)\/?$/i.exec(pathname);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1] ?? "");
  } catch {
    return match[1] ?? null;
  }
}

export function registryAssetUrl(slug: string): string {
  return `${REGISTRY_BASE_URL}${encodeURIComponent(slug)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function translationsOrNull(
  value: unknown,
): Readonly<Record<string, string>> | null {
  if (!isRecord(value)) {
    return null;
  }
  const translations: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      translations[key] = entry;
    }
  }
  return translations;
}

/** Valida el subconjunto del JSON del registro que usa el archivo. */
export function parseRegistryAsset(payload: unknown): RegistryAsset | null {
  if (!isRecord(payload)) {
    return null;
  }
  const id = payload.id;
  const slug = payload.slug;
  if (typeof id !== "number" || typeof slug !== "string" || slug === "") {
    return null;
  }
  const aliases = Array.isArray(payload.aliases)
    ? payload.aliases.filter(
        (alias): alias is string => typeof alias === "string",
      )
    : [];
  return {
    id,
    slug,
    title: stringOrNull(payload.title),
    lang: stringOrNull(payload.lang),
    assetType: stringOrNull(payload.asset_type),
    visibility: stringOrNull(payload.visibility),
    url: stringOrNull(payload.url),
    readmeUrl: stringOrNull(payload.readme_url),
    translations: translationsOrNull(payload.translations),
    aliases,
    supersededBy: stringOrNull(payload.superseded_by),
  };
}

/** Idioma del asset según su `lang` literal (`us`⇒`en`), o su path `.es.md`. */
export function assetLanguage(asset: RegistryAsset): "es" | "en" | null {
  const lang = asset.lang?.toLowerCase() ?? null;
  if (lang === "es") {
    return "es";
  }
  if (lang === "us" || lang === "en") {
    return "en";
  }
  const file = asset.url ?? asset.readmeUrl;
  if (file !== null && /\.es\.md(?:[?#]|$)/i.test(file)) {
    return "es";
  }
  return null;
}

export type RegistryClientOptions = Readonly<{
  robots?: RobotsGate;
  baseUrl?: string;
}>;

export class RegistryClient {
  private readonly baseUrl: string;
  private readonly assets = new Map<string, Promise<RegistryAsset | null>>();

  constructor(
    private readonly http: HttpClient,
    private readonly options: RegistryClientOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? REGISTRY_BASE_URL;
  }

  /** Asset por slug (memoizado); `null` si el registro responde 404. */
  getAssetBySlug(slug: string): Promise<RegistryAsset | null> {
    const cached = this.assets.get(slug);
    if (cached !== undefined) {
      return cached;
    }
    const asset = this.fetchAssetBySlug(slug);
    this.assets.set(slug, asset);
    return asset;
  }

  private async fetchAssetBySlug(slug: string): Promise<RegistryAsset | null> {
    const url = `${this.baseUrl}${encodeURIComponent(slug)}`;
    await this.assertRobotsAllowed(url);
    const response = await this.http.get(url, {
      accept: "application/json",
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `El registro respondió ${response.status} para el slug "${slug}"`,
      );
    }
    let payload: unknown;
    try {
      payload = JSON.parse(response.text);
    } catch {
      throw new Error(`El registro devolvió JSON inválido para "${slug}"`);
    }
    const asset = parseRegistryAsset(payload);
    if (asset === null) {
      throw new Error(
        `El registro devolvió un asset con forma inesperada para "${slug}"`,
      );
    }
    return asset;
  }

  private async assertRobotsAllowed(url: string): Promise<void> {
    const robots = this.options.robots;
    if (robots === undefined) {
      return;
    }
    const verdict = await robots.check(url);
    if (!verdict.allowed) {
      throw new RobotsDeniedError(url, verdict);
    }
  }
}

/**
 * Resuelve la fuente de una URL de lección del corpus. Devuelve `null` si el
 * registro no conoce el slug (lección retirada): el CLI decide entonces si es
 * un alias del usuario o queda `unavailable`.
 */
export async function resolveLessonSource(
  client: RegistryClient,
  canonicalUrl: string,
): Promise<LessonSource | null> {
  const slug = parseLessonSlug(canonicalUrl);
  if (slug === null) {
    return null;
  }
  const asset = await client.getAssetBySlug(slug);
  if (asset === null) {
    return null;
  }

  let effective = asset;
  let followedTranslationSlug: string | null = null;
  if (
    lessonUrlLanguage(canonicalUrl) === "es" &&
    assetLanguage(asset) !== "es"
  ) {
    const translationSlug = asset.translations?.es;
    if (
      typeof translationSlug === "string" &&
      translationSlug !== "" &&
      translationSlug !== asset.slug
    ) {
      const translated = await client.getAssetBySlug(translationSlug);
      if (translated !== null) {
        effective = translated;
        followedTranslationSlug = translationSlug;
      }
    }
  }

  return {
    slug,
    asset: effective,
    followedTranslationSlug,
    language: assetLanguage(effective),
    fileUrl: effective.url ?? effective.readmeUrl,
  };
}
