/**
 * Acceso a GitHub para la captura fiel (plan §3.3):
 *
 * - Se fija el commit de `main` consultado (`GET /repos/<owner>/<repo>/commits/main`)
 *   y se descarga con `raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>`.
 * - Las URLs `github.com/<owner>/<repo>/blob/<ref>/<path>?raw=true` (las que
 *   traen el Markdown y la API del registro) se normalizan a `raw`.
 * - Las referencias al MISMO repositorio del que se capturó el Markdown se
 *   reescriben al commit pinneado (contenido estable); las de otros repos
 *   conservan su ref literal.
 */

import type { HttpClient } from "./http";
import { RobotsDeniedError, type RobotsGate } from "./robots";

export type GithubFileLocation = Readonly<{
  owner: string;
  repo: string;
  ref: string;
  path: string;
  /** De dónde salió la URL: `blob` (github.com) o `raw`. */
  source: "blob" | "raw";
}>;

const RAW_URL_PATTERN =
  /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)$/i;

const BLOB_URL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i;

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

const REF_PREFIXES = ["refs/heads/", "refs/tags/"] as const;

/** Separa `<ref>/<path>` admitiendo refs con `/` (`refs/heads/…`, `refs/tags/…`). */
function splitRefAndPath(
  remainder: string,
): { ref: string; path: string } | null {
  for (const prefix of REF_PREFIXES) {
    if (remainder.startsWith(prefix)) {
      const rest = remainder.slice(prefix.length);
      const separator = rest.indexOf("/");
      if (separator === -1) {
        return null;
      }
      return {
        ref: `${prefix}${rest.slice(0, separator)}`,
        path: rest.slice(separator + 1),
      };
    }
  }
  const separator = remainder.indexOf("/");
  if (separator === -1) {
    return null;
  }
  return {
    ref: remainder.slice(0, separator),
    path: remainder.slice(separator + 1),
  };
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parsea una URL de fichero de GitHub (`blob` o `raw`); `null` si no lo es.
 * La query (`?raw=true`) se descarta: el fichero se pide por `raw`.
 */
export function parseGithubFileUrl(rawUrl: string): GithubFileLocation | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const withoutQuery = `${parsed.origin}${parsed.pathname}`;
  const match =
    BLOB_URL_PATTERN.exec(withoutQuery) ?? RAW_URL_PATTERN.exec(withoutQuery);
  if (!match) {
    return null;
  }
  const owner = match[1] ?? "";
  const repo = match[2] ?? "";
  const remainder = match[3] ?? "";
  const split = splitRefAndPath(remainder);
  if (split === null) {
    return null;
  }
  const path = split.path.split("/").map(decodePathSegment).join("/");
  if (owner === "" || repo === "" || path === "") {
    return null;
  }
  return {
    owner,
    repo,
    ref: split.ref,
    path,
    source: BLOB_URL_PATTERN.test(withoutQuery) ? "blob" : "raw",
  };
}

/** URL `raw.githubusercontent.com` de una ubicación (sin query). */
export function rawGithubUrl(location: GithubFileLocation): string {
  return `https://raw.githubusercontent.com/${location.owner}/${location.repo}/${location.ref}/${location.path}`;
}

/** Normaliza a URL `raw` (blob → raw); `null` si la URL no es de GitHub. */
export function normalizeGithubDownloadUrl(rawUrl: string): string | null {
  const location = parseGithubFileUrl(rawUrl);
  return location === null ? null : rawGithubUrl(location);
}

/** Fija la ref al commit dado si la URL apunta al repositorio indicado. */
export function pinGithubUrl(
  rawUrl: string,
  pin: Readonly<{ owner: string; repo: string; commit: string }>,
): string {
  const location = parseGithubFileUrl(rawUrl);
  if (location === null) {
    return rawUrl;
  }
  const sameRepo =
    location.owner.toLowerCase() === pin.owner.toLowerCase() &&
    location.repo.toLowerCase() === pin.repo.toLowerCase();
  if (!sameRepo) {
    return rawGithubUrl(location);
  }
  return rawGithubUrl({ ...location, ref: pin.commit });
}

export type GithubDownload = Readonly<{
  location: GithubFileLocation;
  url: string;
  status: number;
  bytes: Uint8Array;
  text: string;
}>;

export type GithubClientOptions = Readonly<{
  robots?: RobotsGate;
  apiBaseUrl?: string;
}>;

export class GithubClient {
  private readonly apiBaseUrl: string;
  private readonly pinnedCommits = new Map<string, Promise<string>>();

  constructor(
    private readonly http: HttpClient,
    private readonly options: GithubClientOptions = {},
  ) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
  }

  /** Commit actual de la rama (memoizado por repositorio y rama). */
  pinBranchCommit(
    owner: string,
    repo: string,
    branch = "main",
  ): Promise<string> {
    const key = `${owner}/${repo}@${branch}`.toLowerCase();
    const cached = this.pinnedCommits.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const promise = this.fetchBranchCommit(owner, repo, branch);
    this.pinnedCommits.set(key, promise);
    return promise;
  }

  private async fetchBranchCommit(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string> {
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`;
    await this.assertRobotsAllowed(url);
    const response = await this.http.get(url, {
      accept: "application/vnd.github+json",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `GitHub respondió ${response.status} al fijar el commit de ${owner}/${repo}`,
      );
    }
    let payload: unknown;
    try {
      payload = JSON.parse(response.text);
    } catch {
      throw new Error(`GitHub devolvió JSON inválido para ${owner}/${repo}`);
    }
    const sha =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>).sha
        : null;
    if (typeof sha !== "string" || !COMMIT_SHA_PATTERN.test(sha)) {
      throw new Error(
        `GitHub no devolvió un SHA de commit válido para ${owner}/${repo}`,
      );
    }
    return sha.toLowerCase();
  }

  /** Descarga los bytes de un fichero en el commit/ref de su ubicación. */
  async downloadFile(location: GithubFileLocation): Promise<GithubDownload> {
    const url = rawGithubUrl(location);
    await this.assertRobotsAllowed(url);
    const response = await this.http.get(url, {
      accept: "text/plain, application/octet-stream",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`raw.githubusercontent.com respondió ${response.status}`);
    }
    return {
      location,
      url,
      status: response.status,
      bytes: response.bytes,
      text: response.text,
    };
  }

  private async assertRobotsAllowed(url: string): Promise<void> {
    const robots = this.options.robots;
    if (robots === undefined) {
      return;
    }
    const verdict = await robots.check(url);
    if (!verdict.allowed) {
      throw new RobotsDeniedError(url, verdict);
    }
  }
}
