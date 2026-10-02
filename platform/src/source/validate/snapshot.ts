import { computeGitBlobSha } from "../fixtures";
import type {
  NewSourceImportError,
  SourceBlobSha,
  SourcePath,
  SourceTree,
} from "../types";
import type { SourceValidationContext } from "./paths";

/**
 * Un árbol truncado no permite una importación fiel: se devuelve el error a
 * registrar (AC-1.13) en lugar de lanzar; `null` si el árbol está completo.
 */
export function validateSourceTree(
  tree: SourceTree,
  context: SourceValidationContext,
): NewSourceImportError | null {
  if (!tree.truncated) {
    return null;
  }
  return {
    snapshotId: context.snapshotId,
    sourcePath: null,
    errorKind: "tree-truncated",
    message: `el árbol de ${tree.commitSha} llegó truncado; la importación fiel no puede completarse`,
    detail: { commitSha: tree.commitSha, entryCount: tree.entries.length },
  };
}

export type ExpectedSourceBlob = Readonly<{
  path: SourcePath;
  blobSha: SourceBlobSha;
}>;

/**
 * Verifica que los bytes descargados reproduzcan el `blobSha` del inventario
 * (usa `computeGitBlobSha` de `platform/src/source/fixtures/`).
 * Devuelve el error a registrar (AC-1.13) en lugar de lanzar.
 */
export function validateBlobContent(
  expected: ExpectedSourceBlob,
  content: Uint8Array,
  context: SourceValidationContext,
): NewSourceImportError | null {
  const computedBlobSha = computeGitBlobSha(content);
  if (computedBlobSha === expected.blobSha) {
    return null;
  }
  return {
    snapshotId: context.snapshotId,
    sourcePath: expected.path,
    errorKind: "file-hash-mismatch",
    message: `el contenido de "${expected.path}" no coincide con el blob del árbol (esperado ${expected.blobSha}, calculado ${computedBlobSha})`,
    detail: {
      expectedBlobSha: expected.blobSha,
      computedBlobSha,
    },
  };
}
