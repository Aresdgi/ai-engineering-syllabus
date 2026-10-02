// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  invalidSourcePathReason,
  validateSourcePath,
  type SourceValidationContext,
} from "./paths";

const CONTEXT: SourceValidationContext = { snapshotId: "snapshot-test" };

describe("invalidSourcePathReason", () => {
  it.each([
    "",
    "   ",
    "a\\b.md",
    "/absolute.md",
    "C:\\absolute.md",
    "content/../escape.md",
    "content/./x.md",
    "content//x.md",
    "../x.md",
    "content/..",
  ])("rechaza %j", (sourcePath) => {
    expect(invalidSourcePathReason(sourcePath)).not.toBeNull();
  });

  it.each([
    "content/projects/sample-project/README.md",
    "content/contexts/sample-context/CONTEXT-acme.es.md",
    "content/lessons/sample-lesson/sample-lesson.md",
    "content/projects/sample-project/.learn/preview.png",
    "content",
  ])("acepta %j", (sourcePath) => {
    expect(invalidSourcePathReason(sourcePath)).toBeNull();
  });
});

describe("validateSourcePath", () => {
  it("devuelve null para un path posix relativo válido", () => {
    expect(
      validateSourcePath("content/projects/sample-project/README.md", CONTEXT),
    ).toBeNull();
  });

  it("devuelve el error a registrar (sin lanzar) para un path inválido", () => {
    expect(validateSourcePath("../escape.md", CONTEXT)).toEqual({
      snapshotId: "snapshot-test",
      sourcePath: "../escape.md",
      errorKind: "file-read-failed",
      message: expect.stringContaining("path inválido"),
      detail: null,
    });
  });

  it("usa sourcePath null para el path vacío", () => {
    const error = validateSourcePath("", CONTEXT);
    expect(error?.sourcePath).toBeNull();
    expect(error?.errorKind).toBe("file-read-failed");
  });
});
