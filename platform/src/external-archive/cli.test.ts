// @vitest-environment node
/**
 * Integración del CLI con PGlite y fetch inyectado (cero red real).
 *
 * El corpus que se siembra es el `content/` real del repo (899 archivos, 779
 * textuales), el mismo del snapshot auditado; así se afirman los totales de §2
 * y los `sha256` de §3.3 con los tres Markdown reales pinneados en
 * `platform/fixtures/external-archive/`.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { resolveSourceLanguage } from "../source/classify/paths";
import { sourceFiles } from "../source/store/schema";
import {
  createCourseTestDatabase,
  seedRepository,
  seedSnapshot,
} from "../course/test-database.test-helper";
import {
  formatExternalArchiveTextReport,
  runExternalArchiveCli,
  type ExternalArchiveCliReport,
  type ExternalArchiveDatabase,
} from "./cli";
import {
  INVENTORY_TEXT_EXTENSIONS,
  inventoryPathForDirectoryFile,
} from "./inventory";
import type { FetchLike } from "./http";
import {
  fixtureBytes,
  fixtureText,
  KNOWLEDGE_BASE_COMMIT,
  loadExternalArchiveFixtureManifest,
  registryFixtureRelativePath,
} from "./test-fixtures";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const CONTENT_DIR = path.join(REPO_ROOT, "content");

const FIXED_NOW = "2026-10-02T13:00:00.000Z";

const HASHES = {
  howToStartEn:
    "9261997020916708e1a9b7f88417a2a5baaacb49f654eb0e6a92126dde6b1a2e",
  howToStartEs:
    "5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f",
  codespaces:
    "a14968e4ad5c9991221370e9c9f6ae3c4f114c427b62d59fb5491ed7129734f6",
} as const;

const CANONICAL = {
  howToStartEn: "https://4geeks.com/lesson/how-to-start-a-project",
  howToStartEs:
    "https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion",
  howToStartEsSlug: "https://4geeks.com/es/lesson/how-to-start-a-project",
  comoComenzarBare:
    "https://4geeks.com/lesson/como-comenzar-un-proyecto-de-codificacion",
  codespaces: "https://4geeks.com/lesson/what-is-github-codespaces",
} as const;

const RETIRED = {
  comoIniciar:
    "https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion",
  howToStartCodingEs:
    "https://4geeks.com/es/lesson/how-to-start-a-coding-project",
  howToStartCodingEn: "https://4geeks.com/lesson/how-to-start-a-coding-project",
} as const;

function contentTextFiles(): string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        INVENTORY_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(fullPath);
      }
    }
  };
  walk(CONTENT_DIR);
  return files.sort();
}

async function seedSourceCorpus(
  db: Awaited<ReturnType<typeof createCourseTestDatabase>>["db"],
): Promise<void> {
  const repositoryId = await seedRepository(db);
  const snapshotId = await seedSnapshot(db, repositoryId, {
    status: "complete",
    importedAt: new Date("2026-10-02T12:13:49.515Z"),
  });
  const files = contentTextFiles();
  const knownPaths = new Set(
    files.map((file) => inventoryPathForDirectoryFile(CONTENT_DIR, file)),
  );
  const rows = files.map((file) => {
    const inventoryPath = inventoryPathForDirectoryFile(CONTENT_DIR, file);
    const { language, languageEvidence } = resolveSourceLanguage(
      inventoryPath,
      knownPaths,
    );
    return {
      snapshotId,
      path: inventoryPath,
      blobSha: "c".repeat(40),
      mediaType: "text/markdown",
      language,
      languageEvidence,
      rawContent: readFileSync(file, "utf8"),
      binaryReference: null,
    };
  });
  for (let index = 0; index < rows.length; index += 400) {
    await db.insert(sourceFiles).values(rows.slice(index, index + 400));
  }
}

async function countRows(client: PGlite, table: string): Promise<number> {
  const result = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${table}`,
  );
  return result.rows[0]?.n ?? 0;
}

type FixtureFetch = { fetch: FetchLike; calls: string[] };

function createCorpusFixtureFetch(): FixtureFetch {
  const manifest = loadExternalArchiveFixtureManifest();
  const markdownByUrl = new Map(
    manifest.files
      .filter(
        (file) =>
          file.path.endsWith(".md") &&
          file.url.includes(`/${KNOWLEDGE_BASE_COMMIT}/content/`),
      )
      .map((file) => [file.url, fixtureBytes(file.path)]),
  );
  const registryByPath = new Map(
    manifest.files
      .filter((file) => file.path.startsWith("registry/"))
      .map((file) => [file.path, fixtureText(file.path)]),
  );
  const imageA = fixtureBytes("images/github-exaplantion.png");
  const imageB = fixtureBytes("images/github-codespaces-explanation.png");
  const calls: string[] = [];

  const json = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    const url = new URL(input);

    if (url.pathname === "/robots.txt") {
      return new Response(null, { status: 404 });
    }

    if (url.hostname === "breathecode.herokuapp.com") {
      const match = /^\/v1\/registry\/asset\/([^/]+)$/.exec(url.pathname);
      const slug =
        match?.[1] === undefined ? null : decodeURIComponent(match[1]);
      const body =
        slug === null
          ? undefined
          : registryByPath.get(registryFixtureRelativePath(slug));
      return body === undefined
        ? new Response(null, { status: 404 })
        : json(JSON.parse(body));
    }

    if (
      url.hostname === "api.github.com" &&
      url.pathname === "/repos/breatheco-de/knowledge-base/commits/main"
    ) {
      return json({ sha: KNOWLEDGE_BASE_COMMIT });
    }

    const markdown = markdownByUrl.get(input);
    if (markdown !== undefined) {
      return new Response(markdown, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname.endsWith(".png")) {
      const sum = [...input].reduce(
        (total, character) => total + character.charCodeAt(0),
        0,
      );
      return new Response(sum % 2 === 0 ? imageA : imageB, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }

    if (
      url.hostname === "archive.org" &&
      url.pathname === "/wayback/available"
    ) {
      const requested = url.searchParams.get("url") ?? "";
      if (requested === "https://playground.4geeks.com/tracker/api/v1/docs") {
        return json({
          url: requested,
          archived_snapshots: {
            closest: {
              status: "200",
              available: true,
              url: `http://web.archive.org/web/20260613092255/${requested}`,
              timestamp: "20260613092255",
            },
          },
        });
      }
      return json({ url: requested, archived_snapshots: {} });
    }

    throw new Error(`fetch no mockeado en cli.test: ${input}`);
  };

  return { fetch: fetchImpl, calls };
}

function runCli(
  argv: readonly string[],
  deps: Parameters<typeof runExternalArchiveCli>[1],
): { exitCode: Promise<number>; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  const exitCode = runExternalArchiveCli(argv, {
    ...deps,
    stdout: (line) => lines.push(line),
    stderr: (line) => errors.push(line),
  });
  return { exitCode, lines, errors };
}

function parseJsonReport(lines: readonly string[]): Record<string, unknown> {
  return JSON.parse(lines.join("\n")) as Record<string, unknown>;
}

describe("archive:external (PGlite, sin red real)", () => {
  it("--dry-run --from-dir sin red reproduce los totales reales de §2 y 0 escrituras", async () => {
    const mock = createCorpusFixtureFetch();
    const run = runCli(
      ["--dry-run", "--from-dir", CONTENT_DIR, "--report", "json"],
      { fetch: mock.fetch, env: {} },
    );
    const exitCode = await run.exitCode;
    expect(exitCode).toBe(0);
    expect(mock.calls).toEqual([]);

    const report = parseJsonReport(run.lines);
    const inventory = report.inventory as Record<string, unknown>;
    expect(inventory.files).toBe(779);
    expect(inventory.occurrences).toBe(1543);
    expect(inventory.documents).toBe(180);
    expect(inventory.urls).toBe(127);
    expect(inventory.byHost).toEqual({
      "4geeks.com": 294,
      "4geeksacademy.com": 1143,
      "breathecode.herokuapp.com": 80,
      "diagram.4geeks.com": 14,
      "learn.4geeks.com": 4,
      "playground.4geeks.com": 8,
    });
    expect(inventory.byClass).toEqual({
      lesson: { occurrences: 122, urls: 8, documents: 84 },
      tool: { occurrences: 26, urls: 4, documents: 16 },
      marketing: { occurrences: 1315, urls: 37, documents: 174 },
      "out-of-scope": { occurrences: 80, urls: 78, documents: 80 },
    });
    expect(report.marketing).toMatchObject({ occurrences: 1315, urls: 37 });
    expect((report.lessons as Record<string, number>).alias).toBe(3);
    expect((report.lessons as Record<string, number>).planned).toBe(5);
    expect((report.tools as Record<string, number>).planned).toBe(4);
    expect(report.aliases).toEqual({
      applied: 0,
      planned: 3,
      skipped: 0,
      targets: [
        CANONICAL.howToStartEs,
        CANONICAL.howToStartEs,
        CANONICAL.howToStartEn,
      ],
    });
  });

  it("--dry-run imprime «alias: planificados 3» y no «aplicados» (T-03)", async () => {
    const mock = createCorpusFixtureFetch();
    const run = runCli(
      ["--dry-run", "--from-dir", CONTENT_DIR, "--report", "text"],
      { fetch: mock.fetch, env: {} },
    );
    expect(await run.exitCode).toBe(0);
    expect(mock.calls).toEqual([]);

    const output = run.lines.join("\n");
    expect(output).toContain("alias: planificados 3, omitidos 0");
    expect(output).not.toContain("alias: aplicados");
  });

  it("--dry-run --resolve valida con GETs pero no escribe nada", async () => {
    const { db, client } = await createCourseTestDatabase();
    try {
      await seedSourceCorpus(db);
      const mock = createCorpusFixtureFetch();
      const run = runCli(["--dry-run", "--resolve", "--report", "json"], {
        db: db as unknown as ExternalArchiveDatabase,
        fetch: mock.fetch,
        env: {},
        now: () => new Date(FIXED_NOW),
      });
      expect(await run.exitCode).toBe(0);

      const report = parseJsonReport(run.lines);
      expect(report.lessons).toMatchObject({
        captured: 5,
        alias: 3,
        unavailable: 0,
        errors: 0,
      });
      expect(report.tools).toMatchObject({
        captured: 1,
        unavailable: 3,
        errors: 0,
      });
      expect(report.assets).toEqual({
        inserted: 0,
        unchanged: 0,
        linked: 0,
        failed: 0,
      });
      expect(report.aliases).toMatchObject({ applied: 0, planned: 3 });

      expect(await countRows(client, "external_archive_items")).toBe(0);
      expect(await countRows(client, "external_archive_assets")).toBe(0);
      expect(await countRows(client, "external_archive_item_assets")).toBe(0);
      expect(await countRows(client, "source_files")).toBe(779);

      expect(mock.calls.length).toBeGreaterThan(0);
      const requestedHosts = mock.calls.map((call) => new URL(call).hostname);
      expect(requestedHosts).not.toContain("learn.4geeks.com");
      expect(requestedHosts).not.toContain("4geeks.com");
    } finally {
      await client.close();
    }
  });

  it("captura real idempotente: inserta, luego todo unchanged y captured_at intacto", async () => {
    const { db, client } = await createCourseTestDatabase();
    try {
      await seedSourceCorpus(db);
      const sourceFilesBefore = await countRows(client, "source_files");
      const snapshotsBefore = await countRows(client, "source_snapshots");

      const firstMock = createCorpusFixtureFetch();
      const first = runCli(["--report", "json"], {
        db: db as unknown as ExternalArchiveDatabase,
        fetch: firstMock.fetch,
        env: {},
        now: () => new Date(FIXED_NOW),
      });
      expect(await first.exitCode).toBe(0);
      expect(first.errors).toEqual([]);

      const firstReport = parseJsonReport(first.lines);
      expect(firstReport.lessons).toMatchObject({
        captured: 5,
        inserted: 5,
        updated: 0,
        unchanged: 0,
        alias: 3,
        errors: 0,
      });
      expect(firstReport.tools).toMatchObject({
        captured: 1,
        inserted: 1,
        unavailable: 3,
        updated: 0,
        unchanged: 0,
        errors: 0,
      });
      expect(firstReport.assets).toMatchObject({ inserted: 2, failed: 0 });
      expect(firstReport.aliases).toMatchObject({ applied: 3, planned: 0 });
      expect(
        formatExternalArchiveTextReport(
          firstReport as unknown as ExternalArchiveCliReport,
        ),
      ).toContain("alias: aplicados 3, omitidos 0");

      // Contenido literal: sha256 de los 3 Markdown de §3.3.
      const stored = await client.query<{
        canonical_url: string;
        content_sha256: string | null;
        status: string;
        method: string;
        alias_of_canonical_url: string | null;
        content: string | null;
        captured_at: string;
      }>(
        "SELECT canonical_url, content_sha256, status, method, alias_of_canonical_url, content, captured_at::text AS captured_at FROM external_archive_items ORDER BY canonical_url",
      );
      const byUrl = new Map(stored.rows.map((row) => [row.canonical_url, row]));
      expect(byUrl.get(CANONICAL.howToStartEn)?.content_sha256).toBe(
        HASHES.howToStartEn,
      );
      expect(byUrl.get(CANONICAL.howToStartEsSlug)?.content_sha256).toBe(
        HASHES.howToStartEs,
      );
      expect(byUrl.get(CANONICAL.howToStartEs)?.content_sha256).toBe(
        HASHES.howToStartEs,
      );
      expect(byUrl.get(CANONICAL.comoComenzarBare)?.content_sha256).toBe(
        HASHES.howToStartEs,
      );
      expect(byUrl.get(CANONICAL.codespaces)?.content_sha256).toBe(
        HASHES.codespaces,
      );

      // Alias del usuario (§8.3): sin contenido propio y apuntando al destino.
      for (const [from, to] of [
        [RETIRED.comoIniciar, CANONICAL.howToStartEs],
        [RETIRED.howToStartCodingEs, CANONICAL.howToStartEs],
        [RETIRED.howToStartCodingEn, CANONICAL.howToStartEn],
      ] as const) {
        const alias = byUrl.get(from);
        expect(alias).toMatchObject({
          status: "alias",
          method: "user-alias",
          alias_of_canonical_url: to,
          content: null,
        });
      }

      // Herramientas: solo metadata Wayback.
      const tools = stored.rows.filter(
        (row) => !row.canonical_url.includes("/lesson/"),
      );
      expect(tools).toHaveLength(4);
      const playground = tools.find((row) =>
        row.canonical_url.includes("/tracker/api/v1/docs"),
      );
      const playgroundDetail = await client.query<{
        wayback_url: string | null;
        wayback_captured_at: string | null;
        wayback_http_status: number | null;
        status: string;
      }>(
        "SELECT wayback_url, wayback_captured_at::text AS wayback_captured_at, wayback_http_status, status FROM external_archive_items WHERE canonical_url LIKE '%tracker/api/v1/docs'",
      );
      expect(playground).toBeDefined();
      expect(playgroundDetail.rows[0]?.status).toBe("captured");
      expect(playgroundDetail.rows[0]?.wayback_url).toBe(
        "http://web.archive.org/web/20260613092255/https://playground.4geeks.com/tracker/api/v1/docs",
      );
      expect(
        new Date(
          playgroundDetail.rows[0]?.wayback_captured_at ?? 0,
        ).toISOString(),
      ).toBe("2026-06-13T09:22:55.000Z");
      expect(playgroundDetail.rows[0]?.wayback_http_status).toBe(200);

      expect(await countRows(client, "external_archive_items")).toBe(12);
      expect(await countRows(client, "external_archive_assets")).toBe(2);
      expect(await countRows(client, "external_archive_item_assets")).toBe(33);
      expect(await countRows(client, "external_archive_items")).toBe(12);

      // Marketing nunca entra en la base.
      const marketing = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM external_archive_items WHERE host = '4geeksacademy.com'",
      );
      expect(marketing.rows[0]?.n).toBe(0);

      // Aislamiento SOURCE.
      expect(await countRows(client, "source_files")).toBe(sourceFilesBefore);
      expect(await countRows(client, "source_snapshots")).toBe(snapshotsBefore);

      const capturedAtBefore = byUrl.get(CANONICAL.howToStartEn)?.captured_at;

      // Segunda ejecución: mismo contenido ⇒ 0 cambios y captured_at intacto.
      const secondMock = createCorpusFixtureFetch();
      const second = runCli(["--report", "json"], {
        db: db as unknown as ExternalArchiveDatabase,
        fetch: secondMock.fetch,
        env: {},
        now: () => new Date("2026-10-03T09:30:00.000Z"),
      });
      expect(await second.exitCode).toBe(0);
      const secondReport = parseJsonReport(second.lines);
      expect(secondReport.lessons).toMatchObject({
        captured: 5,
        inserted: 0,
        updated: 0,
        unchanged: 5,
        alias: 3,
        errors: 0,
      });
      expect(secondReport.tools).toMatchObject({
        captured: 1,
        inserted: 0,
        updated: 0,
        unchanged: 1,
        unavailable: 3,
        errors: 0,
      });
      expect(secondReport.assets).toMatchObject({
        inserted: 0,
        failed: 0,
        linked: 33,
      });
      expect(secondReport.aliases).toMatchObject({ applied: 3, planned: 0 });
      expect(await countRows(client, "external_archive_items")).toBe(12);
      expect(await countRows(client, "external_archive_assets")).toBe(2);

      const capturedAtAfter = await client.query<{ captured_at: string }>(
        "SELECT captured_at::text AS captured_at FROM external_archive_items WHERE canonical_url = $1",
        [CANONICAL.howToStartEn],
      );
      expect(capturedAtAfter.rows[0]?.captured_at).toBe(capturedAtBefore);
      expect(await countRows(client, "source_files")).toBe(sourceFilesBefore);
    } finally {
      await client.close();
    }
  });

  it("falla con error claro si un destino de alias no existe en el inventario", async () => {
    const temporaryDir = os.tmpdir();
    const aliasesPath = path.join(
      temporaryDir,
      `aliases-invalidos-${process.pid}-${Date.now()}.json`,
    );
    writeFileSync(
      aliasesPath,
      JSON.stringify({
        decidedBy: "user",
        decidedAt: "2026-10-02",
        reason: "prueba",
        aliases: [
          {
            from: RETIRED.comoIniciar,
            to: "https://4geeks.com/lesson/leccion-que-no-existe-en-el-inventario",
          },
        ],
      }),
    );
    try {
      const run = runCli(
        ["--dry-run", "--from-dir", CONTENT_DIR, "--report", "json"],
        { env: {}, aliasesPath },
      );
      expect(await run.exitCode).toBe(2);
      expect(run.errors.join("\n")).toContain("no existe en el inventario");
    } finally {
      rmSync(aliasesPath, { force: true });
    }
  });

  it("--only lessons --limit 1 inserta una sola lección", async () => {
    const { db, client } = await createCourseTestDatabase();
    try {
      await seedSourceCorpus(db);
      const mock = createCorpusFixtureFetch();
      const run = runCli(
        ["--only", "lessons", "--limit", "1", "--report", "json"],
        {
          db: db as unknown as ExternalArchiveDatabase,
          fetch: mock.fetch,
          env: {},
          now: () => new Date(FIXED_NOW),
        },
      );
      expect(await run.exitCode).toBe(0);
      expect(await countRows(client, "external_archive_items")).toBe(1);

      // El corpus fan-out de imágenes del mock no debe pedir learn.4geeks.com.
      const requestedHosts = mock.calls.map((call) => new URL(call).hostname);
      expect(requestedHosts).not.toContain("learn.4geeks.com");
    } finally {
      await client.close();
    }
  });
});
