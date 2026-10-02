// @vitest-environment node
/**
 * AC-2.2: el orden de proyectos se deriva del README real importado.
 *
 * Los tests usan el fixture verbatim de `content/projects/README.md` y su
 * variante en español, localizados por el manifiesto en runtime (AC-0.10).
 */

import { describe, expect, it } from "vitest";

import { readFixture } from "./fixture-reader.test-helper";
import { parseProjectOrder, type ProjectOrderEntry } from "./order";

function groupBySection(
  entries: readonly ProjectOrderEntry[],
): ProjectOrderEntry[][] {
  const groups = new Map<string, ProjectOrderEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.section);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.section, [entry]);
    }
  }
  return [...groups.values()];
}

const README = readFixture("projects/README.md");
const ORDER = parseProjectOrder(README);
const ENTRIES = ORDER.entries;
const SECTION_GROUPS = groupBySection(ENTRIES);
const FIRST_SECTION = SECTION_GROUPS[0] ?? [];
const LAST_SECTION = SECTION_GROUPS[SECTION_GROUPS.length - 1] ?? [];
const NESTED = ENTRIES.filter((entry) => entry.isNested);

describe("parseProjectOrder sobre el README real de proyectos", () => {
  it("produce posiciones secuenciales, paths únicos y dentro de content/projects", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
    expect(
      new Set(ENTRIES.map((entry) => entry.sourcePath)).size,
      "hay sourcePath duplicados en el orden",
    ).toBe(ENTRIES.length);
    ENTRIES.forEach((entry, index) => {
      expect(entry.position).toBe(index);
      expect(entry.sourcePath.startsWith("content/projects/")).toBe(true);
    });
  });

  it("la primera sección lista 71 entradas numeradas con posiciones 0..70", () => {
    expect(FIRST_SECTION).toHaveLength(71);
    expect(FIRST_SECTION.map((entry) => entry.position)).toEqual(
      Array.from({ length: 71 }, (_, index) => index),
    );
    expect(FIRST_SECTION.every((entry) => !entry.isNested)).toBe(true);
  });

  it("F-02: expone el número literal de los ítems de lista ordenada y null en el resto", () => {
    expect(FIRST_SECTION.map((entry) => entry.listMarker)).toEqual(
      Array.from({ length: 71 }, (_, index) => String(index)),
    );
    const unordered = ENTRIES.filter((entry) => !FIRST_SECTION.includes(entry));
    expect(unordered.length).toBeGreaterThan(0);
    for (const entry of unordered) {
      expect(entry.listMarker, entry.sourcePath).toBeNull();
    }
  });

  it("F-02: la última sección (viñetas) y las anidadas no llevan marcador", () => {
    expect(LAST_SECTION.length).toBeGreaterThan(0);
    expect(LAST_SECTION.every((entry) => entry.listMarker === null)).toBe(true);
    expect(NESTED.length).toBeGreaterThan(0);
    expect(NESTED.every((entry) => entry.listMarker === null)).toBe(true);
  });

  it("solo hay 2 entradas anidadas y su padre está listado en la misma sección", () => {
    expect(NESTED).toHaveLength(2);
    const byPath = new Map(ENTRIES.map((entry) => [entry.sourcePath, entry]));
    for (const nested of NESTED) {
      const parentPath = nested.sourcePath.slice(
        0,
        nested.sourcePath.lastIndexOf("/"),
      );
      const parent = byPath.get(parentPath);
      expect(parent, `falta el padre de ${nested.sourcePath}`).toBeDefined();
      expect(parent?.isNested).toBe(false);
      expect(nested.section).toBe(parent?.section);
      expect(nested.sourcePath.startsWith(`${parentPath}/`)).toBe(true);
    }
  });

  it("la última sección agrupa 7 entradas no anidadas", () => {
    expect(SECTION_GROUPS.length).toBeGreaterThanOrEqual(2);
    expect(LAST_SECTION).toHaveLength(7);
    expect(LAST_SECTION.every((entry) => !entry.isNested)).toBe(true);
    expect(LAST_SECTION[0]?.section).not.toBe(FIRST_SECTION[0]?.section);
  });

  it("etiquetas, secciones y descripciones son literales del fixture", () => {
    for (const entry of ENTRIES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(README).toContain(entry.label);
      expect(entry.section.length).toBeGreaterThan(0);
      expect(README).toContain(entry.section);
      if (entry.description !== null) {
        expect(README).toContain(entry.description);
      }
    }
    const described = ENTRIES.filter((entry) => entry.description !== null);
    expect(described.length).toBeGreaterThan(0);
  });

  it("el enlace de track va en párrafo y no captura descripción", () => {
    const withoutDescription = ENTRIES.filter(
      (entry) => entry.description === null,
    );
    expect(withoutDescription).toHaveLength(1);
    const track = withoutDescription[0]!;
    expect(track.isNested).toBe(false);
    expect(track.listMarker).toBeNull();
    expect(track.label).toContain(track.sourcePath.split("/").pop() ?? "");
  });

  it("ignora los enlaces a contextos y los bloques de código", () => {
    expect(
      ENTRIES.some((entry) => entry.sourcePath.includes("/contexts/")),
    ).toBe(false);
    const synthetic = [
      "# Catálogo",
      "",
      "## Sección",
      "",
      "0. **[Unidad alfa](./alpha-unit)**",
      "   Descripción alfa.",
      "",
      "```md",
      "1. **[Ignorada](./ignored-unit)**",
      "```",
      "",
      "1. **[Unidad beta](./beta-unit)**",
      "   Descripción beta.",
      "",
    ].join("\n");
    const parsed = parseProjectOrder(synthetic);
    expect(parsed.entries.map((entry) => entry.sourcePath)).toEqual([
      "content/projects/alpha-unit",
      "content/projects/beta-unit",
    ]);
    expect(parsed.entries[0]?.description).toBe("Descripción alfa.");
    expect(parsed.entries[0]?.section).toBe("Sección");
    expect(parsed.entries.map((entry) => entry.listMarker)).toEqual(["0", "1"]);
  });
});

describe("parseProjectOrder sobre el README real en español", () => {
  const readmeEs = readFixture("projects/README.es.md");
  const orderEs = parseProjectOrder(readmeEs);

  it("reproduce exactamente el mismo orden de slugs y el mismo reparto de secciones", () => {
    expect(orderEs.entries.map((entry) => entry.sourcePath)).toEqual(
      ENTRIES.map((entry) => entry.sourcePath),
    );
    expect(sectionGroupSizes(orderEs.entries)).toEqual(
      sectionGroupSizes(ENTRIES),
    );
    expect(orderEs.entries.map((entry) => entry.listMarker)).toEqual(
      ENTRIES.map((entry) => entry.listMarker),
    );
  });

  it("las etiquetas y secciones son literales del README en español", () => {
    for (const entry of orderEs.entries) {
      expect(readmeEs).toContain(entry.label);
      expect(readmeEs).toContain(entry.section);
    }
  });

  it("mantiene 71 entradas en la primera sección, 2 anidadas y 7 en la última", () => {
    const groups = groupBySection(orderEs.entries);
    expect(groups[0]).toHaveLength(71);
    expect(groups[groups.length - 1]).toHaveLength(7);
    expect(orderEs.entries.filter((entry) => entry.isNested)).toHaveLength(2);
  });
});

function sectionGroupSizes(entries: readonly ProjectOrderEntry[]): number[] {
  return groupBySection(entries).map((group) => group.length);
}
