// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateSourceFileContent } from "./files";
import type { SourceValidationContext } from "./paths";

const CONTEXT: SourceValidationContext = { snapshotId: "snapshot-test" };

const PATH = "content/projects/sample-project/README.md";

describe("validateSourceFileContent", () => {
  it("acepta texto (rawContent y binaryReference null)", () => {
    expect(
      validateSourceFileContent(
        { path: PATH, rawContent: "# hola", binaryReference: null },
        CONTEXT,
      ),
    ).toBeNull();
  });

  it("acepta binario (binaryReference y rawContent null)", () => {
    expect(
      validateSourceFileContent(
        {
          path: PATH,
          rawContent: null,
          binaryReference:
            "https://raw.githubusercontent.com/owner/repo/commit/README.md",
        },
        CONTEXT,
      ),
    ).toBeNull();
  });

  it("rechaza declarar las dos representaciones", () => {
    expect(
      validateSourceFileContent(
        { path: PATH, rawContent: "# hola", binaryReference: "https://x" },
        CONTEXT,
      ),
    ).toEqual({
      snapshotId: "snapshot-test",
      sourcePath: PATH,
      errorKind: "file-decode-failed",
      message: expect.stringContaining("a la vez"),
      detail: null,
    });
  });

  it("rechaza no declarar ninguna representación", () => {
    expect(
      validateSourceFileContent(
        { path: PATH, rawContent: null, binaryReference: null },
        CONTEXT,
      ),
    ).toEqual({
      snapshotId: "snapshot-test",
      sourcePath: PATH,
      errorKind: "file-decode-failed",
      message: expect.stringContaining("ni rawContent ni binaryReference"),
      detail: null,
    });
  });
});
