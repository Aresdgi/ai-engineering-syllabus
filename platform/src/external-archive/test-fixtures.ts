/**
 * Utilidades solo-para-tests de los fixtures reales del archivo externo
 * (ADR-009): leen `platform/fixtures/external-archive/` verbatim y su
 * manifiesto (URL, fecha, sha256). Ningún test hace red real.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXTERNAL_ARCHIVE_FIXTURES_DIR = fileURLToPath(
  new URL("../../fixtures/external-archive", import.meta.url),
);

export const EXTERNAL_ARCHIVE_FIXTURES_MANIFEST = path.join(
  EXTERNAL_ARCHIVE_FIXTURES_DIR,
  "manifest.json",
);

export const KNOWLEDGE_BASE_REPOSITORY = {
  owner: "breatheco-de",
  name: "knowledge-base",
  defaultBranch: "main",
} as const;

export const KNOWLEDGE_BASE_COMMIT = "8f3c556fbe2dd7c3c129b4e000c642ff570a1b7a";

export type ExternalArchiveFixtureEntry = Readonly<{
  path: string;
  url: string;
  captured_at: string;
  byte_size: number;
  sha256: string;
}>;

export type ExternalArchiveFixtureManifest = Readonly<{
  repository: Readonly<{
    owner: string;
    name: string;
    commit: string;
    default_branch: string;
  }>;
  registry_base_url: string;
  files: readonly ExternalArchiveFixtureEntry[];
}>;

export function loadExternalArchiveFixtureManifest(): ExternalArchiveFixtureManifest {
  return JSON.parse(
    readFileSync(EXTERNAL_ARCHIVE_FIXTURES_MANIFEST, "utf8"),
  ) as ExternalArchiveFixtureManifest;
}

export function fixturePath(relativePath: string): string {
  return path.join(EXTERNAL_ARCHIVE_FIXTURES_DIR, relativePath);
}

export function fixtureBytes(relativePath: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(readFileSync(fixturePath(relativePath)));
}

export function fixtureText(relativePath: string): string {
  return readFileSync(fixturePath(relativePath), "utf8");
}

export function registryFixtureRelativePath(slug: string): string {
  return path.posix.join("registry", `${slug}.json`);
}

export function markdownFixtureRelativePath(fileName: string): string {
  return path.posix.join(
    "knowledge-base",
    KNOWLEDGE_BASE_COMMIT,
    "content",
    fileName,
  );
}
