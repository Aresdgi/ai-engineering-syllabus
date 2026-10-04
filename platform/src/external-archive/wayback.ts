/**
 * Respaldo Wayback de las herramientas (plan §4, AC-2.5.5): SOLO se consulta la
 * API pública de disponibilidad `https://archive.org/wayback/available?url=…`.
 * No se envía nada a "Save Page Now" ni a ningún endpoint de escritura
 * (decisión del usuario, §8.1).
 *
 * Los metadatos se guardan literalmente: URL de la captura, fecha y estado
 * HTTP. Si no hay captura, el item queda sin respaldo y la UI muestra el
 * enlace original con estado neutro.
 */

import type { HttpClient } from "./http";
import { RobotsDeniedError, type RobotsGate } from "./robots";

export const WAYBACK_AVAILABILITY_BASE_URL =
  "https://archive.org/wayback/available";

export type WaybackAvailability = Readonly<{
  requestedUrl: string;
  available: boolean;
  /** URL literal de la captura devuelta por la API. */
  snapshotUrl: string | null;
  /** Fecha de captura en ISO-8601 UTC. */
  capturedAt: string | null;
  httpStatus: number | null;
}>;

/** `20260613092255` → `2026-06-13T09:22:55.000Z`; `null` si no es válido. */
export function parseWaybackTimestamp(timestamp: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(
    timestamp.trim(),
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Interpreta la respuesta de `wayback/available` (sin inventar capturas). */
export function parseWaybackAvailability(
  payload: unknown,
  requestedUrl: string,
): WaybackAvailability {
  const empty: WaybackAvailability = {
    requestedUrl,
    available: false,
    snapshotUrl: null,
    capturedAt: null,
    httpStatus: null,
  };
  if (!isRecord(payload)) {
    return empty;
  }
  const snapshots = payload.archived_snapshots;
  if (!isRecord(snapshots)) {
    return empty;
  }
  const closest = snapshots.closest;
  if (!isRecord(closest) || closest.available !== true) {
    return empty;
  }
  const snapshotUrl = typeof closest.url === "string" ? closest.url : null;
  const capturedAt =
    typeof closest.timestamp === "string"
      ? parseWaybackTimestamp(closest.timestamp)
      : null;
  const rawStatus = closest.status;
  const httpStatus =
    typeof rawStatus === "number"
      ? rawStatus
      : typeof rawStatus === "string" && /^\d+$/.test(rawStatus)
        ? Number(rawStatus)
        : null;
  if (snapshotUrl === null) {
    return empty;
  }
  return {
    requestedUrl,
    available: true,
    snapshotUrl,
    capturedAt,
    httpStatus,
  };
}

export type WaybackClientOptions = Readonly<{
  robots?: RobotsGate;
  baseUrl?: string;
}>;

export class WaybackClient {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    private readonly options: WaybackClientOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? WAYBACK_AVAILABILITY_BASE_URL;
  }

  async available(url: string): Promise<WaybackAvailability> {
    const requestUrl = `${this.baseUrl}?url=${encodeURIComponent(url)}`;
    const robots = this.options.robots;
    if (robots !== undefined) {
      const verdict = await robots.check(requestUrl);
      if (!verdict.allowed) {
        throw new RobotsDeniedError(requestUrl, verdict);
      }
    }
    const response = await this.http.get(requestUrl, {
      accept: "application/json",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Wayback respondió ${response.status} para ${url} (solo se consulta; nunca Save Page Now)`,
      );
    }
    let payload: unknown;
    try {
      payload = JSON.parse(response.text);
    } catch {
      throw new Error(`Wayback devolvió JSON inválido para ${url}`);
    }
    return parseWaybackAvailability(payload, url);
  }
}
