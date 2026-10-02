import type {
  NewSourceImportError,
  SourcePath,
  SourceSnapshotId,
} from "../types";

export type SourceValidationContext = Readonly<{
  snapshotId: SourceSnapshotId;
}>;

const WINDOWS_ABSOLUTE_PATTERN = /^[a-zA-Z]:/;

/** Motivo por el que un path no es un path posix relativo válido, o `null`. */
export function invalidSourcePathReason(path: SourcePath): string | null {
  if (path.trim() === "") {
    return "está vacío";
  }
  if (path.includes("\\")) {
    return "usa separadores de Windows; usa una ruta posix relativa";
  }
  if (path.startsWith("/") || WINDOWS_ABSOLUTE_PATTERN.test(path)) {
    return "es una ruta absoluta; debe ser relativa a la raíz del repo fuente";
  }
  const segments = path.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return "contiene segmentos vacíos, '.' o '..'";
  }
  return null;
}

/**
 * Valida que el path sea posix, relativo y sin `..`. Devuelve el error a
 * registrar (AC-1.13) en lugar de lanzar; `null` si es válido.
 */
export function validateSourcePath(
  path: SourcePath,
  context: SourceValidationContext,
): NewSourceImportError | null {
  const reason = invalidSourcePathReason(path);
  if (reason === null) {
    return null;
  }
  return {
    snapshotId: context.snapshotId,
    sourcePath: path.trim() === "" ? null : path,
    errorKind: "file-read-failed",
    message: `path inválido "${path}": ${reason}`,
    detail: null,
  };
}
