/**
 * Alias de lecciones retiradas decididos por el usuario (plan §8.3).
 *
 * El mapa es DATO versionado (`aliases.json`), no código: las URL retiradas
 * reales del inventario apuntan a la lección equivalente ya archivada. El CLI
 * valida que cada `to` exista en el inventario y quede `captured`; si no,
 * falla con un error claro. Los alias no copian bytes: la fila alias solo
 * guarda la referencia (`alias_of_canonical_url`).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { LinkInventory } from "./inventory";
import { canonicalizeUrl, classifyUrl } from "./urls";

export const EXTERNAL_ARCHIVE_ALIASES_PATH = fileURLToPath(
  new URL("./aliases.json", import.meta.url),
);

export type ExternalArchiveAlias = Readonly<{
  from: string;
  to: string;
}>;

export type ExternalArchiveAliasDecision = Readonly<{
  decidedBy: string;
  decidedAt: string;
  reason: string;
  aliases: readonly ExternalArchiveAlias[];
}>;

export class AliasValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AliasValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Valida la forma de `aliases.json`; lanza con un mensaje claro si no cuadra. */
export function parseAliasDecision(
  value: unknown,
): ExternalArchiveAliasDecision {
  if (!isRecord(value)) {
    throw new AliasValidationError("aliases.json debe ser un objeto JSON");
  }
  const decidedBy = value.decidedBy;
  const decidedAt = value.decidedAt;
  const reason = value.reason;
  if (typeof decidedBy !== "string" || decidedBy.trim() === "") {
    throw new AliasValidationError("aliases.json: falta decidedBy");
  }
  if (typeof decidedAt !== "string" || decidedAt.trim() === "") {
    throw new AliasValidationError("aliases.json: falta decidedAt");
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new AliasValidationError("aliases.json: falta reason");
  }
  if (!Array.isArray(value.aliases)) {
    throw new AliasValidationError("aliases.json: falta el array aliases");
  }

  const seen = new Set<string>();
  const aliases: ExternalArchiveAlias[] = [];
  for (const entry of value.aliases) {
    if (!isRecord(entry)) {
      throw new AliasValidationError(
        "aliases.json: cada alias debe ser un objeto { from, to }",
      );
    }
    const from = entry.from;
    const to = entry.to;
    if (typeof from !== "string" || from === "") {
      throw new AliasValidationError("aliases.json: alias sin 'from'");
    }
    if (typeof to !== "string" || to === "") {
      throw new AliasValidationError("aliases.json: alias sin 'to'");
    }
    const canonicalFrom = canonicalizeUrl(from);
    const canonicalTo = canonicalizeUrl(to);
    if (canonicalFrom !== from) {
      throw new AliasValidationError(
        `aliases.json: 'from' no es una URL canónica (${from}); usa canonicalizeUrl`,
      );
    }
    if (canonicalTo !== to) {
      throw new AliasValidationError(
        `aliases.json: 'to' no es una URL canónica (${to}); usa canonicalizeUrl`,
      );
    }
    if (classifyUrl(from) !== "lesson" || classifyUrl(to) !== "lesson") {
      throw new AliasValidationError(
        `aliases.json: los alias solo mapean lecciones (${from} → ${to})`,
      );
    }
    if (from === to) {
      throw new AliasValidationError(
        `aliases.json: un alias no puede apuntarse a sí mismo (${from})`,
      );
    }
    if (seen.has(from)) {
      throw new AliasValidationError(
        `aliases.json: 'from' duplicado (${from})`,
      );
    }
    seen.add(from);
    aliases.push({ from, to });
  }

  return { decidedBy, decidedAt, reason, aliases };
}

export function loadAliasDecision(
  path: string = EXTERNAL_ARCHIVE_ALIASES_PATH,
): ExternalArchiveAliasDecision {
  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new AliasValidationError(
      `No se pudo leer aliases.json (${path}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseAliasDecision(payload);
}

export type AliasPlanEntry = Readonly<{
  from: string;
  to: string;
  /** Entrada del inventario de la URL retirada (`from`). */
  fromEntry: LinkInventory["entries"][number];
}>;

export type AliasPlan = Readonly<{
  applicable: readonly AliasPlanEntry[];
  /** Alias cuyo `from` ya no está en el inventario: se omiten, no se borran. */
  skipped: readonly ExternalArchiveAlias[];
}>;

/**
 * Cruza la decisión con el inventario:
 * - `from` debe ser una URL de lección presente en el inventario (si no,
 *   el alias se omite: el corpus ya no la referencia).
 * - `to` debe existir siempre en el inventario y ser lección; si falta, es un
 *   error de configuración y el CLI falla.
 * Que el destino quede `captured` se comprueba después de capturar.
 */
export function planAliases(
  decision: ExternalArchiveAliasDecision,
  inventory: LinkInventory,
): AliasPlan {
  const byCanonical = new Map(
    inventory.entries.map((entry) => [entry.canonicalUrl, entry]),
  );
  const applicable: AliasPlanEntry[] = [];
  const skipped: ExternalArchiveAlias[] = [];

  for (const alias of decision.aliases) {
    const fromEntry = byCanonical.get(alias.from);
    const toEntry = byCanonical.get(alias.to);
    if (toEntry === undefined) {
      throw new AliasValidationError(
        `aliases.json: el destino ${alias.to} no existe en el inventario del snapshot`,
      );
    }
    if (toEntry.className !== "lesson") {
      throw new AliasValidationError(
        `aliases.json: el destino ${alias.to} no es una lección (${toEntry.className})`,
      );
    }
    if (fromEntry === undefined) {
      skipped.push(alias);
      continue;
    }
    applicable.push({ from: alias.from, to: alias.to, fromEntry });
  }

  return { applicable, skipped };
}
