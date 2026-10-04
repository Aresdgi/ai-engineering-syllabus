/**
 * Normalización y clasificación de URLs del archivo externo (Hito 2.5).
 *
 * Contrato congelado compartido con W2 (plan §6.3 + §8): `canonicalizeUrl` y
 * `classifyUrl` son funciones puras, sin red y sin base de datos. W2 las
 * importa desde `src/course/links.ts` para resolver enlaces del corpus.
 *
 * Reglas de canonicalización (plan §1.1/§2.1):
 * - Solo URLs absolutas `http(s)`; cualquier otra cosa devuelve `null`.
 * - Host en minúsculas (lo hace `URL`), sin puerto por defecto.
 * - Sin barra final en el path; sin fragmento `#` (no forma parte de la
 *   identidad del recurso archivado: W2 re-adjunta el ancla al renderizar).
 * - Se descarta la puntuación final que arrastran los enlaces incrustados en
 *   Markdown (backtick, `]`, `)`, comillas, `.`, `,`…), con paréntesis y
 *   corchetes equilibrados para no romper URLs legítimas que acaban en `)`.
 * - La query se conserva tal cual la serializa `URL`.
 *
 * Reglas de clasificación (plan §1.1/§2, hosts reales descubiertos):
 * - `lesson`: `4geeks.com`, `/lesson/`, `/es/lesson/`, `/en/lesson/`.
 * - `tool`: subdominios `diagram.`, `learn.`, `playground.` de `4geeks.com`.
 * - `marketing`: `4geeksacademy.com` (y subdominios) y el resto de
 *   `4geeks.com` (home, páginas no-lección).
 * - `out-of-scope`: `breathecode.herokuapp.com` (infra/API BreatheCode) y
 *   subdominios desconocidos de `4geeks.com` (fail-safe: nunca se archivan).
 * - `null`: el host no es de 4Geeks.
 */

export const EXTERNAL_URL_CLASSES = [
  "lesson",
  "tool",
  "marketing",
  "out-of-scope",
] as const;

export type ExternalUrlClass = (typeof EXTERNAL_URL_CLASSES)[number];

/** Clases que el CLI puede archivar en la base (`external_archive_items.kind`). */
export const ARCHIVABLE_URL_CLASSES = ["lesson", "tool"] as const;

export type ArchivableUrlClass = (typeof ARCHIVABLE_URL_CLASSES)[number];

export function isArchivableUrlClass(
  value: ExternalUrlClass,
): value is ArchivableUrlClass {
  return value === "lesson" || value === "tool";
}

/** Subdominios de `4geeks.com` clasificados como herramienta (plan §1.1). */
export const TOOL_HOST_LABELS: ReadonlySet<string> = new Set([
  "diagram",
  "learn",
  "playground",
]);

const FOUR_GEEKS_HOST = "4geeks.com";
const FOUR_GEEKS_ACADEMY_HOST = "4geeksacademy.com";
const BREATHECODE_HOST = "breathecode.herokuapp.com";

const LESSON_PATH_PATTERN = /^\/(?:es\/|en\/)?lesson(?:\/|$)/;

/**
 * Puntuación que puede quedar pegada al final de una URL incrustada en
 * Markdown o prosa. Los cierres `)`, `]` y `}` solo se eliminan si están
 * desequilibrados (p. ej. `…/docs](https://…/docs]` o `[texto](url)`).
 */
const TRAILING_NOISE = new Set(
  ["`", "'", '"', ".", ",", ";", ":", "!", "?", ">"].map((char) =>
    char.charCodeAt(0),
  ),
);

function countChar(value: string, char: string): number {
  let count = 0;
  for (const candidate of value) {
    if (candidate === char) {
      count += 1;
    }
  }
  return count;
}

function isUnbalancedTrailingCloser(value: string, closer: string): boolean {
  const opener = closer === ")" ? "(" : closer === "]" ? "[" : "{";
  return countChar(value, closer) > countChar(value, opener);
}

