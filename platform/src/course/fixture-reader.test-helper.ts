// @vitest-environment node
/**
 * Utilidades solo-para-tests: localizan fixtures verbatim por sufijo de path
 * en runtime (nunca por literales del catálogo, AC-0.10) y leen su contenido.
 */

import { readFileSync } from "node:fs";

import {
  fixtureAbsolutePath,
  loadFixtureManifest,
} from "../source/classify/fixture-tree.test-helper";
import type { SourceFixtureEntry } from "../source/fixtures";

export function fixturesMatching(
  predicate: (entry: SourceFixtureEntry) => boolean,
): SourceFixtureEntry[] {
  return loadFixtureManifest().fixtures.filter(predicate);
}

/** Fixture cuyo path termina en `pathSuffix`; exige coincidencia única. */
export function requireFixture(pathSuffix: string): SourceFixtureEntry {
  const matches = fixturesMatching(
    (entry) =>
      entry.path === pathSuffix || entry.path.endsWith(`/${pathSuffix}`),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Se esperaba 1 fixture con sufijo "${pathSuffix}", encontrados ${matches.length}`,
    );
  }
  return matches[0]!;
}

export function readFixtureEntry(entry: SourceFixtureEntry): string {
  return readFileSync(fixtureAbsolutePath(entry), "utf8");
}

export function readFixture(pathSuffix: string): string {
  return readFixtureEntry(requireFixture(pathSuffix));
}
