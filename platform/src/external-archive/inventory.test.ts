// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveSourceLanguage } from "../source/classify/paths";
import { sourceFiles } from "../source/store/schema";
import {
  createCourseTestDatabase,
  seedRepository,
  seedSnapshot,
  textFile,
} from "../course/test-database.test-helper";
import {
  buildLinkInventory,
  INVENTORY_TEXT_EXTENSIONS,
  inventoryPathForDirectoryFile,
  loadInventoryWithSourceFromDirectory,
  loadInventoryWithSourceFromSnapshot,
  type InventoryInputFile,
} from "./inventory";

const SOURCE_FIXTURES_ROOT = fileURLToPath(
  new URL("../../fixtures/source", import.meta.url),
);

const SOURCE_FIXTURE_COMMIT = "962c1e5fc8ebad273abaa348fb3d161568ce8707";

const SOURCE_FIXTURE_CONTENT = path.join(
  SOURCE_FIXTURES_ROOT,
  SOURCE_FIXTURE_COMMIT,
  "content",
);

const SNAPSHOT_IMPORTED_AT = new Date("2026-10-02T12:13:49.515Z");

/**
 * El fixture de `platform/fixtures/source/` es un subconjunto real del
 * snapshot (17 archivos, 16 textuales); NO es el corpus completo de 899
 * archivos. Los totales del corpus completo (§2 del plan: 1463 ocurrencias de
 * lesson+tool+marketing, 49 URL canónicas, 180 documentos) se afirman en
 * `cli.test.ts` contra el `content/` real. Aquí se afirma exactamente lo que
 * el subconjunto contiene, calculado con la implementación real.
 */
const FIXTURE_TOTALS = {
  files: 16,
  occurrences: 46,
  documents: 7,
  urls: 27,
  byHost: {
    "4geeks.com": 13,
    "4geeksacademy.com": 30,
    "breathecode.herokuapp.com": 1,
    "diagram.4geeks.com": 2,
  },
  byClass: {
    lesson: { occurrences: 6, urls: 3, documents: 4 },
    tool: { occurrences: 2, urls: 1, documents: 2 },
    marketing: { occurrences: 37, urls: 22, documents: 7 },
    "out-of-scope": { occurrences: 1, urls: 1, documents: 1 },
  },
} as const;

function fixtureTextFiles(): string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        INVENTORY_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(fullPath);
      }
    }
  };
  walk(SOURCE_FIXTURE_CONTENT);
  return files.sort();
}

describe("buildLinkInventory (función pura)", () => {
  it("agrupa por URL canónica con ocurrencias, documentos e idioma", () => {
    // El path del documento se toma del inventario real del fixture (nunca se
    // escribe un nombre del catálogo a mano: guard AC-0.10).
    const directoryInventory = loadInventoryWithSourceFromDirectory(
      SOURCE_FIXTURE_CONTENT,
    ).inventory;
    const document = directoryInventory.entries
      .flatMap((entry) => entry.documents)
      .find((candidate) => candidate.path.endsWith(".es.md"));
    expect(document).toBeDefined();
    const file = path.join(
      SOURCE_FIXTURES_ROOT,
      SOURCE_FIXTURE_COMMIT,
      document?.path ?? "",
    );
    const inventoryPath = document?.path ?? "";
    const inputs: InventoryInputFile[] = [
      {
        path: inventoryPath,
        text: readFileSync(file, "utf8"),
        language: "es",
      },
    ];

    const inventory = buildLinkInventory(inputs);

    expect(inventory.files).toBe(1);
    expect(inventory.occurrences).toBeGreaterThan(0);
    for (const entry of inventory.entries) {
      expect(entry.documents).toEqual([
        expect.objectContaining({ path: inventoryPath, language: "es" }),
      ]);
      expect(entry.occurrences).toBeGreaterThanOrEqual(1);
      expect(entry.host).not.toBe("");
    }
  });

  it("extrae el subconjunto real que se le pasa (no inventa URLs)", () => {
    const files = fixtureTextFiles();
    const knownPaths = new Set(
      files.map((file) =>
        inventoryPathForDirectoryFile(SOURCE_FIXTURE_CONTENT, file),
      ),
    );
    const inputs: InventoryInputFile[] = files
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const inventoryPath = inventoryPathForDirectoryFile(
          SOURCE_FIXTURE_CONTENT,
          file,
        );
        const { language } = resolveSourceLanguage(inventoryPath, knownPaths);
        return {
          path: inventoryPath,
          text: readFileSync(file, "utf8"),
          language: language === "es" || language === "en" ? language : null,
        };
      });

    const markdownOnly = buildLinkInventory(inputs);
    const complete = loadInventoryWithSourceFromDirectory(
      SOURCE_FIXTURE_CONTENT,
    ).inventory;

    expect(markdownOnly.occurrences).toBeLessThanOrEqual(complete.occurrences);
    const realCanonicals = new Set(
      complete.entries.map((entry) => entry.canonicalUrl),
    );
    for (const entry of markdownOnly.entries) {
      expect(realCanonicals.has(entry.canonicalUrl)).toBe(true);
    }
  });

  it("con un corpus vacío devuelve un inventario vacío coherente", () => {
    const inventory = buildLinkInventory([]);
    expect(inventory.files).toBe(0);
    expect(inventory.occurrences).toBe(0);
    expect(inventory.entries).toEqual([]);
    expect(inventory.byClass.lesson).toEqual({
      occurrences: 0,
      urls: 0,
      documents: 0,
    });
  });
});

