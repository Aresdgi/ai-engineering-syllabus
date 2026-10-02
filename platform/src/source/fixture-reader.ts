/**
 * `FixtureSourceReader` (M1-W4): implementación de `SourceReader` que sirve
 * los fixtures reales de `platform/fixtures/source/` (ADR-009) sin red.
 *
 * Permite testear la orquestación de ingesta (AC-1.1..AC-1.13) contra
 * contenido verbatim del repositorio fuente, sin GitHub ni Supabase. Los paths
 * se derivan del manifiesto en runtime, nunca de literales del catálogo.
 *
 * El reader presenta el commit del manifiesto, o el `commitSha` que inyecte el
 * test para simular un commit nuevo. Los fallos se inyectan de forma explícita
 * (`fileOverrides`, `transformTree`, errores de repo/commit/árbol) y los bytes
 * servidos son siempre los del fixture real salvo que el test pida lo
 * contrario: nunca se inventa contenido educativo.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseSourceFixtureManifest,
  type SourceFixtureManifest,
} from "./fixtures";
import { SourceReaderError } from "./github/errors";
import {
  SOURCE_DEFAULT_REPOSITORY,
  SOURCE_REPOSITORY_NAME,
  SOURCE_REPOSITORY_OWNER,
  type ResolvedSourceCommit,
  type SourceBlobSha,
  type SourceCommitSha,
  type SourcePath,
  type SourceReader,
  type SourceRepositoryDescriptor,
  type SourceTree,
  type SourceTreeBlobEntry,
} from "./types";

export const FIXTURE_READER_DEFAULT_BRANCH = "main";

const DEFAULT_FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/source",
);

/**
 * Sustitución de un fixture para tests:
 * - `bytes` sirve bytes alternativos (el test decide si el `blob_sha` del
 *   árbol sigue siendo el del manifiesto —mismatch— o el calculado).
 * - `error` hace que `readFile` lance ese error (fallo inyectado).
 */
export type FixtureFileOverride =
  | Readonly<{ bytes: Uint8Array; treeBlobSha?: SourceBlobSha }>
  | Readonly<{ error: Error }>;

export type FixtureSourceReaderOptions = Readonly<{
  /** Raíz de fixtures; por defecto `platform/fixtures/source`. */
  fixturesRoot?: string;
  /** Overrides del descriptor de repositorio servido. */
  repository?: Partial<SourceRepositoryDescriptor>;
  defaultBranch?: string;
  /** Commit servido; por defecto el del manifiesto. */
  commitSha?: SourceCommitSha;
  committedAt?: string | null;
  /** Mapa `ref -> commit` para `resolveCommit`; por defecto la default branch. */
  refs?: Readonly<Record<string, SourceCommitSha>>;
  /** Transforma el árbol (p. ej. `truncated: true` o un `blobSha` alterado). */
  transformTree?: (tree: SourceTree) => SourceTree;
  fileOverrides?: ReadonlyMap<SourcePath, FixtureFileOverride>;
  repositoryError?: Error;
  commitError?: Error;
  treeError?: Error;
}>;

type LoadedFixtures = Readonly<{
  manifest: SourceFixtureManifest;
  bytesByPath: ReadonlyMap<SourcePath, Uint8Array>;
}>;

export class FixtureSourceReader implements SourceReader {
  private readonly fixturesRoot: string;

  private readonly repository: SourceRepositoryDescriptor;

  private readonly commitSha: SourceCommitSha;

  private readonly committedAt: string | null;

  private readonly refs: Readonly<Record<string, SourceCommitSha>>;

  private readonly transformTree:
    | ((tree: SourceTree) => SourceTree)
    | undefined;

  private readonly fileOverrides: ReadonlyMap<SourcePath, FixtureFileOverride>;

  private readonly repositoryError: Error | undefined;

  private readonly commitError: Error | undefined;

  private readonly treeError: Error | undefined;

  private loaded: LoadedFixtures | null = null;

