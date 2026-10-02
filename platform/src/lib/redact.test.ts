// @vitest-environment node
import { describe, expect, it } from "vitest";

import { describeError, redactSecrets } from "./redact";

const DATABASE_URL =
  "postgresql://app:supersecret@db.example.com:5432/postgres";
const GITHUB_TOKEN = "ghp_exampleToken123";

function captureThrow(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("la función no lanzó");
}

describe("redactSecrets", () => {
  it("sustituye los valores de DATABASE_URL y GITHUB_TOKEN del entorno", () => {
    const text = `conectando a ${DATABASE_URL} con token ${GITHUB_TOKEN}`;
    const output = redactSecrets(text, { DATABASE_URL, GITHUB_TOKEN });

    expect(output).not.toContain("supersecret");
    expect(output).not.toContain(GITHUB_TOKEN);
    expect(output).toContain("[redacted]");
  });

  it("enmascara credenciales embebidas en URIs sin necesitar el entorno", () => {
    expect(redactSecrets("fallo: postgresql://app:leak@db:5432/x", {})).toBe(
      "fallo: postgresql://app:***@db:5432/x",
    );
    expect(redactSecrets("https://user:p@ss@example.com/path", {})).toBe(
      "https://user:***@example.com/path",
    );
  });

  it("no altera URIs sin credenciales", () => {
    expect(redactSecrets("https://example.com/a:b@c", {})).toBe(
      "https://example.com/a:b@c",
    );
  });

  it("ignora secretos vacíos del entorno", () => {
    expect(redactSecrets("hola", { DATABASE_URL: "   " })).toBe("hola");
  });
});

describe("describeError", () => {
  it("una URL malformada no filtra la contraseña ni con el entorno vacío", () => {
    const error = captureThrow(() => new URL("postgresql://app:supersecret@"));

    const output = describeError(error, {});

    expect(output).toContain("ERR_INVALID_URL");
    expect(output).not.toContain("supersecret");
    expect(output).toContain("postgresql://app:***@");
  });

  it("recorre input y cause anidados y los redacta", () => {
    const cause = captureThrow(() => new URL("postgresql://app:inner-secret@"));
    const outer = new Error("no se pudo conectar", { cause });

    const output = describeError(outer, {});

    expect(output).toContain("no se pudo conectar");
    expect(output).toContain("cause=");
    expect(output).toContain("ERR_INVALID_URL");
    expect(output).not.toContain("inner-secret");
  });

  it("redacta el token de GitHub presente en el mensaje", () => {
    const output = describeError(
      new Error(`401 al llamar a la API con ${GITHUB_TOKEN}`),
      { GITHUB_TOKEN },
    );

    expect(output).not.toContain(GITHUB_TOKEN);
    expect(output).toContain("[redacted]");
  });

  it("redacta también secretos embebidos en el stack", () => {
    const error = new Error("boom");
    error.stack =
      "Error: boom\n    at connect (postgresql://app:stack-secret@db:5432)";

    const output = describeError(error, {});

    expect(output).not.toContain("stack-secret");
    expect(output).toContain("postgresql://app:***@db:5432");
  });

  it("recorre propiedades propias como detail", () => {
    const error = new Error("fetch falló");
    Object.assign(error, {
      detail: { url: "postgresql://app:detail-secret@db" },
    });

    const output = describeError(error, {});

    expect(output).toContain("detail.url=");
    expect(output).not.toContain("detail-secret");
  });

  it("describe valores que no son Error sin romper", () => {
    expect(describeError("boom", {})).toBe("boom");
    expect(describeError(undefined, {})).toBe("undefined");
  });

  it("no entra en bucle con causas circulares", () => {
    const error = new Error("circular");
    error.cause = error;

    const output = describeError(error, {});

    expect(output).toContain("[circular error]");
  });
});
