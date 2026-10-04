/**
 * Política `robots.txt` del CLI de archivo externo (plan §3.6 y §5.2):
 *
 * - Caché por host: se descarga `robots.txt` una vez por origen y ejecución; la
 *   evaluación de la ruta se hace por URL contra los grupos ya cacheados.
 * - La lista negra (`learn.4geeks.com`, `4geeks.com/api/*`) se resuelve ANTES
 *   de tocar la red: esos hosts nunca reciben ni siquiera el `robots.txt`.
 * - Fail-closed: si `robots.txt` no se puede leer (red/timeout/429/5xx) o el
 *   grupo aplicable prohíbe la ruta, la URL se omite.
 * - `robots.txt` ausente (404/410 y demás 4xx salvo 429) ⇒ sin restricciones
 *   declaradas (comportamiento observado en los hosts de este corpus).
 *
 * El parser entiende grupos `User-agent` consecutivos y reglas
 * `Allow`/`Disallow` con prefijo; no interpreta comodines `*`/`$` (ningún
 * `robots.txt` de este corpus los usa).
 */

import type { HttpClient } from "./http";
import { isBlockedUrl } from "./urls";

export type RobotsRule = Readonly<{ allow: boolean; path: string }>;

export type RobotsGroup = Readonly<{
  agents: readonly string[];
  rules: readonly RobotsRule[];
}>;

export type RobotsVerdict = Readonly<{
  allowed: boolean;
  reason: "allowed" | "disallowed" | "robots-unavailable" | "blocked";
  origin: string;
}>;

/** La URL no se puede pedir por robots.txt (o por lista negra). */
export class RobotsDeniedError extends Error {
  constructor(
    readonly url: string,
    readonly verdict: RobotsVerdict,
  ) {
    super(`robots.txt no permite pedir ${url} (${verdict.reason})`);
    this.name = "RobotsDeniedError";
  }
}

type RobotsDocument =
  | Readonly<{ kind: "rules"; groups: readonly RobotsGroup[] }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Parser mínimo del estándar de exclusión: grupos `User-agent` consecutivos,
 * reglas `Allow`/`Disallow` posteriores; las líneas de otros campos cierran el
 * bloque de agentes (como indica la especificación de Google).
 */
export function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line === "") {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!lastLineWasAgent || current === null) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    if (current !== null && (field === "allow" || field === "disallow")) {
      current.rules.push({ allow: field === "allow", path: value });
      lastLineWasAgent = false;
      continue;
    }
    lastLineWasAgent = false;
  }

  return groups;
}

function groupMatches(agentPattern: string, productToken: string): boolean {
  if (agentPattern === "*") {
    return false;
  }
  return productToken.toLowerCase().startsWith(agentPattern);
}

/**
 * Decide si una ruta está permitida para el product token dado. Reglas de la
 * especificación: gana la coincidencia de prefijo más larga y, en empate,
 * `Allow`; sin reglas aplicables, todo permitido.
 */
export function isPathAllowed(
  groups: readonly RobotsGroup[],
  pathname: string,
  productToken: string,
): boolean {
  const specific = groups.filter((group) =>
    group.agents.some((agent) => groupMatches(agent, productToken)),
  );
  const wildcard = groups.filter((group) => group.agents.includes("*"));
  const applicable = specific.length > 0 ? specific : wildcard;

  let bestLength = -1;
  let bestAllow = true;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.path === "") {
        continue;
      }
      if (!pathname.startsWith(rule.path)) {
        continue;
      }
      if (rule.path.length > bestLength) {
        bestLength = rule.path.length;
        bestAllow = rule.allow;
      } else if (rule.path.length === bestLength && rule.allow) {
        bestAllow = true;
      }
    }
  }
  return bestLength === -1 ? true : bestAllow;
}

export type RobotsGateOptions = Readonly<{
  productToken?: string;
}>;

export class RobotsGate {
  private readonly productToken: string;
  private readonly documents = new Map<string, Promise<RobotsDocument>>();

  constructor(
    private readonly http: HttpClient,
    options: RobotsGateOptions = {},
  ) {
    this.productToken =
      options.productToken ?? "ai-engineering-syllabus-external-archive";
  }

  /** Consulta (con caché por origen) si se puede pedir una URL concreta. */
  async check(url: string): Promise<RobotsVerdict> {
    if (isBlockedUrl(url)) {
      return {
        allowed: false,
        reason: "blocked",
        origin: safeOrigin(url) ?? url,
      };
    }
    const origin = safeOrigin(url);
    if (origin === null) {
      return { allowed: false, reason: "robots-unavailable", origin: url };
    }
    const document = await this.loadDocument(origin);
    if (document.kind === "unavailable") {
      return { allowed: false, reason: "robots-unavailable", origin };
    }
    const pathname = safePathname(url) ?? "/";
    const allowed = isPathAllowed(document.groups, pathname, this.productToken);
    return { allowed, reason: allowed ? "allowed" : "disallowed", origin };
  }

  private loadDocument(origin: string): Promise<RobotsDocument> {
    const cached = this.documents.get(origin);
    if (cached !== undefined) {
      return cached;
    }
    const document = this.fetchDocument(origin);
    this.documents.set(origin, document);
    return document;
  }

  private async fetchDocument(origin: string): Promise<RobotsDocument> {
    let response;
    try {
      response = await this.http.get(`${origin}/robots.txt`, {
        accept: "text/plain",
      });
    } catch {
      return { kind: "unavailable" };
    }
    if (response.status >= 200 && response.status < 300) {
      return { kind: "rules", groups: parseRobotsTxt(response.text) };
    }
    if (response.status === 429 || response.status >= 500) {
      return { kind: "unavailable" };
    }
    return { kind: "rules", groups: [] };
  }
}

function safeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function safePathname(url: string): string | null {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return null;
  }
}
