// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeGitBlobSha,
  verifySourceFixtures,
} from "../../test/source-fixtures";
import {
  fixtureAbsolutePath,
  FIXTURES_SOURCE_ROOT,
  loadFixtureManifest,
} from "../classify/fixture-tree.test-helper";
import type { SourceValidationContext } from "./paths";
import { validateBlobContent } from "./snapshot";

const CONTEXT: SourceValidationContext = { snapshotId: "snapshot-test" };

describe("fixtures reales (AC-1.12)", () => {
  it("todo el directorio de fixtures queda verificado contra el manifiesto", () => {
    const manifest = loadFixtureManifest();
    const verification = verifySourceFixtures(FIXTURES_SOURCE_ROOT);
    expect(verification.violations).toEqual([]);
    expect(verification.verifiedFiles).toHaveLength(manifest.fixtures.length);
  });

  it("cada fixture reproduce byte a byte su blob_sha declarado", () => {
    const manifest = loadFixtureManifest();
    expect(
      new Set(manifest.fixtures.map((fixture) => fixture.commit)).size,
    ).toBe(1);
    for (const fixture of manifest.fixtures) {
      const bytes = new Uint8Array(readFileSync(fixtureAbsolutePath(fixture)));
      expect(computeGitBlobSha(bytes), fixture.path).toBe(fixture.blob_sha);
      expect(
        validateBlobContent(
          { path: fixture.path, blobSha: fixture.blob_sha },
          bytes,
          CONTEXT,
        ),
        fixture.path,
      ).toBeNull();
      expect(bytes.byteLength).toBeLessThan(50 * 1024);
    }
  });

  it("el manifiesto cubre las variantes exigidas por AC-1.10/AC-1.12", () => {
    const fixturePaths = loadFixtureManifest().fixtures.map(
      (fixture) => fixture.path,
    );
    const requiredPatterns: ReadonlyArray<readonly [string, RegExp]> = [
      ["README.md de proyecto", /^content\/projects\/[^/]+\/README\.md$/],
      [
        "README.es.md de proyecto",
        /^content\/projects\/[^/]+\/README\.es\.md$/,
      ],
      ["learn.json", /^content\/projects\/[^/]+\/learn\.json$/],
      ["CONTEXT-*.md", /^content\/contexts\/[^/]+\/CONTEXT-[^/]*\.md$/],
      ["CONTEXT-*.es.md", /^content\/contexts\/[^/]+\/CONTEXT-[^/]*\.es\.md$/],
      ["lección .es.md", /^content\/lessons\/[^/]+\/[^/]+\.es\.md$/],
      ["archivo .en.md", /\.en\.md$/],
      ["archivo sin variante española", /\.learn\/solution\/README\.md$/],
      ["binario pequeño", /\.(png|pdf)$/],
    ];
    for (const [label, pattern] of requiredPatterns) {
      expect(
        fixturePaths.some((fixturePath) => pattern.test(fixturePath)),
        `falta el fixture requerido: ${label}`,
      ).toBe(true);
    }
  });
});