/** Recorta el ruido de puntuación pegado al final de la URL (nunca en medio). */
export function stripTrailingUrlNoise(raw: string): string {
  let candidate = raw.trim();
  while (candidate.length > 0) {
    const last = candidate[candidate.length - 1] ?? "";
    const code = candidate.charCodeAt(candidate.length - 1);
    if (TRAILING_NOISE.has(code)) {
      candidate = candidate.slice(0, -1);
      continue;
    }
    if (
      (last === ")" || last === "]" || last === "}") &&
      isUnbalancedTrailingCloser(candidate, last)
    ) {
      candidate = candidate.slice(0, -1);
      continue;
    }
    break;
  }
  return candidate;
}

/** Parsea una URL absoluta `http(s)` ya limpia; `null` si no lo es. */
function parseHttpUrl(value: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return parsed;
}

/**
 * URL canónica de un string crudo del corpus; `null` si no es una URL
 * absoluta `http(s)`.
 */
export function canonicalizeUrl(raw: string): string | null {
  const cleaned = stripTrailingUrlNoise(raw);
  const parsed = parseHttpUrl(cleaned);
  if (parsed === null) {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  const query = parsed.search;
  // Se serializa a mano para poder omitir la barra final del path vacío
  // (`URL#toString` siempre la añade). Las credenciales embebidas nunca
  // forman parte de la URL canónica (`host` excluye el userinfo).
  return `${parsed.protocol}//${parsed.host}${path}${query}`;
}

/** Host en minúsculas de una URL canónica; `null` si no es parseable. */
export function canonicalUrlHost(canonical: string): string | null {
  return parseHttpUrl(canonical)?.hostname.toLowerCase() ?? null;
}

function isLessonPath(pathname: string): boolean {
  return LESSON_PATH_PATTERN.test(pathname.toLowerCase());
}

/**
 * Clase de una URL canónica (plan §1.1). Devuelve `null` cuando el host no
 * pertenece a 4Geeks.
 */
export function classifyUrl(canonical: string): ExternalUrlClass | null {
  const parsed = parseHttpUrl(canonical);
  if (parsed === null) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === BREATHECODE_HOST) {
    return "out-of-scope";
  }
  if (
    host === FOUR_GEEKS_ACADEMY_HOST ||
    host.endsWith(`.${FOUR_GEEKS_ACADEMY_HOST}`)
  ) {
    return "marketing";
  }
  if (host === FOUR_GEEKS_HOST) {
    return isLessonPath(parsed.pathname) ? "lesson" : "marketing";
  }
  if (host.endsWith(`.${FOUR_GEEKS_HOST}`)) {
    const label = host.slice(0, -`.${FOUR_GEEKS_HOST}`.length);
    return TOOL_HOST_LABELS.has(label) ? "tool" : "out-of-scope";
  }
  return null;
}

/**
 * Lista negra operativa del CLI (plan §3.6): hosts/rutas que NUNCA se
 * peticionan, tampoco siguiendo redirects.
 * - `learn.4geeks.com`: `robots.txt` con `Disallow: /` para todos los crawlers.
 * - `4geeks.com/api/*`: `Disallow: /api/` explícito en `4geeks.com`.
 */
export function isBlockedUrl(canonical: string): boolean {
  const parsed = parseHttpUrl(canonical);
  if (parsed === null) {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "learn.4geeks.com") {
    return true;
  }
  if (host === FOUR_GEEKS_HOST) {
    const path = parsed.pathname.toLowerCase();
    return path === "/api" || path.startsWith("/api/");
  }
  return false;
}

/**
 * Idioma que declara la propia URL de lección (`/es/lesson/` → `es`; `/lesson/`
 * y `/en/lesson/` → `en`). `null` si no es una URL de lección. Es la regla que
 * §8 usa para mapear las variantes retiradas; nunca traduce contenido.
 */
export function lessonUrlLanguage(canonical: string): "es" | "en" | null {
  const parsed = parseHttpUrl(canonical);
  if (parsed === null || classifyUrl(canonical) !== "lesson") {
    return null;
  }
  return parsed.pathname.toLowerCase().startsWith("/es/") ? "es" : "en";
}
