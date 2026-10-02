// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseIngestArgs } from "./options";

describe("parseIngestArgs", () => {
  it("sin argumentos usa los defaults y el modo real", () => {
    expect(parseIngestArgs([])).toEqual({
      ok: true,
      options: {
        repo: null,
        ref: null,
        commit: null,
        dryRun: false,
        json: false,
        help: false,
      },
    });
  });

  it("acepta flags con valor separado y con '='", () => {
    expect(
      parseIngestArgs([
        "--repo=4GeeksAcademy/ai-engineering-syllabus",
        "--ref",
        "main",
        "--commit",
        "a".repeat(40),
        "--dry-run",
        "--json",
      ]),
    ).toEqual({
      ok: true,
      options: {
        repo: "4GeeksAcademy/ai-engineering-syllabus",
        ref: "main",
        commit: "a".repeat(40),
        dryRun: true,
        json: true,
        help: false,
      },
    });
  });

  it("reconoce --help y -h", () => {
    expect(parseIngestArgs(["--help"])).toMatchObject({
      ok: true,
      options: { help: true },
    });
    expect(parseIngestArgs(["-h"])).toMatchObject({
      ok: true,
      options: { help: true },
    });
  });

  it("rechaza opciones desconocidas y valores ausentes sin lanzar", () => {
    expect(parseIngestArgs(["--modo-rapido"])).toEqual({
      ok: false,
      message: 'opción desconocida "--modo-rapido"',
    });
    expect(parseIngestArgs(["--ref"])).toEqual({
      ok: false,
      message: "falta el valor de --ref",
    });
    expect(parseIngestArgs(["--repo", "--json"])).toEqual({
      ok: false,
      message: "falta el valor de --repo",
    });
  });
});
