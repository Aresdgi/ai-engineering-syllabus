// @vitest-environment node
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  SOURCE_CONTENT_ROOTS,
  SOURCE_DEFAULT_REPOSITORY,
  SOURCE_IMPORT_ERROR_KINDS,
  SOURCE_REPOSITORY_NAME,
  SOURCE_REPOSITORY_OWNER,
  SOURCE_SNAPSHOT_STATUSES,
} from "./types";
import type {
  NewSourceFile,
  NewSourceImportError,
  NewSourceProject,
  SourceFileContent,
  SourceLanguageAssignment,
  SourceSnapshotStatus,
  SourceTreeEntry,
} from "./types";

const BLOB_SHA = "0".repeat(40);

const FILE_BASE = {
  snapshotId: "snapshot-1",
  path: "content/projects/sample-project/README.es.md",
  blobSha: BLOB_SHA,
  mediaType: "text/markdown",
} as const;

describe("contrato SOURCE: constantes congeladas", () => {
  it("fija el repositorio por defecto", () => {
    expect(SOURCE_REPOSITORY_OWNER).toBe("4GeeksAcademy");
    expect(SOURCE_REPOSITORY_NAME).toBe("ai-engineering-syllabus");
    expect(SOURCE_DEFAULT_REPOSITORY).toBe(
      `${SOURCE_REPOSITORY_OWNER}/${SOURCE_REPOSITORY_NAME}`,
    );
  });

  it("fija los tres roots de contenido en orden", () => {
    expect(SOURCE_CONTENT_ROOTS).toEqual([
      "content/projects",
      "content/contexts",
      "content/lessons",
    ]);
  });

  it("congela los estados de snapshot", () => {
    expect(SOURCE_SNAPSHOT_STATUSES).toEqual([
      "importing",
      "complete",
      "complete_with_errors",
      "failed",
    ]);
  });

  it("congela los tipos de error de importación", () => {
    expect(SOURCE_IMPORT_ERROR_KINDS).toEqual([
      "repository-resolution-failed",
      "commit-resolution-failed",
      "tree-truncated",
      "tree-read-failed",
      "file-read-failed",
      "file-hash-mismatch",
      "file-decode-failed",
      "storage-write-failed",
      "unexpected-error",
    ]);
  });
});

describe("contrato SOURCE: invariantes de tipo", () => {
  it("SourceFileContent exige exactamente una representación de contenido", () => {
    expectTypeOf<{
      rawContent: string;
      binaryReference: null;
    }>().toMatchTypeOf<SourceFileContent>();
    expectTypeOf<{
      rawContent: null;
      binaryReference: string;
    }>().toMatchTypeOf<SourceFileContent>();
    expectTypeOf<{
      rawContent: string;
      binaryReference: string;
    }>().not.toMatchTypeOf<SourceFileContent>();
    expectTypeOf<{
      rawContent: null;
      binaryReference: null;
    }>().not.toMatchTypeOf<SourceFileContent>();
  });

  it("language solo admite su evidencia declarada", () => {
    expectTypeOf<{
      language: "es";
      languageEvidence: "suffix";
    }>().toMatchTypeOf<SourceLanguageAssignment>();
    expectTypeOf<{
      language: "en";
      languageEvidence: "suffix";
    }>().toMatchTypeOf<SourceLanguageAssignment>();
    expectTypeOf<{
      language: "en";
      languageEvidence: "pair-convention";
    }>().toMatchTypeOf<SourceLanguageAssignment>();
    expectTypeOf<{
      language: null;
      languageEvidence: null;
    }>().toMatchTypeOf<SourceLanguageAssignment>();
    expectTypeOf<{
      language: "es";
      languageEvidence: "pair-convention";
    }>().not.toMatchTypeOf<SourceLanguageAssignment>();
    expectTypeOf<{
      language: "es";
      languageEvidence: "en";
    }>().not.toMatchTypeOf<SourceLanguageAssignment>();
    expectTypeOf<{
      language: null;
      languageEvidence: "suffix";
    }>().not.toMatchTypeOf<SourceLanguageAssignment>();
  });

  it("el estado de snapshot es una unión cerrada", () => {
    expectTypeOf<"complete_with_errors">().toMatchTypeOf<SourceSnapshotStatus>();
    expectTypeOf<"done">().not.toMatchTypeOf<SourceSnapshotStatus>();
  });

  it("un blob del árbol siempre declara tamaño y blobSha", () => {
    expectTypeOf<{
      type: "blob";
      path: string;
      blobSha: string;
      size: number;
      mode: "100644";
    }>().toMatchTypeOf<SourceTreeEntry>();
    expectTypeOf<{
      type: "blob";
      path: string;
      blobSha: string;
      mode: "100644";
    }>().not.toMatchTypeOf<SourceTreeEntry>();
  });

  it("los registros válidos de M1 son construibles", () => {
    const textFile: NewSourceFile = {
      ...FILE_BASE,
      language: "es",
      languageEvidence: "suffix",
      rawContent: "# contenido de prueba",
      binaryReference: null,
    };
    const binaryFile: NewSourceFile = {
      ...FILE_BASE,
      path: "content/projects/sample-project/preview.png",
      mediaType: "image/png",
      language: null,
      languageEvidence: null,
      rawContent: null,
      binaryReference: `https://raw.githubusercontent.com/owner/repo/${BLOB_SHA}/content/projects/sample-project/preview.png`,
    };
    const englishFile: NewSourceFile = {
      ...FILE_BASE,
      path: "content/projects/sample-project/README.en.md",
      language: "en",
      languageEvidence: "suffix",
      rawContent: "# test content",
      binaryReference: null,
    };
    const pairedEnglishFile: NewSourceFile = {
      ...FILE_BASE,
      language: "en",
      languageEvidence: "pair-convention",
      rawContent: "# contenido de prueba",
      binaryReference: null,
    };
    const project: NewSourceProject = {
      snapshotId: FILE_BASE.snapshotId,
      sourcePath: "content/projects/sample-project",
      title: null,
      canonicalOrder: null,
      preferredReadmePath: FILE_BASE.path,
      metadata: { readmeBlobSha: BLOB_SHA },
      language: "es",
      languageEvidence: "suffix",
    };
    const importError: NewSourceImportError = {
      snapshotId: FILE_BASE.snapshotId,
      sourcePath: null,
      errorKind: "tree-truncated",
      message: "el árbol llegó truncado",
      detail: { entries: 100000 },
    };

    expect(textFile.rawContent).toBe("# contenido de prueba");
    expect(binaryFile.binaryReference).toContain("raw.githubusercontent.com");
    expect(englishFile.languageEvidence).toBe("suffix");
    expect(pairedEnglishFile.languageEvidence).toBe("pair-convention");
    expect(project.title).toBeNull();
    expect(project.canonicalOrder).toBeNull();
    expect(importError.errorKind).toBe("tree-truncated");
  });
});
