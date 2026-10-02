/**
 * Errores de la orquestación de ingesta (M1-W4).
 *
 * `SourceIngestError` se usa para fallos de resolución previos a la creación
 * del snapshot (repo pedido distinto del servido por el reader), donde aún no
 * existe una fila en `source_import_errors` a la que asociar el fallo.
 */

import type { SourceImportErrorKind, SourceJsonValue } from "../types";

export type SourceIngestErrorOptions = {
  kind: SourceImportErrorKind;
  message: string;
  detail?: SourceJsonValue | null;
  cause?: unknown;
};

export class SourceIngestError extends Error {
  readonly kind: SourceImportErrorKind;

  readonly detail: SourceJsonValue | null;

  constructor(options: SourceIngestErrorOptions) {
    super(
      options.message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "SourceIngestError";
    this.kind = options.kind;
    this.detail = options.detail ?? null;
  }
}
