// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectCatalogTokens,
  CONTENT_ROOT,
  formatCatalogViolations,
  normalizeCatalogText,
  REPO_ROOT,
  scanDirectoryForCatalogTokens,
  tokenPattern,
} from "./catalog-denylist";
import {
  computeGitBlobSha,
  parseSourceFixtureManifest,
  SOURCE_FIXTURES_MANIFEST_NAME,
  SOURCE_FIXTURES_REPOSITORY,
  verifySourceFixtures,
} from "./source-fixtures";

const TEST_COMMIT = "0123456789abcdef0123456789abcdef01234567";

const OTHER_COMMIT = "fedcba9876543210fedcba9876543210fedcba98";

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

function listFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

type RealFixture = {
  absolutePath: string;
  sourcePath: string;
  content: Buffer;
  token: string;
};

let cachedRealFixture: RealFixture | null = null;

/**
 * Busca en runtime un archivo real de content/ cuyo contenido mencione un
 * token real de la denylist. Nada de nombres hardcodeados.
 */
function findRealFixtureWithCatalogToken(): RealFixture {
  if (cachedRealFixture) {
    return cachedRealFixture;
  }

  const tokens = collectCatalogTokens();
  const candidates = listFilesRecursively(CONTENT_ROOT)
    .filter((file) => /\.(?:md|json|csv|txt)$/i.test(file))
    .sort((a, b) => statSync(a).size - statSync(b).size);

  for (const file of candidates) {
    const content = readFileSync(file);
    const text = content.toString("utf8");
    if (text.includes("\u0000")) {
      continue;
    }
    const normalizedText = normalizeCatalogText(text);
    const plausible = tokens.filter(({ token }) =>
      normalizedText.includes(token),
    );
    if (plausible.length === 0) {
      continue;
    }
    const normalizedLines = text.split(/\r?\n/).map(normalizeCatalogText);
    const match = plausible.find(({ token }) => {
      const pattern = tokenPattern(token);
      return normalizedLines.some((line) => pattern.test(line));
    });
    if (match) {
      cachedRealFixture = {
        absolutePath: file,
        sourcePath: path.relative(REPO_ROOT, file).split(path.sep).join("/"),
        content,
        token: match.token,
      };
      return cachedRealFixture;
    }
  }

  throw new Error(
    "El corpus real de content/ no contiene ningún archivo textual con un token del catálogo en su contenido",
  );
}

type FixtureLocation = {
  commit: string;
  path: string;
};

