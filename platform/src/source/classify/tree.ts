import type {
  SourcePath,
  SourceTree,
  SourceTreeBlobEntry,
  SourceTreeEntry,
} from "../types";

/** Índice `path -> entrada` del inventario (para lookups O(1)). */
export function indexTreeEntries(
  tree: SourceTree,
): ReadonlyMap<SourcePath, SourceTreeEntry> {
  const index = new Map<SourcePath, SourceTreeEntry>();
  for (const entry of tree.entries) {
    index.set(entry.path, entry);
  }
  return index;
}

/** Índice `path -> blob` (ignora trees/submódulos). */
export function indexTreeBlobs(
  tree: SourceTree,
): ReadonlyMap<SourcePath, SourceTreeBlobEntry> {
  const index = new Map<SourcePath, SourceTreeBlobEntry>();
  for (const entry of tree.entries) {
    if (entry.type === "blob") {
      index.set(entry.path, entry);
    }
  }
  return index;
}

/** Set de paths de blobs del inventario. */
export function collectBlobPaths(tree: SourceTree): ReadonlySet<SourcePath> {
  return new Set(indexTreeBlobs(tree).keys());
}
