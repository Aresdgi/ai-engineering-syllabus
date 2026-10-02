import type { SourceMediaType, SourcePath } from "../types";

export type SourceMediaClassification = Readonly<{
  mediaType: SourceMediaType;
  isBinary: boolean;
}>;

/**
 * Regla de clasificación de medio (documentada, sin inferir contenido):
 * 1. Extensión empírica conocida como binaria -> su MIME, `isBinary: true`.
 * 2. Extensión empírica conocida como textual -> su MIME, salvo que los bytes
 *    recibidos contengan NUL (0x00), en cuyo caso -> `application/octet-stream`
 *    con `isBinary: true` (defensa contra un `.md` corrupto).
 * 3. Extensión desconocida o sin extensión -> `application/octet-stream` con
 *    `isBinary: true`, aunque los bytes no contengan NUL: solo se guarda
 *    `rawContent` de formatos textuales reconocidos (fidelidad UTF-8).
 */
const TEXT_MEDIA_TYPES: Readonly<Record<string, SourceMediaType>> = {
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  sql: "application/sql",
  txt: "text/plain",
  ts: "text/plain",
  py: "text/plain",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  ipynb: "application/x-ipynb+json",
  svg: "image/svg+xml",
  yaml: "application/yaml",
  yml: "application/yaml",
};

const BINARY_MEDIA_TYPES: Readonly<Record<string, SourceMediaType>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  pdf: "application/pdf",
};

const FALLBACK_MEDIA_TYPE: SourceMediaType = "application/octet-stream";

/** Extensión en minúsculas; `""` si no hay o es un dotfile (`.DS_Store`). */
export function sourceExtension(path: SourcePath): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

export function containsNullByte(bytes: Uint8Array): boolean {
  return bytes.includes(0);
}

export function classifySourceMedia(
  path: SourcePath,
  bytes?: Uint8Array,
): SourceMediaClassification {
  const extension = sourceExtension(path);

  const knownBinary = BINARY_MEDIA_TYPES[extension];
  if (knownBinary !== undefined) {
    return { mediaType: knownBinary, isBinary: true };
  }

  const knownText = TEXT_MEDIA_TYPES[extension];
  if (knownText !== undefined) {
    if (bytes !== undefined && containsNullByte(bytes)) {
      return { mediaType: FALLBACK_MEDIA_TYPE, isBinary: true };
    }
    return { mediaType: knownText, isBinary: false };
  }

  return { mediaType: FALLBACK_MEDIA_TYPE, isBinary: true };
}
