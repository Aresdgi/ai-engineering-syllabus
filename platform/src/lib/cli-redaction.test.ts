// @vitest-environment node
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import type { IngestSnapshotResult } from "../source/ingest/ingest";

const state = vi.hoisted(() => ({
  pgliteImported: false,
  pgliteDrizzleImported: false,
  pgliteMigratorImported: false,
  result: null as unknown,
  thrown: null as unknown,
}));

vi.mock("@electric-sql/pglite", () => {
  state.pgliteImported = true;
  return {
    PGlite: class {
      close(): Promise<void> {
        return Promise.resolve();
      }
    },
  };
});

vi.mock("drizzle-orm/pglite", () => {
  state.pgliteDrizzleImported = true;
  return { drizzle: () => ({ dialect: "pglite" }) };
});

vi.mock("drizzle-orm/pglite/migrator", () => {
  state.pgliteMigratorImported = true;
  return { migrate: async () => undefined };
});

vi.mock("../source/github/reader", () => ({
  createGithubSourceReader: () => ({ mocked: true }),
}));

vi.mock("../source/ingest/ingest", () => ({
  ingestSnapshot: async () => {
    if (state.thrown !== null) {
      throw state.thrown;
    }
    return state.result;
  },
}));

const COMMIT = "a".repeat(40);

function buildResult(messages: readonly string[]): IngestSnapshotResult {
  return {
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
        total: 1,
        text: 1,
        binary: 0,
        byRoot: { projects: 1, contexts: 0, lessons: 0 },
      },
      indexes: { projects: 1, contexts: 0, lessons: 0 },
      errors: messages.length,
    },
    errors: messages.map((message) => ({
      snapshotId: "snapshot-1",
      sourcePath: "content/projects/sample/README.md",
      errorKind: "file-read-failed",
      message,
      detail: null,
    })),
    startedAt: "2026-10-02T10:00:00.000Z",
    finishedAt: "2026-10-02T10:00:01.000Z",
    durationMs: 1000,
  };
}

function captureThrow(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("la función no lanzó");
}

function capturedOutput(spy: MockInstance): string {
  return spy.mock.calls.map((call) => call.join(" ")).join("\n");
}

describe("runIngestCli — redacción y carga diferida de PGlite (F-01, F-08)", () => {
  beforeEach(() => {
    vi.resetModules();
    state.pgliteImported = false;
    state.pgliteDrizzleImported = false;
    state.pgliteMigratorImported = false;
    state.result = null;
    state.thrown = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("en modo real no carga PGlite y redacta las credenciales del summary", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const databaseUrl = "postgresql://app:real-db-secret@127.0.0.1:1/postgres";
    const githubToken = "ghp_realToken123";
    state.result = buildResult([
      `no se pudo leer ${databaseUrl} con el token ${githubToken}`,
    ]);

    const { runIngestCli } = await import("../source/cli");
    const exitCode = await runIngestCli([], {
      DATABASE_URL: databaseUrl,
      GITHUB_TOKEN: githubToken,
    });

    expect(exitCode).toBe(1);
    const output = capturedOutput(log);
    expect(output).not.toContain("real-db-secret");
    expect(output).not.toContain(githubToken);
    expect(output).toContain("[redacted]");
    expect(errorLog).not.toHaveBeenCalled();
    expect(state.pgliteImported).toBe(false);
    expect(state.pgliteDrizzleImported).toBe(false);
    expect(state.pgliteMigratorImported).toBe(false);
  });

  it("redacta el summary JSON cuando un source_import_error contiene la URI", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const databaseUrl = "postgresql://app:json-db-secret@127.0.0.1:1/postgres";
    state.result = buildResult([`fallo contra ${databaseUrl}`]);

    const { runIngestCli } = await import("../source/cli");
    const exitCode = await runIngestCli(["--json"], {
      DATABASE_URL: databaseUrl,
    });

    expect(exitCode).toBe(1);
    const output = capturedOutput(log);
    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain("json-db-secret");
    expect(output).toContain("[redacted]");
  });

  it("redacta el error del catch aunque la contraseña viva en input/cause", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const databaseUrl = "postgresql://app:throw-secret@";
    const cause = captureThrow(() => new URL(databaseUrl));
    state.thrown = new Error("no se pudo conectar", { cause });

    const { runIngestCli } = await import("../source/cli");
    const exitCode = await runIngestCli([], { DATABASE_URL: databaseUrl });

    expect(exitCode).toBe(2);
    const output = capturedOutput(errorLog);
    expect(output).toContain("no se pudo conectar");
    expect(output).toContain("ERR_INVALID_URL");
    expect(output).not.toContain("throw-secret");
  });

  it("en --dry-run sí carga PGlite mediante import() dinámico", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.result = buildResult([]);

    const { runIngestCli } = await import("../source/cli");
    const exitCode = await runIngestCli(["--dry-run"], {});

    expect(exitCode).toBe(1);
    expect(capturedOutput(log)).toContain("ingest (dry-run)");
    expect(state.pgliteImported).toBe(true);
    expect(state.pgliteDrizzleImported).toBe(true);
    expect(state.pgliteMigratorImported).toBe(true);
  });
});
