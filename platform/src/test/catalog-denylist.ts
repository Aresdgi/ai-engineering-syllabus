import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLATFORM_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const REPO_ROOT = path.resolve(PLATFORM_ROOT, "..");

export const CONTENT_ROOT = path.join(REPO_ROOT, "content");

const CATALOG_BUCKETS = ["projects", "lessons", "contexts"] as const;

type CatalogBucket = (typeof CATALOG_BUCKETS)[number];

const MIN_TOKEN_LENGTH = 5;

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
]);

const EXCLUDED_DIRECTORIES = new Set(["node_modules", ".next", "coverage"]);

const EXCLUDED_FILES = new Set(["pnpm-lock.yaml"]);

const SEPARATOR_RUN_PATTERN = /[_\s]+/g;

const REPEATED_HYPHEN_PATTERN = /-{2,}/g;

export type CatalogToken = {
  token: string;
  source: string;
};

export type CatalogViolation = {
  file: string;
  line: number;
  token: string;
  source: string;
};

export function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .replace(SEPARATOR_RUN_PATTERN, "-")
    .replace(REPEATED_HYPHEN_PATTERN, "-");
}

function listDirectories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function listFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeContextToken(fileName: string): string {
  return path
    .basename(fileName)
    .toLowerCase()
    .replace(/^context-/, "")
    .replace(/\.(?:es|en)?\.?md$/, "");
}

function isEligibleToken(token: string): boolean {
  return token.length >= MIN_TOKEN_LENGTH && !/^\d+$/.test(token);
}

export function collectCatalogTokens(
  contentRoot: string = CONTENT_ROOT,
): CatalogToken[] {
  if (!existsSync(contentRoot)) {
    throw new Error(
      `Guard AC-0.10: no existe "${contentRoot}". Este guard requiere el fork completo con content/ para construir la denylist; falla de forma explícita (fail-closed) en lugar de pasar en vacío.`,
    );
  }

  const tokens = new Map<string, string>();
  const bucketContributions = new Map<CatalogBucket, number>();
  for (const bucket of CATALOG_BUCKETS) {
    bucketContributions.set(bucket, 0);
  }

  const addToken = (raw: string, source: string, bucket: CatalogBucket) => {
    const token = normalizeCatalogText(raw.trim());
    if (!isEligibleToken(token) || tokens.has(token)) {
      return;
    }
    tokens.set(token, source);
    bucketContributions.set(bucket, (bucketContributions.get(bucket) ?? 0) + 1);
  };

  for (const bucket of CATALOG_BUCKETS) {
    const bucketDir = path.join(contentRoot, bucket);
    if (!existsSync(bucketDir)) {
      throw new Error(
        `Guard AC-0.10: falta "content/${bucket}" en el corpus. Este guard requiere content/{projects,lessons,contexts}; falla de forma explícita (fail-closed).`,
      );
    }
    for (const name of listDirectories(bucketDir)) {
      addToken(name, path.posix.join("content", bucket, name), bucket);
    }
  }

  const contextsDir = path.join(contentRoot, "contexts");
  for (const file of listFilesRecursively(contextsDir)) {
    const baseName = path.basename(file);
    if (!/^context-.*\.md$/i.test(baseName)) {
      continue;
    }
    addToken(
      normalizeContextToken(baseName),
      path.relative(REPO_ROOT, file),
      "contexts",
    );
  }

  for (const bucket of CATALOG_BUCKETS) {
    if ((bucketContributions.get(bucket) ?? 0) === 0) {
      throw new Error(
        `Guard AC-0.10: el bucket "content/${bucket}" no aporta ningún token elegible a la denylist (corpus vacío o regresado). Este guard falla de forma explícita (fail-closed) en lugar de escanear con una denylist incompleta.`,
      );
    }
  }

  return [...tokens.entries()].map(([token, source]) => ({ token, source }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenPattern(token: string): RegExp {
  return new RegExp(`(?<![a-z0-9-])${escapeRegExp(token)}(?![a-z0-9-])`, "i");
}

function listScannableFiles(dir: string, guardFilePath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...listScannableFiles(fullPath, guardFilePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (EXCLUDED_FILES.has(entry.name) || fullPath === guardFilePath) {
      continue;
    }
    if (!SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

export function scanDirectoryForCatalogTokens(
  scanRoot: string,
  guardFilePath: string,
  contentRoot: string = CONTENT_ROOT,
): CatalogViolation[] {
  const tokens = collectCatalogTokens(contentRoot).map((entry) => ({
    ...entry,
    pattern: tokenPattern(entry.token),
  }));

  const violations: CatalogViolation[] = [];
  for (const file of listScannableFiles(scanRoot, guardFilePath)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const normalized = normalizeCatalogText(line);
      for (const { token, source, pattern } of tokens) {
        if (pattern.test(normalized)) {
          violations.push({
            file: path.relative(REPO_ROOT, file),
            line: index + 1,
            token,
            source,
          });
        }
      }
    });
  }
  return violations;
}

export function scanForHardcodedCatalog(
  guardFilePath: string,
): CatalogViolation[] {
  return scanDirectoryForCatalogTokens(PLATFORM_ROOT, guardFilePath);
}

export function formatCatalogViolations(
  violations: CatalogViolation[],
): string {
  return [
    `Se detectaron ${violations.length} nombres del catálogo del syllabus hardcodeados en platform/:`,
    ...violations.map(
      ({ file, line, token, source }) =>
        `  - ${file}:${line} contiene "${token}" (origen en el repo: ${source})`,
    ),
    "",
    "Los nombres del syllabus solo pueden llegar a la UI mediante la ingesta del repositorio (Hito 1+), nunca como literales en el código de la app.",
  ].join("\n");
}
