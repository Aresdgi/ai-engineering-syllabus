/**
 * Errores tipados del lector de GitHub (M1-W2).
 *
 * Todo fallo del reader es un `SourceReaderError` con:
 * - `kind`: el tipo de error de importación del contrato (`types.ts`), para que
 *   la ingesta lo registre en `source_import_errors` sin traducciones frágiles;
 * - `detail`: payload JSON serializable con url/status/rate limit (nunca el
 *   token ni cabeceras de autenticación);
 * - `cause`: el error original cuando existe.
 *
 * Regla de seguridad: ningún mensaje de error incluye el valor de
 * `GITHUB_TOKEN`. Las cabeceras de la petición no se copian a los errores.
 */

import type { SourceImportErrorKind, SourceJsonValue } from "../types";

/** Estado del rate limit de la API de GitHub leído de las cabeceras. */
export type SourceRateLimitInfo = {
  limit: number | null;
  remaining: number | null;
  /** Instante ISO de reset (`x-ratelimit-reset`) o `null`. */
  resetAt: string | null;
};

/** Contexto HTTP/red de un fallo; se serializa en `detail`. */
export type SourceHttpErrorContext = {
  url?: string;
  status?: number | null;
  statusText?: string | null;
  rateLimit?: SourceRateLimitInfo | null;
  /** Mensaje devuelto por la API de GitHub, si lo hubo. */
  apiMessage?: string | null;
  /** Nota adicional (p. ej. descripción de un fallo de extracción). */
  note?: string | null;
  cause?: unknown;
};

export type SourceReaderErrorOptions = {
  kind: SourceImportErrorKind;
  message: string;
  detail?: SourceJsonValue | null;
  cause?: unknown;
};

/** Base de todos los errores del reader. */
export class SourceReaderError extends Error {
  readonly kind: SourceImportErrorKind;

  readonly detail: SourceJsonValue | null;

  constructor(options: SourceReaderErrorOptions) {
    super(
      options.message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = new.target.name;
    this.kind = options.kind;
    this.detail = options.detail ?? null;
  }
}

/** Configuración inválida (repo, fetch inyectable, base URLs). */
export class SourceReaderConfigError extends SourceReaderError {
  constructor(
    message: string,
    kind: SourceImportErrorKind = "repository-resolution-failed",
  ) {
    super({ kind, message });
  }
}

function describeNetworkOrStatus(context: SourceHttpErrorContext): string {
  if (
    context.status === null ||
    context.status === undefined ||
    context.status === 0
  ) {
    return "error de red";
  }
  const statusText = context.statusText?.trim();
  return statusText
    ? `HTTP ${context.status} ${statusText}`
    : `HTTP ${context.status}`;
}

function isRateLimited(context: SourceHttpErrorContext): boolean {
  if (context.rateLimit?.remaining !== 0) {
    return false;
  }
  return context.status === 403 || context.status === 429;
}

/** Mensaje legible y sin secretos a partir del contexto de fallo. */
export function describeHttpErrorContext(
  summary: string,
  context: SourceHttpErrorContext,
): string {
  const parts = [summary, describeNetworkOrStatus(context)];
  if (context.url) {
    parts.push(`en ${context.url}`);
  }
  if (isRateLimited(context)) {
    const resetAt = context.rateLimit?.resetAt ?? "desconocido";
    const limit = context.rateLimit?.limit ?? "desconocido";
    parts.push(
      `límite de peticiones de la API de GitHub agotado (rate limit): remaining=0, limit=${limit}, reset=${resetAt}`,
    );
  }
  if (context.apiMessage?.trim()) {
    parts.push(`respuesta de la API: ${context.apiMessage.trim()}`);
  }
  if (context.cause instanceof Error && context.cause.message.trim()) {
    parts.push(`detalle: ${context.cause.message.trim()}`);
  } else if (typeof context.cause === "string" && context.cause.trim()) {
    parts.push(`detalle: ${context.cause.trim()}`);
  }
  if (context.note?.trim()) {
    parts.push(context.note.trim());
  }
  return parts.join(" — ");
}

function httpDetail(context: SourceHttpErrorContext): SourceJsonValue {
  return {
    url: context.url ?? null,
    status: context.status ?? null,
    rateLimit: context.rateLimit
      ? {
          limit: context.rateLimit.limit,
          remaining: context.rateLimit.remaining,
          resetAt: context.rateLimit.resetAt,
        }
      : null,
    apiMessage: context.apiMessage ?? null,
    note: context.note ?? null,
  };
}

class SourceHttpError extends SourceReaderError {
  readonly url: string | null;

