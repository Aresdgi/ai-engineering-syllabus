// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SOURCE_DEFAULT_REPOSITORY } from "../types";
import {
  CommitResolutionError,
  RepositoryResolutionError,
  SourceReaderConfigError,
  TreeReadError,
  TreeTruncatedError,
} from "./errors";
import {
  GithubSourceReader,
  createGithubSourceReader,
  type GithubSourceReaderConfig,
} from "./reader";
import {
  createFetchMock,
  headerValue,
  jsonResponse,
  rateLimitHeaders,
} from "./test-helpers";

const OWNER = "sample-owner";
const REPO_NAME = "sample-repo";
const REPO = `${OWNER}/${REPO_NAME}`;
const COMMIT_SHA = "b".repeat(40);
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO_NAME}`;

function createReader(
  handler: Parameters<typeof createFetchMock>[0],
  config: Partial<GithubSourceReaderConfig> = {},
) {
  const mock = createFetchMock(handler);
  const reader = new GithubSourceReader({
    repo: REPO,
    fetchImpl: mock.fetchImpl,
    ...config,
  });
  return { reader, ...mock };
}

describe("GithubSourceReader: configuración del repo (AC-1.1)", () => {
  it("usa el repo por defecto del contrato cuando no se configura nada", async () => {
    const { reader, calls } = createReader(
      () => jsonResponse({ default_branch: "main" }),
      { repo: undefined },
    );

    await reader.getRepository();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://api.github.com/repos/${SOURCE_DEFAULT_REPOSITORY}`,
    );
  });

  it("el parámetro repo tiene prioridad sobre el entorno", async () => {
    const mock = createFetchMock(() =>
      jsonResponse({ default_branch: "main" }),
    );
    const reader = createGithubSourceReader(
      { repo: REPO, fetchImpl: mock.fetchImpl },
      { GITHUB_REPO: "env-owner/env-repo" },
    );

    await reader.getRepository();

    expect(reader.repository).toBe(REPO);
    expect(mock.calls[0]?.url).toBe(`${API_ROOT}`);
  });

  it("acepta GITHUB_REPO del entorno vía createGithubSourceReader", async () => {
    const mock = createFetchMock(() =>
      jsonResponse({ default_branch: "main" }),
    );
    const reader = createGithubSourceReader(
      { fetchImpl: mock.fetchImpl },
      { GITHUB_REPO: ` ${REPO} ` },
    );

    await reader.getRepository();

    expect(reader.repository).toBe(REPO);
    expect(mock.calls[0]?.url).toBe(`${API_ROOT}`);
  });

  it("rechaza un slug de repo inválido con error tipado", () => {
    expect(() => new GithubSourceReader({ repo: "solo-owner" })).toThrow(
      SourceReaderConfigError,
    );
    expect(
      () => new GithubSourceReader({ repo: `${OWNER}//${REPO_NAME}` }),
    ).toThrow(SourceReaderConfigError);
  });

  it("rechaza owner/name con caracteres fuera de [A-Za-z0-9._-]", () => {
    for (const repo of ["owner!/repo", "owner/re po", "owner/repo@main"]) {
      expect(() => new GithubSourceReader({ repo }), repo).toThrow(
        SourceReaderConfigError,
      );
    }
  });

  it('rechaza "." y ".." como owner o name', () => {
    for (const repo of ["./repo", "../repo", "owner/.", "owner/.."]) {
      expect(() => new GithubSourceReader({ repo }), repo).toThrow(
        SourceReaderConfigError,
      );
    }
  });

  it("identifica el segmento inválido en el mensaje", () => {
    expect(() => new GithubSourceReader({ repo: "owner!/repo" })).toThrow(
      /"owner" solo admite/,
    );
    expect(() => new GithubSourceReader({ repo: "owner/repo!" })).toThrow(
      /"name" solo admite/,
    );
    expect(() => new GithubSourceReader({ repo: "owner/.." })).toThrow(
      /"name" no puede ser/,
    );
  });

  it("acepta owner/name con punto, guion y guion bajo", () => {
    const reader = new GithubSourceReader({
      repo: "owner.name-1/repo_name-2",
    });
    expect(reader.repository).toBe("owner.name-1/repo_name-2");
  });
});