function writeFixtureFile(
  fixturesRoot: string,
  location: FixtureLocation,
  content: string | Buffer,
): string {
  const file = path.join(
    fixturesRoot,
    location.commit,
    ...location.path.split("/"),
  );
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

function writeManifest(
  fixturesRoot: string,
  fixtures: ReadonlyArray<FixtureLocation & { blob_sha: string }>,
  repository: string = SOURCE_FIXTURES_REPOSITORY,
): string {
  const manifestPath = path.join(fixturesRoot, SOURCE_FIXTURES_MANIFEST_NAME);
  mkdirSync(fixturesRoot, { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify({ repository, fixtures }, null, 2),
  );
  return manifestPath;
}

function setupVerifiedFixture(prefix: string) {
  const platformRoot = createTemporaryRoot(prefix);
  const fixturesRoot = path.join(platformRoot, "fixtures", "source");
  const fixture = findRealFixtureWithCatalogToken();
  const location = { commit: TEST_COMMIT, path: fixture.sourcePath };
  const file = writeFixtureFile(fixturesRoot, location, fixture.content);
  const blobSha = computeGitBlobSha(fixture.content);
  writeManifest(fixturesRoot, [{ ...location, blob_sha: blobSha }]);
  return { platformRoot, fixturesRoot, file, fixture, location, blobSha };
}

function guardPathFor(root: string): string {
  return path.join(root, "guard.ts");
}

describe("computeGitBlobSha", () => {
  it("coincide con `git hash-object` para un archivo real de content/", () => {
    const fixture = findRealFixtureWithCatalogToken();
    const expected = execFileSync(
      "git",
      ["hash-object", fixture.absolutePath],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).trim();

    expect(computeGitBlobSha(readFileSync(fixture.absolutePath))).toBe(
      expected,
    );
  });

  it("coincide con el SHA-1 canónico del blob vacío", () => {
    expect(computeGitBlobSha(Buffer.alloc(0))).toBe(
      "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
    );
  });
});

describe("Fixtures fuente verificables (AC-0.10)", () => {
  it("un fixture declarado y fiel a su blob_sha queda verificado y excluido del escaneo", () => {
    const { platformRoot, fixturesRoot, file, fixture } =
      setupVerifiedFixture("fx-ok-");

    const verification = verifySourceFixtures(fixturesRoot);
    expect(verification.violations).toEqual([]);
    expect(verification.verifiedFiles).toEqual([file]);

    const violations = scanDirectoryForCatalogTokens(
      platformRoot,
      guardPathFor(platformRoot),
    );
    expect(violations, formatCatalogViolations(violations)).toEqual([]);

    const control = scanDirectoryForCatalogTokens(
      platformRoot,
      guardPathFor(platformRoot),
      { fixturesRoot: path.join(platformRoot, "fixtures-inexistentes") },
    );
    expect(
      control.some(
        (violation) =>
          violation.kind === "catalog-name" &&
          violation.token === fixture.token,
      ),
      "el control debe detectar el token real del fixture cuando no hay exclusión",
    ).toBe(true);
  });

  it("un archivo bajo fixtures/source que no figura en el manifiesto falla", () => {
    const { platformRoot, fixturesRoot } = setupVerifiedFixture("fx-unlisted-");
    const stray = path.join(fixturesRoot, TEST_COMMIT, "content", "stray.bin");
    mkdirSync(path.dirname(stray), { recursive: true });
    writeFileSync(stray, Buffer.from([0x00, 0x01, 0x02]));

    const violations = scanDirectoryForCatalogTokens(
      platformRoot,
      guardPathFor(platformRoot),
    );
    const unlisted = violations.filter(
      (violation) => violation.kind === "fixture-unlisted",
    );

    expect(unlisted).toHaveLength(1);
    expect(unlisted[0]?.file).toBe(stray);
    expect(formatCatalogViolations(violations)).toContain(stray);
  });

  it("un fixture alterado en un byte no coincide con blob_sha y falla", () => {
    const { platformRoot, fixturesRoot, file, blobSha } =
      setupVerifiedFixture("fx-altered-");
    const bytes = readFileSync(file);
    const middle = Math.floor(bytes.length / 2);
    bytes[middle] = bytes[middle] ^ 0x01;
    writeFileSync(file, bytes);

    const verification = verifySourceFixtures(fixturesRoot);
    expect(verification.verifiedFiles).toEqual([]);
    expect(verification.violations).toEqual([
      expect.objectContaining({ kind: "fixture-modified", file }),
    ]);
    expect(verification.violations[0]?.message).toContain(blobSha);

    const violations = scanDirectoryForCatalogTokens(
      platformRoot,
      guardPathFor(platformRoot),
    );
    expect(
      violations.some((violation) => violation.kind === "fixture-modified"),
    ).toBe(true);
  });

  it("una entrada del manifiesto sin archivo falla", () => {
    const platformRoot = createTemporaryRoot("fx-missing-");
    const fixturesRoot = path.join(platformRoot, "fixtures", "source");
    const location = {
      commit: TEST_COMMIT,
      path: "content/contexts/ausente/README.md",
    };
    writeManifest(fixturesRoot, [{ ...location, blob_sha: "0".repeat(40) }]);

    const expectedFile = path.join(
      fixturesRoot,
      location.commit,
      ...location.path.split("/"),
    );
    const verification = verifySourceFixtures(fixturesRoot);
    expect(verification.verifiedFiles).toEqual([]);
    expect(verification.violations).toEqual([
      expect.objectContaining({ kind: "fixture-missing", file: expectedFile }),
    ]);

    const violations = scanDirectoryForCatalogTokens(
      platformRoot,
      guardPathFor(platformRoot),
    );
    expect(
      violations.some((violation) => violation.kind === "fixture-missing"),
    ).toBe(true);
  });

  it.each(["../evil.md", "/absolute.md", "content//x.md", "content\\x.md", ""])(
    "un manifiesto con path inválido (%j) falla",
    (invalidPath) => {
      const platformRoot = createTemporaryRoot("fx-badpath-");
      const fixturesRoot = path.join(platformRoot, "fixtures", "source");
      const manifestPath = writeManifest(fixturesRoot, [
        {
          commit: TEST_COMMIT,
          path: invalidPath,
          blob_sha: "0".repeat(40),
        },
      ]);

      const result = parseSourceFixtureManifest(
        readFileSync(manifestPath, "utf8"),
      );
      expect(result.ok).toBe(false);

      const verification = verifySourceFixtures(fixturesRoot);
      expect(verification.verifiedFiles).toEqual([]);
      expect(verification.violations[0]).toMatchObject({
        kind: "manifest-invalid",
      });
      expect(verification.violations[0]?.message).toContain("path");
    },
  );

  it("rechaza manifiestos con repository incorrecto, duplicados o campos faltantes", () => {
    const raw = JSON.stringify({
      repository: "otro/repositorio",
      fixtures: [
        { commit: TEST_COMMIT, path: "content/a.md", blob_sha: "0".repeat(40) },
        { commit: TEST_COMMIT, path: "content/a.md", blob_sha: "0".repeat(40) },
        { commit: TEST_COMMIT, path: "content/b.md" },
      ],
    });

    const result = parseSourceFixtureManifest(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const messages = result.messages.join("\n");
      expect(messages).toContain("repository");
      expect(messages).toContain("duplica");
      expect(messages).toContain("blob_sha");
    }
  });

  it("rechaza JSON que no parsea o raíces que no son objeto", () => {
    expect(parseSourceFixtureManifest("{no-json").ok).toBe(false);
    expect(parseSourceFixtureManifest("[]").ok).toBe(false);
  });

  it("un manifiesto inválido no excluye ningún archivo (fail-closed)", () => {
    const platformRoot = createTemporaryRoot("fx-invalid-");
    const fixturesRoot = path.join(platformRoot, "fixtures", "source");
    const fixture = findRealFixtureWithCatalogToken();
    const file = writeFixtureFile(
      fixturesRoot,
      { commit: TEST_COMMIT, path: fixture.sourcePath },
      fixture.content,
    );
    writeManifest(fixturesRoot, [
      {
        commit: TEST_COMMIT,
        path: "../fuera.md",
        blob_sha: computeGitBlobSha(fixture.content),
      },
    ]);

    const verification = verifySourceFixtures(fixturesRoot);
    expect(verification.verifiedFiles).toEqual([]);
    expect(verification.violations.map((violation) => violation.kind)).toEqual([
      "manifest-invalid",
      "fixture-unlisted",
    ]);
    expect(verification.violations[1]).toMatchObject({ file });
  });

  it("sin directorio de fixtures el guard se comporta como hasta ahora", () => {
    const platformRoot = createTemporaryRoot("fx-absent-");
    const fixture = findRealFixtureWithCatalogToken();
    const injected = path.join(platformRoot, "src", "injected.ts");
    mkdirSync(path.dirname(injected), { recursive: true });
    writeFileSync(injected, `const hardcoded = "${fixture.token}";\n`);

    expect(
      verifySourceFixtures(path.join(platformRoot, "fixtures", "source")),
    ).toEqual({ verifiedFiles: [], violations: [] });

    const violations = scanDirectoryForCatalogTokens(
      platformRoot,
      guardPathFor(platformRoot),
    );
    expect(violations).toEqual([
      expect.objectContaining({
        kind: "catalog-name",
        token: fixture.token,
        line: 1,
        file: path.relative(REPO_ROOT, injected),
      }),
    ]);
  });

  it("si falta el manifiesto, los archivos existentes son no declarados", () => {
    const platformRoot = createTemporaryRoot("fx-nomanifest-");
    const fixturesRoot = path.join(platformRoot, "fixtures", "source");
    const file = writeFixtureFile(
      fixturesRoot,
      { commit: TEST_COMMIT, path: "nota.md" },
      "contenido neutro\n",
    );

    const verification = verifySourceFixtures(fixturesRoot);
    expect(verification.verifiedFiles).toEqual([]);
    expect(verification.violations).toEqual([
      expect.objectContaining({ kind: "fixture-unlisted", file }),
    ]);
  });

  it("un archivo solo se excluye bajo el commit declarado", () => {
    const platformRoot = createTemporaryRoot("fx-commit-");
    const fixturesRoot = path.join(platformRoot, "fixtures", "source");
    const fixture = findRealFixtureWithCatalogToken();
    const file = writeFixtureFile(
      fixturesRoot,
      { commit: OTHER_COMMIT, path: fixture.sourcePath },
      fixture.content,
    );
    writeManifest(fixturesRoot, [
      {
        commit: TEST_COMMIT,
        path: fixture.sourcePath,
        blob_sha: computeGitBlobSha(fixture.content),
      },
    ]);

    const verification = verifySourceFixtures(fixturesRoot);
    expect(verification.verifiedFiles).toEqual([]);
    expect(verification.violations.map((violation) => violation.kind)).toEqual([
      "fixture-unlisted",
      "fixture-missing",
    ]);
    expect(verification.violations[0]).toMatchObject({ file });
  });
});