  readonly status: number | null;

  readonly rateLimit: SourceRateLimitInfo | null;

  constructor(
    kind: SourceImportErrorKind,
    summary: string,
    context: SourceHttpErrorContext,
  ) {
    super({
      kind,
      message: describeHttpErrorContext(summary, context),
      detail: httpDetail(context),
      cause: context.cause,
    });
    this.url = context.url ?? null;
    this.status = context.status ?? null;
    this.rateLimit = context.rateLimit ?? null;
  }
}

/** Fallo al resolver `GET /repos/{owner}/{repo}` (AC-1.1/1.2). */
export class RepositoryResolutionError extends SourceHttpError {
  readonly repository: string;

  constructor(repository: string, context: SourceHttpErrorContext = {}) {
    super(
      "repository-resolution-failed",
      `no se pudo resolver el repositorio fuente "${repository}"`,
      context,
    );
    this.repository = repository;
  }
}

/** Fallo al resolver `GET /repos/{owner}/{repo}/commits/{ref}` (AC-1.3). */
export class CommitResolutionError extends SourceHttpError {
  readonly ref: string;

  constructor(ref: string, context: SourceHttpErrorContext = {}) {
    super(
      "commit-resolution-failed",
      `no se pudo resolver el commit de "${ref}"`,
      context,
    );
    this.ref = ref;
  }
}

/** Fallo al leer/parsear `GET .../git/trees/{sha}?recursive=1` (AC-1.4). */
export class TreeReadError extends SourceHttpError {
  readonly commitSha: string;

  constructor(commitSha: string, context: SourceHttpErrorContext = {}) {
    super(
      "tree-read-failed",
      `no se pudo leer el árbol del commit ${commitSha}`,
      context,
    );
    this.commitSha = commitSha;
  }
}

/** Árbol truncado por la API: la ingesta no puede continuar en silencio. */
export class TreeTruncatedError extends SourceReaderError {
  readonly commitSha: string;

  readonly entryCount: number;

  constructor(commitSha: string, entryCount: number) {
    super({
      kind: "tree-truncated",
      message: `el árbol del commit ${commitSha} llegó truncado (truncated=true, ${entryCount} entradas recibidas); no se importa un árbol parcial`,
      detail: { commitSha, entryCount, truncated: true },
    });
    this.commitSha = commitSha;
    this.entryCount = entryCount;
  }
}

/** Fallo al descargar o extraer el tarball del commit. */
export class TarballReadError extends SourceHttpError {
  readonly commitSha: string;

  constructor(commitSha: string, context: SourceHttpErrorContext = {}) {
    super(
      "file-read-failed",
      `no se pudo leer el tarball del commit ${commitSha}`,
      context,
    );
    this.commitSha = commitSha;
  }
}

/** Fallo al entregar los bytes de un path concreto (AC-1.9/1.13). */
export class FileReadError extends SourceHttpError {
  readonly commitSha: string;

  readonly path: string;

  constructor(
    commitSha: string,
    path: string,
    context: SourceHttpErrorContext = {},
  ) {
    super(
      "file-read-failed",
      `no se pudieron leer los bytes de "${path}" en el commit ${commitSha}`,
      context,
    );
    this.commitSha = commitSha;
    this.path = path;
  }
}
