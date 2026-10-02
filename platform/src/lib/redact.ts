/**
 * Redacción de secretos para la salida de los CLIs de M1.
 *
 * Funciones puras y sin dependencias, compartidas por `source/cli.ts` y
 * `source/store/migrate.ts`:
 *
 * - `redactSecrets(text, env)` sustituye por `[redacted]` los valores de
 *   `DATABASE_URL` y `GITHUB_TOKEN` presentes en el entorno y enmascara la
 *   contraseña de cualquier URI con credenciales embebidas
 *   (`esquema://usuario:contraseña@` → `esquema://usuario:***@`).
 * - `describeError(error, env)` convierte cualquier error en texto seguro:
 *   recorre `stack`/mensaje, `code`, propiedades propias (p. ej. `input` de
 *   `ERR_INVALID_URL`) y `cause`, y aplica `redactSecrets` al resultado.
 *
 * `console.error(error)` crudo nunca debe usarse en los CLIs: el `util.inspect`
 * de Node imprime las propiedades enumerables del error (como `input`) y con
 * ellas la URI con contraseña.
 */

export type RedactEnv = Readonly<Record<string, string | undefined>>;

const SECRET_ENV_NAMES = ["DATABASE_URL", "GITHUB_TOKEN"] as const;
const REDACTED_VALUE = "[redacted]";
const REDACTED_PASSWORD = "***";
const MAX_ERROR_DEPTH = 8;

/** URI con credenciales embebidas: conserva esquema y usuario, enmascara la contraseña. */
const URI_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/[^/\s@:]+):[^/\s]+@/gi;

/** Sustituye secretos del entorno y contraseñas de URI antes de imprimir texto. */
export function redactSecrets(text: string, env: RedactEnv): string {
  let redacted = text;
  for (const name of SECRET_ENV_NAMES) {
    const secret = env[name]?.trim();
    if (secret !== undefined && secret !== "") {
      redacted = redacted.split(secret).join(REDACTED_VALUE);
    }
  }
  return redacted.replace(URI_CREDENTIALS, `$1:${REDACTED_PASSWORD}@`);
}

/** Describe cualquier error (mensaje, código, propiedades, `cause` y stack) ya redactado. */
export function describeError(error: unknown, env: RedactEnv = {}): string {
  const parts: string[] = [];
  appendError(parts, error, new Set<unknown>(), 0, "");
  return redactSecrets(parts.join("\n"), env);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appendPrimitive(parts: string[], value: unknown, label: string): void {
  const text =
    typeof value === "string"
      ? value
      : value === null
        ? "null"
        : value === undefined
          ? "undefined"
          : String(value);
  parts.push(label === "" ? text : `${label}=${text}`);
}

function appendValue(
  parts: string[],
  value: unknown,
  seen: Set<unknown>,
  depth: number,
  label: string,
): void {
  if (value instanceof Error) {
    appendError(parts, value, seen, depth, label);
    return;
  }
  if (!isRecord(value)) {
    appendPrimitive(parts, value, label);
    return;
  }
  if (seen.has(value)) {
    parts.push(label === "" ? "[circular]" : `${label}=[circular]`);
    return;
  }
  seen.add(value);
  if (depth >= MAX_ERROR_DEPTH) {
    parts.push(label === "" ? "[object]" : `${label}=[object]`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendValue(
        parts,
        item,
        seen,
        depth + 1,
        label === "" ? `[${index}]` : `${label}[${index}]`,
      );
    });
    return;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    parts.push(label === "" ? "{}" : `${label}={}`);
    return;
  }
  for (const [key, nested] of entries) {
    appendValue(
      parts,
      nested,
      seen,
      depth + 1,
      label === "" ? key : `${label}.${key}`,
    );
  }
}

function appendError(
  parts: string[],
  error: unknown,
  seen: Set<unknown>,
  depth: number,
  label: string,
): void {
  if (!(error instanceof Error)) {
    appendValue(parts, error, seen, depth, label);
    return;
  }
  const prefix = label === "" ? "" : `${label}=`;
  if (seen.has(error)) {
    parts.push(`${prefix}[circular error]`);
    return;
  }
  if (depth >= MAX_ERROR_DEPTH) {
    parts.push(`${prefix}[error]`);
    return;
  }
  seen.add(error);
  if (typeof error.stack === "string" && error.stack.trim() !== "") {
    parts.push(`${prefix}${error.stack}`);
  } else {
    parts.push(`${prefix}${error.name}: ${error.message}`);
  }
  const record = error as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (
      key === "name" ||
      key === "message" ||
      key === "stack" ||
      key === "cause"
    ) {
      continue;
    }
    appendValue(parts, value, seen, depth + 1, key);
  }
  // `cause` es una propiedad no enumerable: hay que recorrerla explícitamente.
  if (record.cause !== undefined) {
    appendValue(parts, record.cause, seen, depth + 1, "cause");
  }
}
