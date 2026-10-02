// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadFixtureTree } from "./fixture-tree.test-helper";
import {
  classifySourceMedia,
  containsNullByte,
  sourceExtension,
} from "./media";

const UTF8_BYTES = Uint8Array.from([0x23, 0x20, 0x74, 0x65, 0x78, 0x74]);

describe("sourceExtension", () => {
  it.each([
    ["content/projects/x/README.es.md", "md"],
    ["content/projects/x/IMAGE.PNG", "png"],
    ["content/contexts/x/.DS_Store", ""],
    ["content/lessons/x/slug", ""],
    ["content/contexts/x/archive.tar.gz", "gz"],
  ])("extrae la extensión de %s como %j", (sourcePath, expected) => {
    expect(sourceExtension(sourcePath)).toBe(expected);
  });
});

describe("containsNullByte", () => {
  it("detecta NUL y no falsos positivos", () => {
    expect(containsNullByte(Uint8Array.from([1, 2, 0, 3]))).toBe(true);
    expect(containsNullByte(UTF8_BYTES)).toBe(false);
  });
});

describe("classifySourceMedia", () => {
  it("mapea extensiones textuales conocidas sin bytes", () => {
    expect(classifySourceMedia("content/projects/x/README.md")).toEqual({
      mediaType: "text/markdown",
      isBinary: false,
    });
    expect(classifySourceMedia("content/projects/x/learn.json")).toEqual({
      mediaType: "application/json",
      isBinary: false,
    });
    expect(classifySourceMedia("content/contexts/x/data.csv")).toEqual({
      mediaType: "text/csv",
      isBinary: false,
    });
  });

  it("mapea extensiones binarias conocidas", () => {
    expect(classifySourceMedia("content/projects/x/preview.png")).toEqual({
      mediaType: "image/png",
      isBinary: true,
    });
    expect(classifySourceMedia("content/contexts/x/rfp.pdf")).toEqual({
      mediaType: "application/pdf",
      isBinary: true,
    });
  });

  it("un NUL en un formato textual fuerza octet-stream binario", () => {
    expect(
      classifySourceMedia(
        "content/projects/x/README.md",
        Uint8Array.from([0x23, 0x00, 0x23]),
      ),
    ).toEqual({ mediaType: "application/octet-stream", isBinary: true });
  });

  it("extensión desconocida o dotfile queda como octet-stream binario", () => {
    expect(
      classifySourceMedia("content/projects/x/.DS_Store", UTF8_BYTES),
    ).toEqual({ mediaType: "application/octet-stream", isBinary: true });
    expect(classifySourceMedia("content/projects/x/binary.bin")).toEqual({
      mediaType: "application/octet-stream",
      isBinary: true,
    });
  });

  it("clasifica los binarios reales de los fixtures", () => {
    const { fixturePaths, bytesByPath } = loadFixtureTree();
    const binaryFixture = fixturePaths.find(
      (fixturePath) =>
        fixturePath.endsWith(".png") || fixturePath.endsWith(".pdf"),
    );
    expect(
      binaryFixture,
      "el manifiesto debe incluir un binario real (.png o .pdf)",
    ).toBeDefined();
    const bytes = bytesByPath.get(binaryFixture as string);
    expect(bytes).toBeDefined();
    const classification = classifySourceMedia(
      binaryFixture as string,
      bytes as Uint8Array,
    );
    expect(classification.isBinary).toBe(true);
    expect(classification.mediaType).toMatch(/\/(png|pdf)$/);
  });
});
