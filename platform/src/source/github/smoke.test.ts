// @vitest-environment node
/**
 * Smoke REAL de solo lectura (M1-W2, aceptación observable).
 *
 * Está desactivado por defecto: solo se ejecuta con
 * `SOURCE_READER_SMOKE=1`. Hace 3 llamadas GET a la API de GitHub + 1 tarball
 * del commit, sin escribir nada ni persistir datos.
 *
 * Ejecución manual (con `GITHUB_TOKEN` opcional, p. ej. `gh auth token`):
 *
 * ```sh
 * SOURCE_READER_SMOKE=1 GITHUB_TOKEN=$(gh auth token) \
 *   npx --yes pnpm@12.8.1 --dir platform exec vitest run \
 *   src/source/github/smoke.test.ts
 * ```
 *
 * Verifica: repo → default branch → commit actual → árbol completo
 * (`truncated=false`) → nº de blobs bajo los tres roots → bytes de un archivo
 * del tarball comparados con el `blob_sha` del árbol.
 */

import { describe, expect, it } from "vitest";
import { computeGitBlobSha } from "../../test/source-fixtures";
import { SOURCE_CONTENT_ROOTS } from "../types";
import { createGithubSourceReader } from "./reader";

const smokeEnabled = process.env.SOURCE_READER_SMOKE === "1";
const smoke = smokeEnabled ? describe : describe.skip;

smoke("smoke real de solo lectura contra GitHub", () => {
  it("resuelve el commit de la default branch, lista el árbol y verifica un archivo del tarball", async () => {
    const reader = createGithubSourceReader({ rawFallback: false });

    const repository = await reader.getRepository();
    const commit = await reader.resolveCommit(repository.defaultBranch);
    const tree = await reader.getTree(commit.sha);

    expect(tree.truncated).toBe(false);
    expect(tree.entries.length).toBeGreaterThan(0);

    const blobs = tree.entries.filter((entry) => entry.type === "blob");
    const countsByRoot = SOURCE_CONTENT_ROOTS.map((root) => ({
      root,
      blobs: blobs.filter((entry) => entry.path.startsWith(`${root}/`)).length,
    }));
    expect(countsByRoot.every(({ blobs: count }) => count > 0)).toBe(true);

    const candidate = blobs.find(
      (entry) =>
        entry.path.startsWith("content/contexts/") &&
        entry.mode !== "120000" &&
        entry.size > 0 &&
        entry.size < 64_000,
    );
    if (!candidate) {
      throw new Error(
        "El árbol real no contiene ningún blob pequeño bajo content/contexts/ para el smoke",
      );
    }

    const bytes = await reader.readFile(commit.sha, candidate.path);
    const computedBlobSha = computeGitBlobSha(bytes);
    expect(computedBlobSha).toBe(candidate.blobSha);
    expect(bytes.byteLength).toBe(candidate.size);

    console.log(
      [
        "[smoke source-reader]",
        `repo=${repository.owner}/${repository.name}`,
        `defaultBranch=${repository.defaultBranch}`,
        `commit=${commit.sha}`,
        `committedAt=${commit.committedAt ?? "desconocida"}`,
        `entradas=${tree.entries.length}`,
        `blobs=${blobs.length}`,
        ...countsByRoot.map(
          ({ root, blobs: count }) => `${root}=${count} blobs`,
        ),
        `archivo=${candidate.path}`,
        `blobSha=${computedBlobSha}`,
        `bytes=${bytes.byteLength}`,
      ].join(" | "),
    );
  }, 180_000);
});