describe("GithubSourceReader: token (AC-1.1)", () => {
  it("añade Authorization Bearer solo cuando hay token", async () => {
    const withToken = createReader(
      () => jsonResponse({ default_branch: "main" }),
      { token: "secret-token-value" },
    );
    await withToken.reader.getRepository();
    expect(headerValue(withToken.calls[0]!, "authorization")).toBe(
      "Bearer secret-token-value",
    );

    const withoutToken = createReader(() =>
      jsonResponse({ default_branch: "main" }),
    );
    await withoutToken.reader.getRepository();
    expect(headerValue(withoutToken.calls[0]!, "authorization")).toBeNull();
  });

  it("lee GITHUB_TOKEN del entorno y un token null explícito lo desactiva", async () => {
    const mock = createFetchMock(() =>
      jsonResponse({ default_branch: "main" }),
    );
    const fromEnv = createGithubSourceReader(
      { repo: REPO, fetchImpl: mock.fetchImpl },
      { GITHUB_TOKEN: "env-token" },
    );
    await fromEnv.getRepository();
    expect(headerValue(mock.calls[0]!, "authorization")).toBe(
      "Bearer env-token",
    );

    const mockNull = createFetchMock(() =>
      jsonResponse({ default_branch: "main" }),
    );
    const optedOut = createGithubSourceReader(
      { repo: REPO, fetchImpl: mockNull.fetchImpl, token: null },
      { GITHUB_TOKEN: "env-token" },
    );
    await optedOut.getRepository();
    expect(headerValue(mockNull.calls[0]!, "authorization")).toBeNull();
  });

  it("nunca filtra el token en el mensaje de error", async () => {
    const { reader } = createReader(
      () =>
        jsonResponse({ message: "Not Found" }, { status: 404, headers: {} }),
      { token: "super-secret-token" },
    );

    await expect(reader.getRepository()).rejects.toThrow(
      /no se pudo resolver el repositorio/,
    );
    await reader.getRepository().catch((error: unknown) => {
      expect(error).toBeInstanceOf(RepositoryResolutionError);
      expect((error as Error).message).not.toContain("super-secret-token");
    });
  });
});

