/**
 * `GET/HEAD /archive-assets/<sha256>` — sirve los bytes de una imagen del
 * material externo archivado (AC-2.5.8) desde la base propia, sin depender de
 * ningún host externo.
 *
 * Seguridad (mismo patrón que `/source-files/…`, ADR-018):
 * - `sha256` debe ser hex de 64 caracteres; cualquier otro valor → 404 sin
 *   consultar la base (no hay oracle de contenido).
 * - Solo se sirven tipos raster de la allowlist; el resto → 404 (los bytes de
 *   un tipo activo nunca se reflejan).
 * - `nosniff` + CSP `sandbox`; sin base configurada o con error de lectura la
 *   respuesta es un 503 neutro, sin cuerpo ni trazas.
 *
 * Caché: direccionamiento por contenido (el `sha256` es el propio ETag), así
 * que la respuesta es inmutable durante un año.
 */

import { getArchivedAsset } from "@/course";
import { getCourseDatabaseUrl } from "@/course/database";

const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

const CACHE_CONTROL = "public, max-age=31536000, immutable";

const SANDBOXED_CSP =
  "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";

type RouteParams = { params: Promise<{ sha256: string }> };

function mediaTypeOf(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
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
  if (getCourseDatabaseUrl() === null) {
    return new Response(null, { status: 503 });
  }
  const { sha256 } = await context.params;
  if (!SHA256_PATTERN.test(sha256)) {
    return new Response(null, { status: 404 });
  }
  const normalizedSha = sha256.toLowerCase();

  let asset: Awaited<ReturnType<typeof getArchivedAsset>>;
  try {
    asset = await getArchivedAsset(normalizedSha);
  } catch {
    return new Response(null, { status: 503 });
  }
  if (asset === null) {
    return new Response(null, { status: 404 });
  }
  const mediaType = mediaTypeOf(asset.contentType);
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("ETag", `"${normalizedSha}"`);
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set("Content-Security-Policy", SANDBOXED_CSP);
  headers.set("Content-Type", mediaType);

  const etag = headers.get("ETag") ?? "";
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  if (headOnly) {
    return new Response(null, { status: 200, headers });
  }
  return new Response(bytesToBody(asset.bytes), { status: 200, headers });
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
