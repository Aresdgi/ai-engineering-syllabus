import type { NewSourceFile, NewSourceImportError } from "../types";
import type { SourceValidationContext } from "./paths";

type SourceFileContentFields = Pick<
  NewSourceFile,
  "path" | "rawContent" | "binaryReference"
>;

/**
 * Valida el invariante SOURCE: exactamente uno de `rawContent` /
 * `binaryReference`. Devuelve el error a registrar (AC-1.13) en lugar de
 * lanzar; `null` si es válido.
 */
export function validateSourceFileContent(
  file: SourceFileContentFields,
  context: SourceValidationContext,
): NewSourceImportError | null {
  const hasRawContent = file.rawContent !== null;
  const hasBinaryReference = file.binaryReference !== null;
  if (hasRawContent !== hasBinaryReference) {
    return null;
  }
  return {
    snapshotId: context.snapshotId,
    sourcePath: file.path,
    errorKind: "file-decode-failed",
    message: hasRawContent
      ? "el archivo declara rawContent y binaryReference a la vez"
      : "el archivo no declara ni rawContent ni binaryReference",
    detail: null,
  };
}