describe("GithubSourceReader: getRepository (AC-1.2)", () => {
  it("devuelve el descriptor con default branch y URL canónica", async () => {
    const { reader } = createReader(() =>
      jsonResponse({
        full_name: REPO,
        default_branch: "main",
        html_url: `https://github.com/${REPO}`,
      }),
    );

    await expect(reader.getRepository()).resolves.toEqual({
      owner: OWNER,
      name: REPO_NAME,
      canonicalUrl: `https://github.com/${REPO}`,
      defaultBranch: "main",
    });
  });

  it("convierte un 404 en RepositoryResolutionError tipado", async () => {
    const { reader } = createReader(() =>
      jsonResponse(
        { message: "Not Found" },
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    const error = await reader.getRepository().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(RepositoryResolutionError);
    const typed = error as RepositoryResolutionError;
    expect(typed.kind).toBe("repository-resolution-failed");
    expect(typed.status).toBe(404);
    expect(typed.url).toBe(API_ROOT);
    expect(typed.message).toContain("Not Found");
  });

  it("convierte un fallo de red en RepositoryResolutionError con causa", async () => {
    const { reader } = createReader(() => {
      throw new TypeError("fetch failed");
    });

    const error = await reader.getRepository().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(RepositoryResolutionError);
    const typed = error as RepositoryResolutionError;
    expect(typed.status).toBeNull();
    expect(typed.cause).toBeInstanceOf(TypeError);
    expect(typed.message).toContain("error de red");
  });

  it("falla con error tipado si la respuesta no es JSON o no trae default_branch", async () => {
    const notJson = createReader(
      () => new Response("<html>error</html>", { status: 200 }),
    );
    await expect(notJson.reader.getRepository()).rejects.toBeInstanceOf(
      RepositoryResolutionError,
    );

    const missing = createReader(() => jsonResponse({ full_name: REPO }));
    await expect(missing.reader.getRepository()).rejects.toBeInstanceOf(
      RepositoryResolutionError,
    );
  });
});

describe("GithubSourceReader: resolveCommit (AC-1.3)", () => {
  it("resuelve un ref de rama a SHA completo + fecha", async () => {
    const { reader, calls } = createReader(() =>
      jsonResponse({
        sha: COMMIT_SHA,
        commit: { committer: { date: "2026-09-29T10:48:26Z" } },
      }),
    );

    await expect(reader.resolveCommit("main")).resolves.toEqual({
      sha: COMMIT_SHA,
      committedAt: "2026-09-29T10:48:26Z",
    });
    expect(calls[0]?.url).toBe(`${API_ROOT}/commits/main`);
  });

  it("acepta un commit SHA explícito (pinneado)", async () => {
    const { reader, calls } = createReader(() =>
      jsonResponse({
        sha: COMMIT_SHA,
        commit: { committer: { date: "2026-09-29T10:48:26Z" } },
      }),
    );

    await expect(reader.resolveCommit(COMMIT_SHA)).resolves.toEqual({
      sha: COMMIT_SHA,
      committedAt: "2026-09-29T10:48:26Z",
    });
    expect(calls[0]?.url).toBe(`${API_ROOT}/commits/${COMMIT_SHA}`);
  });

  it("codifica refs con barra para la URL de la API", async () => {
    const { reader, calls } = createReader(() =>
      jsonResponse({
        sha: COMMIT_SHA,
        commit: { committer: { date: "2026-09-29T10:48:26Z" } },
      }),
    );

    await reader.resolveCommit("feature/pinned");

    expect(calls[0]?.url).toBe(`${API_ROOT}/commits/feature%2Fpinned`);
  });

  it("usa la fecha del autor si no hay la del committer", async () => {
    const { reader } = createReader(() =>
      jsonResponse({
        sha: COMMIT_SHA,
        commit: { author: { date: "2026-01-02T03:04:05Z" } },
      }),
    );

    await expect(reader.resolveCommit("main")).resolves.toEqual({
      sha: COMMIT_SHA,
      committedAt: "2026-01-02T03:04:05Z",
    });
  });

  it("falla con CommitResolutionError si el SHA no es válido o el ref está vacío", async () => {
    const invalid = createReader(() => jsonResponse({ sha: "no-es-un-sha" }));
    await expect(invalid.reader.resolveCommit("main")).rejects.toBeInstanceOf(
      CommitResolutionError,
    );

    const empty = createReader(() => jsonResponse({}));
    await expect(empty.reader.resolveCommit("   ")).rejects.toBeInstanceOf(
      CommitResolutionError,
    );
    expect(empty.calls).toHaveLength(0);
  });
});

describe("GithubSourceReader: getTree (AC-1.4)", () => {
  const treePayload = {
    sha: COMMIT_SHA,
    truncated: false,
    tree: [
      { path: "content", mode: "040000", type: "tree", sha: "a".repeat(40) },
      {
        path: "content/projects/synthetic-project/README.md",
        mode: "100644",
        type: "blob",
        sha: "1".repeat(40),
        size: 12,
      },
      {
        path: "content/projects/synthetic-project/run.sh",
        mode: "100755",
        type: "blob",
        sha: "2".repeat(40),
        size: 3,
      },
      {
        path: "content/projects/synthetic-project/link.md",
        mode: "120000",
        type: "blob",
        sha: "3".repeat(40),
        size: 7,
      },
      {
        path: "vendor/nested",
        mode: "160000",
        type: "commit",
        sha: "4".repeat(40),
      },
    ],
  };

  it("mapea blobs (incluido symlink) y referencias tree/commit", async () => {
    const { reader, calls } = createReader(() => jsonResponse(treePayload));

    await expect(reader.getTree(COMMIT_SHA)).resolves.toEqual({
      commitSha: COMMIT_SHA,
      truncated: false,
      entries: [
        {
          type: "tree",
          path: "content",
          objectSha: "a".repeat(40),
          mode: "040000",
        },
        {
          type: "blob",
          path: "content/projects/synthetic-project/README.md",
          blobSha: "1".repeat(40),
          size: 12,
          mode: "100644",
        },
        {
          type: "blob",
          path: "content/projects/synthetic-project/run.sh",
          blobSha: "2".repeat(40),
          size: 3,
          mode: "100755",
        },
        {
          type: "blob",
          path: "content/projects/synthetic-project/link.md",
          blobSha: "3".repeat(40),
          size: 7,
          mode: "120000",
        },
        {
          type: "commit",
          path: "vendor/nested",
          objectSha: "4".repeat(40),
          mode: "160000",
        },
      ],
    });
    expect(calls[0]?.url).toBe(
      `${API_ROOT}/git/trees/${COMMIT_SHA}?recursive=1`,
    );
  });

  it("falla con TreeTruncatedError cuando truncated=true (nunca en silencio)", async () => {
    const { reader } = createReader(() =>
      jsonResponse({ truncated: true, tree: treePayload.tree }),
    );

    const error = await reader
      .getTree(COMMIT_SHA)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(TreeTruncatedError);
    const typed = error as TreeTruncatedError;
    expect(typed.kind).toBe("tree-truncated");
    expect(typed.entryCount).toBe(treePayload.tree.length);
    expect(typed.message).toContain("truncado");
  });

  it("falla con TreeReadError si truncated no está declarado como false o tree no es array", async () => {
    const missingFlag = createReader(() =>
      jsonResponse({ tree: treePayload.tree }),
    );
    await expect(missingFlag.reader.getTree(COMMIT_SHA)).rejects.toBeInstanceOf(
      TreeReadError,
    );

    const missingTree = createReader(() => jsonResponse({ truncated: false }));
    await expect(missingTree.reader.getTree(COMMIT_SHA)).rejects.toBeInstanceOf(
      TreeReadError,
    );
  });

  it("falla con TreeReadError ante entradas malformadas o modos desconocidos", async () => {
    const unknownMode = createReader(() =>
      jsonResponse({
        truncated: false,
        tree: [
          {
            path: "content/projects/synthetic-project/file.bin",
            mode: "100777",
            type: "blob",
            sha: "1".repeat(40),
            size: 1,
          },
        ],
      }),
    );
    await expect(unknownMode.reader.getTree(COMMIT_SHA)).rejects.toBeInstanceOf(
      TreeReadError,
    );

    const missingSize = createReader(() =>
      jsonResponse({
        truncated: false,
        tree: [
          {
            path: "content/projects/synthetic-project/file.md",
            mode: "100644",
            type: "blob",
            sha: "1".repeat(40),
          },
        ],
      }),
    );
    await expect(missingSize.reader.getTree(COMMIT_SHA)).rejects.toBeInstanceOf(
      TreeReadError,
    );
  });

  it("expone el rate limit agotado (403) con mensaje útil y sin reintentos", async () => {
    const { reader, calls } = createReader(() =>
      jsonResponse(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: rateLimitHeaders({
            limit: 60,
            remaining: 0,
            resetEpochSeconds: 1_800_000_000,
          }),
        },
      ),
    );

    const error = await reader
      .getTree(COMMIT_SHA)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(TreeReadError);
    const typed = error as TreeReadError;
    expect(typed.status).toBe(403);
    expect(typed.rateLimit?.remaining).toBe(0);
    expect(typed.rateLimit?.limit).toBe(60);
    expect(typed.rateLimit?.resetAt).toBe(
      new Date(1_800_000_000 * 1000).toISOString(),
    );
    expect(typed.message).toContain("rate limit");
    expect(calls).toHaveLength(1);
  });

  it("cachea el árbol por SHA de commit (inmutable) y no repite la llamada", async () => {
    const { reader, calls } = createReader(() => jsonResponse(treePayload));

    const first = await reader.getTree(COMMIT_SHA);
    const second = await reader.getTree(COMMIT_SHA);

    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
  });

  it("no cachea un árbol fallido: el siguiente intento vuelve a llamar", async () => {
    let attempt = 0;
    const { reader, calls } = createReader(() => {
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse({ message: "Server Error" }, { status: 500 });
      }
      return jsonResponse(treePayload);
    });

    await expect(reader.getTree(COMMIT_SHA)).rejects.toBeInstanceOf(
      TreeReadError,
    );
    await expect(reader.getTree(COMMIT_SHA)).resolves.toMatchObject({
      commitSha: COMMIT_SHA,
    });
    expect(calls).toHaveLength(2);
  });
});
