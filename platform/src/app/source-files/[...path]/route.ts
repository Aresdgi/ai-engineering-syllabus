/**
 * `GET /source-files/<path>` — sirve los bytes de un archivo del snapshot
 * activo desde la propia app (ADR-018), sin depender de GitHub ni de
 * `raw.githubusercontent.com`.
 *
 * Seguridad:
 * - Se busca el path EXACTO en el snapshot activo; se rechazan segmentos
 *   vacíos, `.`, `..`, separadores (`/`, `\`) y bytes nulos, sin
 *   normalizaciones que permitan traversal.
 * - `Content-Type` nunca refleja tipos activos: solo imágenes raster y PDF
 *   conservan su tipo; el resto de texto se sirve como `text/plain` y los
 *   binarios no textuales como `application/octet-stream` + descarga.
 * - `nosniff` + CSP restrictiva; los errores no exponen trazas.
 *
 * Caché: la URL no está pinneada al snapshot, así que un `immutable` de un año
 * mentiría si otro snapshot cambia el blob de ese path. Se usa `max-age` corto
 * y `ETag` con el `blob_sha` (direccionamiento por contenido) para revalidar.
 */

import { getFileBytes } from "@/course";
import type { SourceFileBytes } from "@/course/types";

const RASTER_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const PDF_MEDIA_TYPE = "application/pdf";

const TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";

const BINARY_CONTENT_TYPE = "application/octet-stream";

const CACHE_CONTROL = "public, max-age=300, must-revalidate";

const SANDBOXED_CSP =
  "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";

/**
 * El visor nativo de PDF no carga dentro de un documento con `sandbox`
 * (bloquea plugins); se mantiene una política sin scripts ni objetos remotos
 * que sí permite verlo.
 */
const PDF_CSP =
  "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

type RouteParams = { params: Promise<{ path: string[] }> };

function isTextualMediaType(mediaType: string): boolean {
  const normalized = mediaType.toLowerCase();
  return (
    normalized.startsWith("text/") ||
    normalized === "image/svg+xml" ||
    normalized === "application/json" ||
    normalized === "application/sql" ||
    normalized === "application/xml" ||
    normalized === "application/x-ipynb+json" ||
    normalized.endsWith("+json") ||
    normalized.endsWith("+xml")
  );
}

/**
 * Une y decodifica los segmentos del catch-all y valida que formen un path
 * posix plano. Devuelve `null` si algo permite traversal o ambigüedad.
 */
function decodeSegments(
  segments: readonly string[] | undefined,
): string[] | null {
  if (!segments || segments.length === 0) {
    return null;
  }
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      value = segment;
    }
    if (
      value === "" ||
      value === "." ||
      value === ".." ||
      value.includes("/") ||
      value.includes("\\") ||
      value.includes("\0")
    ) {
      return null;
    }
    decoded.push(value);
  }
  const path = decoded.join("/");
  if (path.startsWith("/") || path.endsWith("/") || path.includes("//")) {
    return null;
  }
  return decoded;
}

function responseHeaders(file: SourceFileBytes): Headers {
  const mediaType = file.mediaType.toLowerCase();
  const headers = new Headers();
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("ETag", `"${file.blobSha}"`);
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set(
    "Content-Security-Policy",
    mediaType === PDF_MEDIA_TYPE ? PDF_CSP : SANDBOXED_CSP,
  );
  if (RASTER_IMAGE_MEDIA_TYPES.has(mediaType) || mediaType === PDF_MEDIA_TYPE) {
    headers.set("Content-Type", mediaType);
  } else if (isTextualMediaType(mediaType)) {
    headers.set("Content-Type", TEXT_CONTENT_TYPE);
  } else {
    headers.set("Content-Type", BINARY_CONTENT_TYPE);
    headers.set("Content-Disposition", "attachment");
  }
  return headers;
}

function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (header === null) {
    return false;
  }
  return header.split(",").some((candidate) => {
    const value = candidate.trim();
    if (value === "*") {
      return true;
    }
    const normalized = value.startsWith("W/") ? value.slice(2) : value;
    return normalized === etag;
  });
}

function bytesToBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function handle(
  request: Request,
  context: RouteParams,
  headOnly: boolean,
): Promise<Response> {
  const segments = decodeSegments((await context.params).path);
  if (segments === null) {
    return new Response(null, { status: 404 });
  }
  let file: SourceFileBytes | null;
  try {
    file = await getFileBytes(segments.join("/"));
  } catch {
    return new Response(null, { status: 500 });
  }
  if (file === null) {
    return new Response(null, { status: 404 });
  }
  const headers = responseHeaders(file);
  const etag = headers.get("ETag") ?? "";
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  if (headOnly) {
    return new Response(null, { status: 200, headers });
  }
  return new Response(bytesToBody(file.bytes), { status: 200, headers });
}

export async function GET(
  request: Request,
  context: RouteParams,
): Promise<Response> {
  return handle(request, context, false);
}

export async function HEAD(
  request: Request,
  context: RouteParams,
): Promise<Response> {
  return handle(request, context, true);
}