describe("loadInventoryWithSourceFromDirectory (fixture real)", () => {
  const loaded = loadInventoryWithSourceFromDirectory(SOURCE_FIXTURE_CONTENT);

  it("produce los totales reales del subconjunto", () => {
    expect(loaded.inventory.files).toBe(FIXTURE_TOTALS.files);
    expect(loaded.inventory.occurrences).toBe(FIXTURE_TOTALS.occurrences);
    expect(loaded.inventory.documents).toBe(FIXTURE_TOTALS.documents);
    expect(loaded.inventory.entries).toHaveLength(FIXTURE_TOTALS.urls);
    expect(loaded.inventory.byHost).toEqual(FIXTURE_TOTALS.byHost);
  });

  it("clasifica por clase con ocurrencias/URLs/documentos reales", () => {
    expect(loaded.inventory.byClass).toEqual(FIXTURE_TOTALS.byClass);
  });

  it("agrupa las URL de lección reales del subconjunto", () => {
    const lessons = loaded.inventory.entries.filter(
      (entry) => entry.className === "lesson",
    );
    expect(
      lessons.map((entry) => [
        entry.canonicalUrl,
        entry.occurrences,
        entry.documents.length,
      ]),
    ).toEqual([
      [
        "https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion",
        1,
        1,
      ],
      ["https://4geeks.com/lesson/how-to-start-a-project", 3, 3],
      ["https://4geeks.com/lesson/what-is-github-codespaces", 2, 2],
    ]);
  });

  it("resuelve el idioma de los documentos por evidencia de path (ADR-012)", () => {
    const languages = new Set<string>();
    for (const entry of loaded.inventory.entries) {
      for (const document of entry.documents) {
        if (document.path.endsWith(".es.md")) {
          expect(document.language).toBe("es");
          languages.add("es");
        } else if (document.path.endsWith(".md")) {
          // `X.md` sin pareja `X.es.md` no declara idioma (ADR-012).
          expect(["en", null]).toContain(document.language);
          if (document.language === "en") {
            languages.add("en");
          }
        }
      }
    }
    expect(languages).toEqual(new Set(["es", "en"]));
  });

  it("marca breathecode.herokuapp.com como out-of-scope", () => {
    const outOfScope = loaded.inventory.entries.filter(
      (entry) => entry.className === "out-of-scope",
    );
    expect(outOfScope).toHaveLength(1);
    expect(outOfScope[0]?.host).toBe("breathecode.herokuapp.com");
  });
});

describe("loadInventoryWithSourceFromSnapshot (PGlite, solo SELECT)", () => {
  it("lee el snapshot activo y coincide con el cargador de directorio", async () => {
    const { db, client } = await createCourseTestDatabase();
    try {
      const repositoryId = await seedRepository(db);
      const snapshotId = await seedSnapshot(db, repositoryId, {
        status: "complete",
        importedAt: SNAPSHOT_IMPORTED_AT,
      });
      const files = fixtureTextFiles();
      const knownPaths = new Set(
        files.map((file) =>
          inventoryPathForDirectoryFile(SOURCE_FIXTURE_CONTENT, file),
        ),
      );
      await db.insert(sourceFiles).values(
        files.map((file) => {
          const inventoryPath = inventoryPathForDirectoryFile(
            SOURCE_FIXTURE_CONTENT,
            file,
          );
          const { language, languageEvidence } = resolveSourceLanguage(
            inventoryPath,
            knownPaths,
          );
          return textFile(snapshotId, inventoryPath, {
            rawContent: readFileSync(file, "utf8"),
            language,
            languageEvidence,
          });
        }),
      );

      const loaded = await loadInventoryWithSourceFromSnapshot(db);
      const fromDirectory = loadInventoryWithSourceFromDirectory(
        SOURCE_FIXTURE_CONTENT,
      );

      expect(loaded.source).toEqual({
        kind: "snapshot",
        snapshotId,
        commitSha: "a".repeat(40),
        repository: "example-org/example-syllabus",
      });
      expect(loaded.inventory).toEqual(fromDirectory.inventory);
    } finally {
      await client.close();
    }
  });

  it("falla con un error claro si no hay snapshot activo", async () => {
    const { db, client } = await createCourseTestDatabase();
    try {
      await expect(loadInventoryWithSourceFromSnapshot(db)).rejects.toThrow(
        /snapshot SOURCE activo/,
      );
    } finally {
      await client.close();
    }
  });
});
