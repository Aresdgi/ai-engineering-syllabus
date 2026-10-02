// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { IngestSnapshotResult } from "./ingest";
import { buildIngestJsonSummary, formatIngestHumanSummary } from "./summary";

const COMMIT = "a".repeat(40);

const RESULT: IngestSnapshotResult = {
  repository: {
    owner: "sample-org",
    name: "sample-repo",
    canonicalUrl: "https://github.com/sample-org/sample-repo",
    defaultBranch: "main",
  },
  ref: "main",
  commitSha: COMMIT,
  snapshot: {
    id: "snapshot-1",
    repositoryId: "repository-1",
    ref: "main",
    commitSha: COMMIT,
    importedAt: "2026-10-02T10:00:00.000Z",
    status: "complete_with_errors",
  },
  status: "complete_with_errors",
  noop: false,
  counts: {
    files: {
      total: 3,
      text: 2,
      binary: 1,
      byRoot: { projects: 2, contexts: 1, lessons: 0 },
    },
    indexes: { projects: 1, contexts: 1, lessons: 0 },
    errors: 1,
  },
  errors: [
    {
      snapshotId: "snapshot-1",
      sourcePath: "content/projects/sample/README.md",
      errorKind: "file-decode-failed",
      message: "no es UTF-8 válido",
      detail: null,
    },
  ],
  startedAt: "2026-10-02T10:00:00.000Z",
  finishedAt: "2026-10-02T10:00:01.000Z",
  durationMs: 1000,
};

describe("buildIngestJsonSummary", () => {
  it("produce un resumen JSON estable y sin secretos", () => {
    expect(buildIngestJsonSummary(RESULT, true)).toEqual({
      dryRun: true,
      repository: "sample-org/sample-repo",
      ref: "main",
      commit: COMMIT,
      snapshotId: "snapshot-1",
      status: "complete_with_errors",
      noop: false,
      files: {
        total: 3,
        text: 2,
        binary: 1,
        byRoot: { projects: 2, contexts: 1, lessons: 0 },
      },
      indexes: { projects: 1, contexts: 1, lessons: 0 },
      errorCount: 1,
      errors: [
        {
          path: "content/projects/sample/README.md",
          kind: "file-decode-failed",
          message: "no es UTF-8 válido",
        },
      ],
      startedAt: "2026-10-02T10:00:00.000Z",
      finishedAt: "2026-10-02T10:00:01.000Z",
      durationMs: 1000,
    });
  });

  it("un no-op no tiene conteos pero conserva estado y snapshot", () => {
    const summary = buildIngestJsonSummary(
      { ...RESULT, noop: true, counts: null, status: "complete", errors: [] },
      false,
    );
    expect(summary.files).toBeNull();
    expect(summary.indexes).toBeNull();
    expect(summary.noop).toBe(true);
    expect(summary.errorCount).toBe(0);
  });
});

describe("formatIngestHumanSummary", () => {
  it("muestra conteos por root, estado, errores uno a uno y duración", () => {
    const text = formatIngestHumanSummary(RESULT, false);
    expect(text).toContain("estado=complete_with_errors");
    expect(text).toContain("archivos total=3 texto=2 binarios=1");
    expect(text).toContain("projects=2 contexts=1 lessons=0");
    expect(text).toContain("error[1] tipo=file-decode-failed");
    expect(text).toContain("duración 1000ms");
  });

  it("marca el no-op y el modo dry-run", () => {
    const text = formatIngestHumanSummary(
      { ...RESULT, noop: true, counts: null, errors: [] },
      true,
    );
    expect(text).toContain("ingest (dry-run)");
    expect(text).toContain("no-op");
  });
});
