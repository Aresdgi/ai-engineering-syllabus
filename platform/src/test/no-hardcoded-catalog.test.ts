// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectCatalogTokens,
  formatCatalogViolations,
  normalizeCatalogText,
  REPO_ROOT,
  scanDirectoryForCatalogTokens,
  scanForHardcodedCatalog,
} from "./catalog-denylist";

const GUARD_FILE = fileURLToPath(import.meta.url);

const CATALOG_BUCKETS = ["projects", "lessons", "contexts"] as const;

const temporaryRoots: string[] = [];

function createTemporaryRoot(prefix: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function pickRealMultiSegmentToken(): string {
  const entry = collectCatalogTokens().find(
    ({ token }) => token.split("-").length >= 2,
  );
  if (!entry) {
    throw new Error(
      "El corpus real no contiene ningún token multi-segmento para este test",
    );
  }
  return entry.token;
}

function toSpacedCamelCase(token: string): string {
  return token
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

describe("AC-0.10: no existe catálogo educativo hardcodeado", () => {
  it("construye la denylist en tiempo de ejecución desde content/ (nunca hardcodeada)", () => {
    const tokens = collectCatalogTokens();

    expect(tokens.length).toBeGreaterThan(0);
    for (const { token } of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(5);
      expect(/^\d+$/.test(token)).toBe(false);
      expect(token.startsWith("context-")).toBe(false);
      expect(token.endsWith(".md")).toBe(false);
    }
  });

  it("falla de forma explícita si content/ no existe (fail-closed)", () => {
    expect(() =>
      collectCatalogTokens("/content-inexistente-para-el-guard"),
    ).toThrow(/content/);
  });

  it("ningún archivo de platform/ contiene nombres del catálogo del syllabus", () => {
    const violations = scanForHardcodedCatalog(GUARD_FILE);

    expect(violations, formatCatalogViolations(violations)).toEqual([]);
  });
});

describe("AC-0.10 F-01: control positivo del matcher", () => {
  it("detecta con archivo:línea un token real inyectado en un directorio temporal", () => {
    const token = pickRealMultiSegmentToken();
    const scanRoot = createTemporaryRoot("ac010-positive-");
    const injectedFile = path.join(scanRoot, "injected.ts");
    writeFileSync(injectedFile, `const hardcoded = "${token}";\n`);

    const violations = scanDirectoryForCatalogTokens(
      scanRoot,
      path.join(scanRoot, "guard.ts"),
    );

    const detection = violations.find((violation) => violation.token === token);
    expect(
      detection,
      `No se detectó el token inyectado. ${formatCatalogViolations(violations)}`,
    ).toBeDefined();
    expect(detection?.line).toBe(1);
    expect(detection?.file).toBe(path.relative(REPO_ROOT, injectedFile));
    expect(formatCatalogViolations(violations)).toContain(
      `${detection?.file}:1`,
    );
  });
});

describe("AC-0.10 F-02: normalización de nombres naturalizados", () => {
  it("trata espacios y guiones bajos como guiones, colapsando repeticiones", () => {
    expect(normalizeCatalogText("Nombre Compuesto")).toBe("nombre-compuesto");
    expect(normalizeCatalogText("nombre__compuesto")).toBe("nombre-compuesto");
    expect(normalizeCatalogText("nombre  compuesto")).toBe("nombre-compuesto");
    expect(normalizeCatalogText("Nombre_Compuesto")).toBe("nombre-compuesto");
  });

  it("detecta un token real multi-segmento escrito con espacios o guiones bajos", () => {
    const token = pickRealMultiSegmentToken();
    const spacedCamelCase = toSpacedCamelCase(token);
    const underscored = token.replace(/-/g, "_");
    const scanRoot = createTemporaryRoot("ac010-normalized-");
    const spacedFile = path.join(scanRoot, "spaced.ts");
    const underscoredFile = path.join(scanRoot, "underscored.ts");
    writeFileSync(spacedFile, `export const title = "${spacedCamelCase}";\n`);
    writeFileSync(underscoredFile, `const key = "${underscored}";\n`);

    const violations = scanDirectoryForCatalogTokens(
      scanRoot,
      path.join(scanRoot, "guard.ts"),
    );

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          token,
          line: 1,
          file: path.relative(REPO_ROOT, spacedFile),
        }),
        expect.objectContaining({
          token,
          line: 1,
          file: path.relative(REPO_ROOT, underscoredFile),
        }),
      ]),
    );
  });
});

describe("AC-0.10 F-03: fail-closed por bucket", () => {
  it.each(CATALOG_BUCKETS)(
    "falla si el bucket %s no aporta ningún token a la denylist",
    (emptyBucket) => {
      const contentRoot = createTemporaryRoot(`ac010-empty-${emptyBucket}-`);
      for (const bucket of CATALOG_BUCKETS) {
        mkdirSync(path.join(contentRoot, bucket));
        if (bucket !== emptyBucket) {
          mkdirSync(path.join(contentRoot, bucket, `sample-${bucket}`));
        }
      }

      expect(() => collectCatalogTokens(contentRoot)).toThrow(
        new RegExp(emptyBucket),
      );
    },
  );

  it("falla si todos los buckets están vacíos (corpus vacío)", () => {
    const contentRoot = createTemporaryRoot("ac010-empty-corpus-");
    for (const bucket of CATALOG_BUCKETS) {
      mkdirSync(path.join(contentRoot, bucket));
    }

    expect(() => collectCatalogTokens(contentRoot)).toThrow(/fail-closed/);
  });
});

describe("AC-0.10 F-06: extensiones de configuración escaneadas", () => {
  it.each([".yaml", ".yml", ".sql", ".example"])(
    "detecta un token real del catálogo en un archivo %s",
    (extension) => {
      const token = pickRealMultiSegmentToken();
      const scanRoot = createTemporaryRoot(
        `ac010-ext-${extension.replace(".", "")}-`,
      );
      const injectedFile = path.join(scanRoot, `config${extension}`);
      writeFileSync(injectedFile, `valor: "${token}"\n`);

      const violations = scanDirectoryForCatalogTokens(
        scanRoot,
        path.join(scanRoot, "guard.ts"),
      );

      expect(violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "catalog-name",
            token,
            line: 1,
            file: path.relative(REPO_ROOT, injectedFile),
          }),
        ]),
      );
    },
  );
});
