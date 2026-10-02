// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PLATFORM_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const ENV_EXAMPLE_PATH = path.join(PLATFORM_ROOT, ".env.example");

const SECRET_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "clave de API con prefijo sk-", pattern: /sk-/ },
  { label: "token de GitHub con prefijo ghp_", pattern: /ghp_/ },
  { label: "token de GitHub con prefijo github_pat_", pattern: /github_pat_/ },
  { label: "JWT (prefijo eyJ)", pattern: /eyJ/ },
  {
    label: "URL con credenciales incrustadas (://usuario:clave@)",
    pattern: /:\/\/[^/\s:@]+:[^/\s@]+@/,
  },
];

function readEnvExample(): string {
  return readFileSync(ENV_EXAMPLE_PATH, "utf8");
}

describe("AC-0.7: platform/.env.example", () => {
  it("existe y no está vacío", () => {
    expect(
      existsSync(ENV_EXAMPLE_PATH),
      `Falta ${path.relative(PLATFORM_ROOT, ENV_EXAMPLE_PATH)}`,
    ).toBe(true);
    expect(readEnvExample().trim().length).toBeGreaterThan(0);
  });

  it("no define ninguna variable activa: todo son comentarios o líneas en blanco", () => {
    const activeLines = readEnvExample()
      .split(/\r?\n/)
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter(({ text }) => text !== "" && !text.startsWith("#"));

    expect(
      activeLines,
      [
        "M0 no requiere variables de entorno: .env.example no debe tener líneas activas.",
        "Líneas activas encontradas:",
        ...activeLines.map(({ line, text }) => `  - ${line}: ${text}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("no contiene valores con pinta de secreto", () => {
    const content = readEnvExample();
    const matches = SECRET_PATTERNS.filter(({ pattern }) =>
      pattern.test(content),
    );

    expect(
      matches.map(({ label }) => label),
      "Un .env.example nunca debe contener secretos reales, ni siquiera como ejemplo.",
    ).toEqual([]);
  });
});
