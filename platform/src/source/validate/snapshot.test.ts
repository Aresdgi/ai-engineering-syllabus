// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeGitBlobSha } from "../../test/source-fixtures";
import type { SourceTree } from "../types";
import type { SourceValidationContext } from "./paths";
import { validateBlobContent, validateSourceTree } from "./snapshot";

const CONTEXT: SourceValidationContext = { snapshotId: "snapshot-test" };

const PATH = "content/projects/sample-project/README.md";

function tree(truncated: boolean): SourceTree {
  return {
    commitSha: "0".repeat(40),
    truncated,
    entries: [
      {
        type: "blob",
        path: PATH,
        blobSha: "a".repeat(40),
        size: 1,
        mode: "100644",
      },
    ],
  };
}

describe("validateSourceTree", () => {
  it("acepta un árbol completo", () => {
    expect(validateSourceTree(tree(false), CONTEXT)).toBeNull();
  });

  it("devuelve tree-truncated (sin lanzar) si el árbol llegó truncado", () => {
    const error = validateSourceTree(tree(true), CONTEXT);
    expect(error).toEqual({
      snapshotId: "snapshot-test",
      sourcePath: null,
      errorKind: "tree-truncated",
      message: expect.stringContaining("truncado"),
      detail: { commitSha: "0".repeat(40), entryCount: 1 },
    });
  });
});

describe("validateBlobContent", () => {
  const content = Uint8Array.from([0x23, 0x20, 0x68, 0x6f, 0x6c, 0x61]);
  const expectedBlobSha = computeGitBlobSha(content);

  it("acepta bytes cuyo hash coincide con el blob del árbol", () => {
    expect(
      validateBlobContent(
        { path: PATH, blobSha: expectedBlobSha },
        content,
        CONTEXT,
      ),
    ).toBeNull();
  });

  it("devuelve file-hash-mismatch (sin lanzar) cuando el blob no coincide", () => {
    const wrongBlobSha = "0".repeat(40);
    expect(
      validateBlobContent(
        { path: PATH, blobSha: wrongBlobSha },
        content,
        CONTEXT,
      ),
    ).toEqual({
      snapshotId: "snapshot-test",
      sourcePath: PATH,
      errorKind: "file-hash-mismatch",
      message: expect.stringContaining(wrongBlobSha),
      detail: {
        expectedBlobSha: wrongBlobSha,
        computedBlobSha: expectedBlobSha,
      },
    });
  });
});
