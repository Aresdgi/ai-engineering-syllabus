/**
 * `parseProjectOrder`: derivación pura del orden de proyectos desde el README
 * real de `content/projects/README.md` (§2.3 del plan de auditoría M2).
 *
 * Reglas (sin interpretar contenido educativo):
 * - Se recorren las líneas en orden de documento, ignorando frontmatter y
 *   bloques de código cercados.
 * - Solo cuentan los enlaces Markdown cuyo target empieza por `./`
 *   (los `../contexts/...` son relaciones y se ignoran).
 * - `sourcePath` es el path del repo (`content/projects/<slug>`), `label` la
 *   etiqueta literal del enlace, `description` las líneas de continuación del
 *   mismo ítem de lista y `section` el encabezado `##` vigente.
 * - `position` es la posición de aparición (0..n-1); `isNested` distingue
 *   `./<padre>/<hijo>` (subproyectos) de `./<slug>`.
 * - `listMarker` es el número literal del ítem de lista ordenada (`0.`, `1)`,
 *   …) de la línea del enlace; `null` para viñetas, párrafos y no listados.
 * - La primera aparición gana: los enlaces repetidos no generan otra entrada.
 */

import {
  decodeHrefPath,
  resolveRepoPath,
  splitQueryAndHash,
} from "./path-utils";

export const PROJECTS_DIRECTORY = "content/projects";

export const PROJECTS_ORDER_PATH = `${PROJECTS_DIRECTORY}/README.md`;

export const PROJECTS_PREFERRED_README_PATH = `${PROJECTS_DIRECTORY}/README.es.md`;

export type ProjectOrderEntry = {
  /** Path del repo al que apunta el enlace (`content/projects/<slug>`). */
  sourcePath: string;
  /** Posición de aparición en el documento (0-based). */
  position: number;
  /** Etiqueta literal del enlace, sin decoración añadida. */
  label: string;
  /** Líneas literales de continuación del mismo ítem de lista; `null` si no hay. */
  description: string | null;
  /**
   * Número literal del ítem de lista ordenada de la línea del enlace
   * (`"0"`, `"17"`, …; se aceptan `N.` y `N)`); `null` para viñetas,
   * enlaces sueltos en párrafos y líneas no listadas.
   */
  listMarker: string | null;
  /** Encabezado `##` vigente; `""` antes del primer encabezado de nivel 2. */
  section: string;
  /** `true` para `./<padre>/<hijo>`. */
  isNested: boolean;
};

export type ProjectOrder = {
  entries: readonly ProjectOrderEntry[];
};

const SECTION_PATTERN = /^##(?!#)\s+(.*)$/;

const FENCE_PATTERN = /^\s*(```|~~~)/;

const LIST_ITEM_PATTERN = /^\s*(?:[-*+]|\d+[.)])\s/;

const ORDERED_LIST_ITEM_PATTERN = /^\s*(\d+)[.)]\s/;

const HEADING_PATTERN = /^#{1,6}\s/;

const HORIZONTAL_RULE_PATTERN = /^\s*---+\s*$/;

const LINK_PATTERN = /(!?)\[([^\]]*)\]\(([^()\s]+)(?:\s+["'][^"']*["'])?\)/g;

function stripTrailingClosingHashes(heading: string): string {
  return heading.replace(/\s+#+\s*$/, "").trim();
}

function sectionFromLine(line: string): string | null {
  const match = SECTION_PATTERN.exec(line);
  if (!match) {
    return null;
  }
  return stripTrailingClosingHashes(match[1] ?? "");
}

function collectDescription(
  lines: readonly string[],
  startIndex: number,
  linkLineIsListItem: boolean,
): string | null {
  const collected: string[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      break;
    }
    if (
      LIST_ITEM_PATTERN.test(line) ||
      HEADING_PATTERN.test(line) ||
      FENCE_PATTERN.test(line) ||
      HORIZONTAL_RULE_PATTERN.test(line)
    ) {
      break;
    }
    const isIndented = /^\s/.test(line);
    if (!linkLineIsListItem && !isIndented) {
      break;
    }
    collected.push(line.trim());
  }
  return collected.length > 0 ? collected.join("\n") : null;
}

/**
 * Parsea el orden de proyectos del README indicado. El llamante pasa el
 * README del idioma pedido para etiquetas/descripciones/secciones, o el README
 * canónico de orden; la función no sabe ni necesita saber de idiomas.
 */
export function parseProjectOrder(readmeMarkdown: string): ProjectOrder {
  const lines = readmeMarkdown.split(/\r?\n/);
  const entries: ProjectOrderEntry[] = [];
  const seenSourcePaths = new Set<string>();

  let index = 0;
  if ((lines[0] ?? "").trim() === "---") {
    const closing = lines.findIndex(
      (line, lineIndex) => lineIndex > 0 && line.trim() === "---",
    );
    if (closing > 0) {
      index = closing + 1;
    }
  }

  let inFence = false;
  let section = "";

  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const nextSection = sectionFromLine(line);
    if (nextSection !== null) {
      section = nextSection;
      continue;
    }

    const orderedListItem = ORDERED_LIST_ITEM_PATTERN.exec(line);
    const listMarker = orderedListItem?.[1] ?? null;

    LINK_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_PATTERN.exec(line)) !== null) {
      const isImage = match[1] === "!";
      if (isImage) {
        continue;
      }
      const target = match[3] ?? "";
      if (!target.startsWith("./")) {
        continue;
      }

      const { path: targetPathPart } = splitQueryAndHash(target);
      const decodedTarget = decodeHrefPath(targetPathPart);
      const sourcePath = resolveRepoPath(
        `${PROJECTS_DIRECTORY}/README.md`,
        decodedTarget,
      );
      if (
        sourcePath === null ||
        sourcePath === PROJECTS_DIRECTORY ||
        !sourcePath.startsWith(`${PROJECTS_DIRECTORY}/`)
      ) {
        continue;
      }
      if (seenSourcePaths.has(sourcePath)) {
        continue;
      }
      seenSourcePaths.add(sourcePath);

      const relativeSourcePath = sourcePath.slice(
        PROJECTS_DIRECTORY.length + 1,
      );
      const isNested = relativeSourcePath.split("/").length > 1;
      const linkLineIsListItem = LIST_ITEM_PATTERN.test(line);
      entries.push({
        sourcePath,
        position: entries.length,
        label: (match[2] ?? "").trim(),
        description: collectDescription(lines, index + 1, linkLineIsListItem),
        listMarker,
        section,
        isNested,
      });
    }
  }

  return { entries };
}

/** Primera entrada del orden que apunta a `sourcePath` o a un descendiente suyo. */
export function firstOrderEntryFor(
  entries: readonly ProjectOrderEntry[],
  sourcePath: string,
): ProjectOrderEntry | null {
  const prefix = `${sourcePath}/`;
  for (const entry of entries) {
    if (
      entry.sourcePath === sourcePath ||
      entry.sourcePath.startsWith(prefix)
    ) {
      return entry;
    }
  }
  return null;
}

/** Entrada del orden que apunta exactamente a `sourcePath`. */
export function exactOrderEntryFor(
  entries: readonly ProjectOrderEntry[],
  sourcePath: string,
): ProjectOrderEntry | null {
  for (const entry of entries) {
    if (entry.sourcePath === sourcePath) {
      return entry;
    }
  }
  return null;
}
