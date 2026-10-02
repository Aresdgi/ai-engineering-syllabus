/**
 * `extractDocumentTitle`: primer H1 ATX del documento, ignorando el
 * frontmatter YAML (las lecciones lo llevan) y los bloques de código
 * cercados. El encabezado se convierte a texto plano (sin backticks,
 * énfasis ni enlaces) conservando sus palabras literales; `null` si el
 * documento no tiene H1.
 *
 * `markdownInlineToText` es la misma conversión pura usada para las
 * etiquetas del README de proyectos.
 */

const FRONTMATTER_DELIMITER = "---";

const ATX_H1_PATTERN = /^#\s+(.*)$/;

const FENCE_PATTERN = /^\s*(```|~~~)/;

function skipFrontmatter(lines: readonly string[]): number {
  if ((lines[0] ?? "").trim() !== FRONTMATTER_DELIMITER) {
    return 0;
  }
  for (let index = 1; index < lines.length; index += 1) {
    if ((lines[index] ?? "").trim() === FRONTMATTER_DELIMITER) {
      return index + 1;
    }
  }
  return 0;
}

function stripTrailingClosingHashes(heading: string): string {
  return heading.replace(/\s+#+\s*$/, "").trim();
}

/** Puntuación ASCII escapable con `\` según CommonMark. */
const BACKSLASH_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;

const IMAGE_LINK_PATTERN = /!\[([^\]]*)\]\([^)]*\)/g;

const INLINE_LINK_PATTERN = /\[([^\]]*)\]\([^)]*\)/g;

const REFERENCE_LINK_PATTERN = /\[([^\]]*)\]\[[^\]]*\]/g;

const CODE_SPAN_PATTERN = /`([^`]*)`/g;

const STRONG_STAR_PATTERN = /\*\*([^*]+)\*\*/g;

const STRONG_UNDERSCORE_PATTERN = /__([^_]+)__/g;

const STRIKETHROUGH_PATTERN = /~~([^~]+)~~/g;

const EMPHASIS_STAR_PATTERN = /\*([^*]+)\*/g;

const EMPHASIS_UNDERSCORE_PATTERN =
  /(?<![A-Za-z0-9_])_([^_]+)_(?![A-Za-z0-9_])/g;

const ESCAPE_PLACEHOLDER_PATTERN = /\u0000(\d+)\u0000/g;

/**
 * Convierte una etiqueta Markdown inline a texto plano: quita backticks de
 * código, énfasis, tachado, enlaces/imágenes (conserva su texto) y procesa
 * los escapes `\x`; no altera ninguna palabra ni interpreta bloques.
 */
export function markdownInlineToText(markdown: string): string {
  const escapes: string[] = [];
  const protectedText = markdown.replace(
    BACKSLASH_ESCAPE_PATTERN,
    (_match, escaped: string) => {
      escapes.push(escaped);
      return `\u0000${escapes.length - 1}\u0000`;
    },
  );
  const plain = protectedText
    .replace(IMAGE_LINK_PATTERN, "$1")
    .replace(INLINE_LINK_PATTERN, "$1")
    .replace(REFERENCE_LINK_PATTERN, "$1")
    .replace(CODE_SPAN_PATTERN, "$1")
    .replace(STRONG_STAR_PATTERN, "$1")
    .replace(STRONG_UNDERSCORE_PATTERN, "$1")
    .replace(STRIKETHROUGH_PATTERN, "$1")
    .replace(EMPHASIS_STAR_PATTERN, "$1")
    .replace(EMPHASIS_UNDERSCORE_PATTERN, "$1");
  return plain.replace(
    ESCAPE_PLACEHOLDER_PATTERN,
    (_match, index: string) => escapes[Number(index)] ?? "",
  );
}

export function extractDocumentTitle(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;

  for (let index = skipFrontmatter(lines); index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = ATX_H1_PATTERN.exec(line);
    if (match) {
      return markdownInlineToText(stripTrailingClosingHashes(match[1] ?? ""));
    }
  }
  return null;
}
