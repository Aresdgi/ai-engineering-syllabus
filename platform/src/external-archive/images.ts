/**
 * Imágenes del material archivado (plan §3.4):
 *
 * - Se extraen las referencias literales del Markdown: `![alt](url)` y, si las
 *   hubiera, `<img src="…">`. No hay resolución de rutas relativas: el corpus
 *   real solo usa URLs absolutas.
 * - Se descargan por URL (misma política de robots/lista negra) y se verifica
 *   el tipo por magic bytes, nunca por la cabecera `Content-Type` del servidor.
 * - Allowlist: solo raster `png`/`jpeg`/`gif`/`webp`, exactamente los tipos
 *   que sirve `/archive-assets/`; un `svg` se reconoce por firma y se rechaza
 *   como fallo de asset con motivo claro (O-01), porque la route no lo sirve.
 * - El asset se direcciona por `sha256` de los bytes.
 */

import { createHash } from "node:crypto";

import type { HttpClient } from "./http";
import { RobotsDeniedError, type RobotsGate } from "./robots";

export const ARCHIVE_ASSET_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type ArchiveAssetContentType =
  (typeof ARCHIVE_ASSET_CONTENT_TYPES)[number];

/** Tipos reconocidos por firma que `/archive-assets/` no sirve (O-01). */
export const NON_ARCHIVABLE_IMAGE_CONTENT_TYPES = ["image/svg+xml"] as const;

export type NonArchivableImageContentType =
  (typeof NON_ARCHIVABLE_IMAGE_CONTENT_TYPES)[number];

/** Cualquier tipo de imagen reconocido por firma (archivable o no). */
export type DetectedImageContentType =
  | ArchiveAssetContentType
  | NonArchivableImageContentType;

export function isArchiveAssetContentType(
  contentType: DetectedImageContentType,
): contentType is ArchiveAssetContentType {
  return (ARCHIVE_ASSET_CONTENT_TYPES as readonly string[]).includes(
    contentType,
  );
}

export type ImageReference = Readonly<{
  /** URL literal del Markdown/HTML. */
  originalUrl: string;
  alt: string | null;
  syntax: "markdown" | "html";
}>;

const MARKDOWN_IMAGE_PATTERN =
  /!\[([^\]]*)\]\(\s*(?:<([^>\s]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|<img\b[^>]*>/gi;

const HTML_SRC_PATTERN = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

const HTML_ALT_PATTERN = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function attributeValue(match: RegExpExecArray): string | null {
  for (let index = 1; index < match.length; index += 1) {
    const value = match[index];
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}

/** Referencias de imagen del Markdown literal, en orden de aparición. */
export function extractImageReferences(markdown: string): ImageReference[] {
  const references: ImageReference[] = [];
  MARKDOWN_IMAGE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_IMAGE_PATTERN.exec(markdown)) !== null) {
    const markdownUrl = match[2] ?? match[3];
    if (typeof markdownUrl === "string" && markdownUrl !== "") {
      references.push({
        originalUrl: markdownUrl,
        alt: match[1] ?? null,
        syntax: "markdown",
      });
      continue;
    }
    const htmlTag = match[0] ?? "";
    const src = HTML_SRC_PATTERN.exec(htmlTag);
    if (src === null) {
      continue;
    }
    const url = attributeValue(src);
    if (url === null || url === "") {
      continue;
    }
    const alt = HTML_ALT_PATTERN.exec(htmlTag);
    references.push({
      originalUrl: url,
      alt: alt === null ? null : attributeValue(alt),
      syntax: "html",
    });
  }
  return references;
}

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((value, index) => bytes[index] === value);
}

function startsWithAscii(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) {
    return false;
  }
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[index] !== text.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

/**
 * Tipo real de la imagen por magic bytes; `null` si no se reconoce.
 * Puede devolver tipos conocidos pero no archivables (`image/svg+xml`): el
 * downloader los rechaza con motivo explícito.
 */
export function detectImageContentType(
  bytes: Uint8Array,
): DetectedImageContentType | null {
  if (
    startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWithAscii(bytes, "GIF87a") || startsWithAscii(bytes, "GIF89a")) {
    return "image/gif";
  }
  if (
    startsWithAscii(bytes, "RIFF") &&
    bytes.length >= 12 &&
    String.fromCharCode(
      bytes[8] ?? 0,
      bytes[9] ?? 0,
      bytes[10] ?? 0,
      bytes[11] ?? 0,
    ) === "WEBP"
  ) {
    return "image/webp";
  }
  const head = new TextDecoder("latin1")
    .decode(bytes.slice(0, 4096))
    .trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) {
    return "image/svg+xml";
  }
  return null;
}

/** SHA-256 en hex de los bytes (direccionamiento por contenido). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export class UnsupportedImageError extends Error {
  constructor(
    readonly url: string,
    readonly detected: string | null,
  ) {
    super(
      detected === null
        ? `La imagen no tiene un tipo de la allowlist: ${url}`
        : `Tipo de imagen no permitido (${detected}); /archive-assets solo sirve png, jpeg, gif y webp: ${url}`,
    );
    this.name = "UnsupportedImageError";
  }
}

export type DownloadedImage = Readonly<{
  originalUrl: string;
  bytes: Uint8Array;
  contentType: ArchiveAssetContentType;
  sha256: string;
  byteSize: number;
}>;

export type ImageDownloaderOptions = Readonly<{
  robots?: RobotsGate;
  /** Límite defensivo; ninguna imagen real del corpus se acerca. */
  maxBytes?: number;
}>;

export class ImageDownloader {
  private readonly maxBytes: number;

  constructor(
    private readonly http: HttpClient,
    private readonly options: ImageDownloaderOptions = {},
  ) {
    this.maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  }

  async download(url: string): Promise<DownloadedImage> {
    const robots = this.options.robots;
    if (robots !== undefined) {
      const verdict = await robots.check(url);
      if (!verdict.allowed) {
        throw new RobotsDeniedError(url, verdict);
      }
    }
    const response = await this.http.get(url, {
      accept: "image/png,image/jpeg,image/gif,image/webp",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`La imagen respondió ${response.status}: ${url}`);
    }
    if (response.bytes.byteLength > this.maxBytes) {
      throw new Error(
        `La imagen supera el límite de ${this.maxBytes} bytes: ${url}`,
      );
    }
    const detected = detectImageContentType(response.bytes);
    if (detected === null || !isArchiveAssetContentType(detected)) {
      throw new UnsupportedImageError(url, detected);
    }
    return {
      originalUrl: url,
      bytes: response.bytes,
      contentType: detected,
      sha256: sha256Hex(response.bytes),
      byteSize: response.bytes.byteLength,
    };
  }
}