  constructor(options: FixtureSourceReaderOptions = {}) {
    this.fixturesRoot = options.fixturesRoot ?? DEFAULT_FIXTURES_ROOT;
    const defaultBranch =
      options.defaultBranch ?? FIXTURE_READER_DEFAULT_BRANCH;
    const overrides = options.repository ?? {};
    this.repository = {
      owner: overrides.owner ?? SOURCE_REPOSITORY_OWNER,
      name: overrides.name ?? SOURCE_REPOSITORY_NAME,
      canonicalUrl:
        overrides.canonicalUrl ??
        `https://github.com/${SOURCE_DEFAULT_REPOSITORY}`,
      defaultBranch: overrides.defaultBranch ?? defaultBranch,
    };
    const manifest = this.loadFixtures().manifest;
    this.commitSha = options.commitSha ?? manifest.fixtures[0]?.commit ?? "";
    this.committedAt = options.committedAt ?? null;
    this.refs = options.refs ?? {};
    this.transformTree = options.transformTree;
    this.fileOverrides = options.fileOverrides ?? new Map();
    this.repositoryError = options.repositoryError;
    this.commitError = options.commitError;
    this.treeError = options.treeError;
  }

  async getRepository(): Promise<SourceRepositoryDescriptor> {
    if (this.repositoryError) {
      throw this.repositoryError;
    }
    return this.repository;
  }

  async resolveCommit(ref: string): Promise<ResolvedSourceCommit> {
    if (this.commitError) {
      throw this.commitError;
    }
    const normalizedRef = ref.trim();
    if (normalizedRef === "") {
      throw new SourceReaderError({
        kind: "commit-resolution-failed",
        message: "el ref está vacío",
      });
    }
    return {
      sha: this.refs[normalizedRef] ?? this.commitSha,
      committedAt: this.committedAt,
    };
  }

  async getTree(commitSha: SourceCommitSha): Promise<SourceTree> {
    if (this.treeError) {
      throw this.treeError;
    }
    const tree = this.buildTree(commitSha.trim().toLowerCase());
    return this.transformTree ? this.transformTree(tree) : tree;
  }

  async readFile(
    commitSha: SourceCommitSha,
    sourcePath: SourcePath,
  ): Promise<Uint8Array> {
    const normalizedSha = commitSha.trim().toLowerCase();
    if (normalizedSha !== this.commitSha) {
      throw new SourceReaderError({
        kind: "file-read-failed",
        message: `el FixtureSourceReader solo sirve el commit ${this.commitSha} (recibido ${commitSha})`,
      });
    }

    const override = this.fileOverrides.get(sourcePath);
    if (override) {
      if ("error" in override) {
        throw override.error;
      }
      return new Uint8Array(override.bytes);
    }

    const bytes = this.loadFixtures().bytesByPath.get(sourcePath);
    if (!bytes) {
      throw new SourceReaderError({
        kind: "file-read-failed",
        message: `el fixture "${sourcePath}" no está declarado en ${this.fixturesRoot}/manifest.json`,
      });
    }
    return new Uint8Array(bytes);
  }

  private buildTree(commitSha: SourceCommitSha): SourceTree {
    const { manifest, bytesByPath } = this.loadFixtures();
    const entries: SourceTreeBlobEntry[] = manifest.fixtures
      .map((fixture) => {
        const override = this.fileOverrides.get(fixture.path);
        const bytes =
          override && "bytes" in override
            ? override.bytes
            : (bytesByPath.get(fixture.path) ?? new Uint8Array());
        const treeBlobSha =
          override && "bytes" in override && override.treeBlobSha !== undefined
            ? override.treeBlobSha
            : fixture.blob_sha;
        const entry: SourceTreeBlobEntry = {
          type: "blob",
          path: fixture.path,
          blobSha: treeBlobSha,
          size: bytes.byteLength,
          mode: "100644",
        };
        return entry;
      })
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { commitSha, truncated: false, entries };
  }

  private loadFixtures(): LoadedFixtures {
    if (this.loaded) {
      return this.loaded;
    }
    const manifestPath = path.join(this.fixturesRoot, "manifest.json");
    const parsed = parseSourceFixtureManifest(
      readFileSync(manifestPath, "utf8"),
    );
    if (!parsed.ok) {
      throw new Error(
        `fixtures/source/manifest.json inválido: ${parsed.messages.join("; ")}`,
      );
    }
    const bytesByPath = new Map<SourcePath, Uint8Array>();
    for (const fixture of parsed.manifest.fixtures) {
      const absolutePath = path.join(
        this.fixturesRoot,
        fixture.commit,
        ...fixture.path.split("/"),
      );
      bytesByPath.set(fixture.path, new Uint8Array(readFileSync(absolutePath)));
    }
    this.loaded = { manifest: parsed.manifest, bytesByPath };
    return this.loaded;
  }
}
