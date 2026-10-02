import type {
  NewSourceContext,
  NewSourceLesson,
  NewSourceProject,
  SourceLanguageAssignment,
  SourcePath,
  SourceSnapshotId,
  SourceTree,
} from "../types";
import {
  comparePaths,
  resolvePreferredContextDocument,
  resolvePreferredLessonDocument,
  resolvePreferredProjectReadme,
  resolveSourceLanguage,
} from "./paths";
import { collectBlobPaths, indexTreeBlobs } from "./tree";

const NO_LANGUAGE: SourceLanguageAssignment = {
  language: null,
  languageEvidence: null,
};

function baseName(path: SourcePath): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function isDirectChild(path: SourcePath, directory: SourcePath): boolean {
  const prefix = `${directory}/`;
  return path.startsWith(prefix) && !path.slice(prefix.length).includes("/");
}

/**
 * Directorios de primer nivel bajo una raíz, derivados de los paths del
 * inventario (los directorios vacíos no existen en un tree de git). Devuelve
 * solo el directorio, no sus ancestros ni los archivos sueltos de la raíz.
 */
export function listFirstLevelDirectories(
  tree: SourceTree,
  root: SourcePath,
): readonly SourcePath[] {
  const prefix = `${root}/`;
  const directories = new Set<SourcePath>();
  for (const entry of tree.entries) {
    if (!entry.path.startsWith(prefix)) {
      continue;
    }
    const rest = entry.path.slice(prefix.length);
    const separator = rest.indexOf("/");
    if (separator === -1) {
      continue;
    }
    directories.add(`${prefix}${rest.slice(0, separator)}`);
  }
  return [...directories].sort(comparePaths);
}

/**
 * Índices mínimos de proyectos: una fila por carpeta de primer nivel bajo
 * `content/projects` (`84` en el corpus auditado). `title` y `canonicalOrder`
 * quedan en `null` (Hito 2); metadata solo con hechos del árbol.
 */
export function buildSourceProjects(
  tree: SourceTree,
  snapshotId: SourceSnapshotId,
): readonly NewSourceProject[] {
  const blobPaths = collectBlobPaths(tree);
  const blobs = indexTreeBlobs(tree);
  return listFirstLevelDirectories(tree, "content/projects").map(
    (directory) => {
      const preferredReadmePath = resolvePreferredProjectReadme(
        directory,
        blobPaths,
      );
      const preferredBlob = preferredReadmePath
        ? blobs.get(preferredReadmePath)
        : undefined;
      const learnJsonBlob = blobs.get(`${directory}/learn.json`);
      const language = preferredReadmePath
        ? resolveSourceLanguage(preferredReadmePath, blobPaths)
        : NO_LANGUAGE;
      return {
        snapshotId,
        sourcePath: directory,
        title: null,
        canonicalOrder: null,
        preferredReadmePath,
        metadata: {
          preferredReadmeBlobSha: preferredBlob?.blobSha ?? null,
          hasLearnJson: learnJsonBlob !== undefined,
          learnJsonBlobSha: learnJsonBlob?.blobSha ?? null,
        },
        ...language,
      };
    },
  );
}

/**
 * Índices mínimos de contextos: una fila por carpeta de primer nivel bajo
 * `content/contexts` (`22` en el corpus auditado). Metadata incluye todos los
 * documentos `CONTEXT-*` (recursivos) y los `README` directos como hechos.
 */
export function buildSourceContexts(
  tree: SourceTree,
  snapshotId: SourceSnapshotId,
): readonly NewSourceContext[] {
  const blobPaths = collectBlobPaths(tree);
  const blobs = indexTreeBlobs(tree);
  return listFirstLevelDirectories(tree, "content/contexts").map(
    (directory) => {
      const preferredReadmePath = resolvePreferredContextDocument(
        directory,
        blobPaths,
      );
      const preferredBlob = preferredReadmePath
        ? blobs.get(preferredReadmePath)
        : undefined;
      const language = preferredReadmePath
        ? resolveSourceLanguage(preferredReadmePath, blobPaths)
        : NO_LANGUAGE;
      const contextDocumentPaths = [...blobPaths]
        .filter(
          (path) =>
            path.startsWith(`${directory}/`) &&
            /^CONTEXT-.*\.md$/.test(baseName(path)),
        )
        .sort(comparePaths);
      const readmePaths = [...blobPaths]
        .filter(
          (path) =>
            isDirectChild(path, directory) &&
            /^README(\.[a-z]{2})?\.md$/.test(baseName(path)),
        )
        .sort(comparePaths);
      return {
        snapshotId,
        sourcePath: directory,
        title: null,
        preferredReadmePath,
        metadata: {
          preferredDocumentBlobSha: preferredBlob?.blobSha ?? null,
          contextDocumentPaths,
          readmePaths,
        },
        ...language,
      };
    },
  );
}

/**
 * Índices mínimos de lecciones: una fila por carpeta de primer nivel bajo
 * `content/lessons` (`5` en el corpus auditado). Las lecciones no usan
 * `README.md`: su documento es `<slug>.md` (o `.es.md`/`.en.md`).
 */
export function buildSourceLessons(
  tree: SourceTree,
  snapshotId: SourceSnapshotId,
): readonly NewSourceLesson[] {
  const blobPaths = collectBlobPaths(tree);
  const blobs = indexTreeBlobs(tree);
  return listFirstLevelDirectories(tree, "content/lessons").map((directory) => {
    const preferredReadmePath = resolvePreferredLessonDocument(
      directory,
      blobPaths,
    );
    const preferredBlob = preferredReadmePath
      ? blobs.get(preferredReadmePath)
      : undefined;
    const language = preferredReadmePath
      ? resolveSourceLanguage(preferredReadmePath, blobPaths)
      : NO_LANGUAGE;
    const documentPaths = [...blobPaths]
      .filter((path) => isDirectChild(path, directory) && path.endsWith(".md"))
      .sort(comparePaths);
    return {
      snapshotId,
      sourcePath: directory,
      title: null,
      preferredReadmePath,
      metadata: {
        preferredDocumentBlobSha: preferredBlob?.blobSha ?? null,
        documentPaths,
      },
      ...language,
    };
  });
}
