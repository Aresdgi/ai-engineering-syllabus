// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSourceFixtureManifest,
  type SourceFixtureEntry,
  type SourceFixtureManifest,
} from "../../test/source-fixtures";
import type { SourcePath, SourceTree, SourceTreeBlobEntry } from "../types";

/**
 * Utilidades de test (no producción): cargan los fixtures reales de
 * `platform/fixtures/source` y construyen un `SourceTree` equivalente al del
 * upstream, sin red. Las rutas se derivan del manifiesto en runtime, nunca de
 * literales con nombres del catálogo.
 */
export const FIXTURES_SOURCE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/source",
);

export type FixtureTree = Readonly<{
  manifest: SourceFixtureManifest;
  tree: SourceTree;
  fixturePaths: readonly SourcePath[];
  bytesByPath: ReadonlyMap<SourcePath, Uint8Array>;
}>;

export function fixtureAbsolutePath(fixture: SourceFixtureEntry): string {
  return path.join(
    FIXTURES_SOURCE_ROOT,
    fixture.commit,
    ...fixture.path.split("/"),
  );
}

export function loadFixtureManifest(): SourceFixtureManifest {
  const raw = readFileSync(
    path.join(FIXTURES_SOURCE_ROOT, "manifest.json"),
    "utf8",
  );
  const parsed = parseSourceFixtureManifest(raw);
  if (!parsed.ok) {
    throw new Error(
      `fixtures/source/manifest.json inválido: ${parsed.messages.join("; ")}`,
    );
  }
  return parsed.manifest;
}

export function loadFixtureTree(): FixtureTree {
  const manifest = loadFixtureManifest();
  const bytesByPath = new Map<SourcePath, Uint8Array>();
  const entries: SourceTreeBlobEntry[] = manifest.fixtures.map((fixture) => {
    const bytes = readFileSync(fixtureAbsolutePath(fixture));
    bytesByPath.set(fixture.path, bytes);
    return {
      type: "blob",
      path: fixture.path,
      blobSha: fixture.blob_sha,
      size: bytes.byteLength,
      mode: "100644",
    };
  });
  const commitSha = manifest.fixtures[0]?.commit ?? "";
  return {
    manifest,
    tree: { commitSha, truncated: false, entries },
    fixturePaths: manifest.fixtures.map((fixture) => fixture.path),
    bytesByPath,
  };
}
