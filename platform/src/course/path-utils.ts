/**
 * Utilidades puras de paths posix y hrefs para la capa `course/`.
 *
 * Los paths del snapshot son posix relativos a la raíz del repo fuente; los
 * hrefs de Markdown pueden traer `./`, `../`, `%20`, query y hash. Aquí se
 * normalizan sin tocar la base ni inventar destinos: si un target sale de la
 * raíz del repo, la resolución devuelve `null` y el resolvedor lo marca roto.
 */

import path from "node:path";

export type HrefParts = {
  /** Parte de path, sin `?query` ni `#hash`. */
  path: string;
  /** Fragmento desde `#` inclusive; cadena vacía si no hay. */
  hash: string;
};

/** Separa query y hash del href, preservando el fragmento original. */
export function splitQueryAndHash(href: string): HrefParts {
  const hashIndex = href.indexOf("#");
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const pathPart =
    queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  return { path: pathPart, hash };
}

/** Decodifica `%20` y similares; si la secuencia es inválida, devuelve el texto tal cual. */
export function decodeHrefPath(pathPart: string): string {
  try {
    return decodeURIComponent(pathPart);
  } catch {
    return pathPart;
  }
}

/**
 * Resuelve un target relativo contra el path del documento que lo contiene.
 * - `./x`, `../y` se normalizan respecto al directorio de `fromPath`.
 * - `/x` se interpreta como path relativo a la raíz del repo (los `/x` que no
 *   existen se resolverán como roto; nunca se inventa destino).
 * - Devuelve `null` si el target escapa de la raíz del repo.
 */
export function resolveRepoPath(
  fromPath: string,
  targetPath: string,
): string | null {
  const isRepoAbsolute = targetPath.startsWith("/");
  const candidate = isRepoAbsolute
    ? targetPath.replace(/^\/+/, "")
    : path.posix.join(path.posix.dirname(fromPath), targetPath);
  const normalized = path.posix.normalize(candidate).replace(/\/+$/, "");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    return null;
  }
  return normalized;
}

/** Conjunto de directorios implícitos en una lista de paths de archivos. */
export function collectDirectories(paths: Iterable<string>): Set<string> {
  const directories = new Set<string>();
  for (const filePath of paths) {
    let directory = path.posix.dirname(filePath);
    while (directory !== "." && directory !== "/" && directory !== "") {
      if (directories.has(directory)) {
        break;
      }
      directories.add(directory);
      const parent = path.posix.dirname(directory);
      if (parent === directory) {
        break;
      }
      directory = parent;
    }
  }
  return directories;
}

/** Path relativo a un directorio; `null` si el archivo no está dentro. */
export function relativePathWithin(
  directory: string,
  filePath: string,
): string | null {
  const prefix = directory.endsWith("/") ? directory : `${directory}/`;
  if (!filePath.startsWith(prefix)) {
    return null;
  }
  const relative = filePath.slice(prefix.length);
  return relative === "" ? null : relative;
}

/** Último segmento de un path posix. */
export function basename(filePath: string): string {
  return path.posix.basename(filePath);
}

/** `true` si el path termina en `.md` (markdown, no otros `.md`-sufijos raros). */
export function isMarkdownPath(filePath: string): boolean {
  return /\.md$/i.test(filePath);
}
