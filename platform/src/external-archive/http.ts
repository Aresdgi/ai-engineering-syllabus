/**
 * Cliente HTTP del CLI de archivo externo (plan §3.6 y §5.2):
 *
 * - `User-Agent` identificable en todas las peticiones (sin tokens).
 * - Timeout por petición y reintentos con backoff exponencial ante `429`/`5xx`
 *   (Wayback devuelve 429 con facilidad) y errores de red.
 * - Redirects manuales: una redirección hacia un host/ruta de la lista negra
 *   (`learn.4geeks.com`, `4geeks.com/api/*`) NUNCA se sigue (AC/plan §3.6).
 * - La lista negra también bloquea la URL de partida antes de tocar la red.
 *
 * El `fetch` es inyectable para que los tests no hagan red.
 */

import { isBlockedUrl } from "./urls";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** UA identificable del archivo; no contiene credenciales ni datos personales. */
export const EXTERNAL_ARCHIVE_USER_AGENT =
  "ai-engineering-syllabus-external-archive/1.0 (+https://github.com/4GeeksAcademy/ai-engineering-syllabus; captura offline de material enlazado)";

export type HttpClientOptions = Readonly<{
  fetch?: FetchLike;
  userAgent?: string;
  timeoutMs?: number;
  /** Reintentos ADICIONALES ante 429/5xx o error de red. */
  retries?: number;
  baseDelayMs?: number;
  maxRedirects?: number;
  /** Inyectable en tests; por defecto `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}>;

export type HttpGetOptions = Readonly<{
  accept?: string;
  headers?: Readonly<Record<string, string>>;
}>;

export type HttpResponse = Readonly<{
  /** URL final (tras redirects seguros). */
  url: string;
  status: number;
  headers: Headers;
  bytes: Uint8Array;
  text: string;
}>;

/** Error de red/HTTP con la URL implicada (nunca incluye el cuerpo completo). */
export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status: number | null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "HttpRequestError";
  }
}

/** Se intentó peticionar (o seguir un redirect hacia) la lista negra. */
export class BlockedTargetError extends Error {
  constructor(readonly url: string) {
    super(`URL bloqueada por la lista negra del archivo externo: ${url}`);
    this.name = "BlockedTargetError";
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 507, 508, 509]);

function sleepWithTimer(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headerValue(headers: Headers, name: string): string | null {
  return headers.get(name);
}

/** Segundos de `Retry-After` (fecha HTTP o segundos), acotados a 60 s. */
export function parseRetryAfterMs(
  value: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.min(Number(trimmed) * 1000, 60_000);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.min(Math.max(date.getTime() - nowMs, 0), 60_000);
}

export class HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly baseDelayMs: number;
  private readonly maxRedirects: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.userAgent = options.userAgent ?? EXTERNAL_ARCHIVE_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxRedirects = options.maxRedirects ?? 5;
    this.sleep = options.sleep ?? sleepWithTimer;
  }

  /**
   * GET con timeout, redirects seguros y reintentos. Devuelve la respuesta
   * final (aunque sea 4xx/5xx tras agotar reintentos); lanza solo ante error
   * de red o lista negra.
   */
  async get(url: string, options: HttpGetOptions = {}): Promise<HttpResponse> {
    if (isBlockedUrl(url)) {
      throw new BlockedTargetError(url);
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) {
        await this.sleep(this.baseDelayMs * 2 ** (attempt - 1));
      }
      try {
        const response = await this.getFollowingSafeRedirects(url, options);
        if (RETRYABLE_STATUSES.has(response.status) && attempt < this.retries) {
          const retryAfter = parseRetryAfterMs(
            headerValue(response.headers, "retry-after"),
          );
          if (retryAfter !== null && retryAfter > 0) {
            await this.sleep(retryAfter);
          }
          continue;
        }
        return response;
      } catch (error) {
        if (error instanceof BlockedTargetError) {
          throw error;
        }
        lastError = error;
        if (attempt >= this.retries) {
          break;
        }
      }
    }

    throw new HttpRequestError(
      `No se pudo completar el GET tras ${this.retries + 1} intento(s)`,
      url,
      null,
      { cause: lastError },
    );
  }

  private async getFollowingSafeRedirects(
    url: string,
    options: HttpGetOptions,
  ): Promise<HttpResponse> {
    let currentUrl = url;
    for (let redirects = 0; ; redirects += 1) {
      if (isBlockedUrl(currentUrl)) {
        throw new BlockedTargetError(currentUrl);
      }
      const response = await this.requestOnce(currentUrl, options);
      const location = headerValue(response.headers, "location");
      if (
        response.status >= 300 &&
        response.status < 400 &&
        location !== null
      ) {
        if (redirects >= this.maxRedirects) {
          throw new HttpRequestError(
            `Demasiados redirects (${this.maxRedirects})`,
            currentUrl,
            response.status,
          );
        }
        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch (error) {
          throw new HttpRequestError(
            `Redirect con Location inválida: ${location}`,
            currentUrl,
            response.status,
            { cause: error },
          );
        }
        if (isBlockedUrl(nextUrl)) {
          throw new BlockedTargetError(nextUrl);
        }
        currentUrl = nextUrl;
        continue;
      }
      return { ...response, url: currentUrl };
    }
  }

  private async requestOnce(
    url: string,
    options: HttpGetOptions,
  ): Promise<Omit<HttpResponse, "url">> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "user-agent": this.userAgent,
        ...(options.accept !== undefined ? { accept: options.accept } : {}),
        ...options.headers,
      };
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers,
        signal: controller.signal,
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        headers: response.headers,
        bytes,
        text: new TextDecoder("utf-8").decode(bytes),
      };
    } catch (error) {
      throw new HttpRequestError(`Error de red en GET ${url}`, url, null, {
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
