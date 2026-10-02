/**
 * Utilidades compartidas por los tests de `source/github` (M1-W2).
 *
 * - `createTarGz`: genera un tar.gz en memoria con `tar-stream` + `node:zlib`.
 *   Los bytes usados en los tests son sintéticos y neutros: nunca copian ni
 *   imitan contenido educativo del syllabus (ORCA.md, ADR-009).
 * - `createFetchMock`: `fetch` inyectable con registro de llamadas, para probar
 *   sin red.
 */

import { gzipSync } from "node:zlib";
import { pack, type Header } from "tar-stream";
import type { FetchLike } from "./reader";

/** Equivale al `HeaderArgument` interno de tar-stream (no exportado). */
type TarHeaderArgument = Partial<Header> & Pick<Header, "name">;

export type TarEntrySpec = {
  name: string;
  content?: string | Uint8Array;
  type?: "file" | "directory" | "symlink";
  linkname?: string;
};

/** Construye un tar.gz en memoria a partir de entradas sintéticas. */
export async function createTarGz(
  entries: readonly TarEntrySpec[],
): Promise<Uint8Array> {
  const archive = pack();
  const chunks: Buffer[] = [];
  const collected = new Promise<void>((resolve, reject) => {
    archive.on("data", (chunk: unknown) => {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array | string),
      );
    });
    archive.on("end", () => resolve());
    archive.on("error", reject);
  });

  for (const entry of entries) {
    await new Promise<void>((resolve, reject) => {
      const header: TarHeaderArgument = { name: entry.name };
      if (entry.type !== undefined) {
        header.type = entry.type;
      }
      if (entry.linkname !== undefined) {
        header.linkname = entry.linkname;
      }
      const callback = (error?: Error | null): void => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      if (entry.type === "directory" || entry.type === "symlink") {
        archive.entry(header, callback);
      } else {
        archive.entry(header, Buffer.from(entry.content ?? ""), callback);
      }
    });
  }

  archive.finalize();
  await collected;
  return new Uint8Array(gzipSync(Buffer.concat(chunks)));
}

export type FetchCall = {
  url: string;
  init?: RequestInit;
};

export type FetchMockHandler = (
  url: string,
  init?: RequestInit,
) => Response | Promise<Response>;

export type FetchMock = {
  fetchImpl: FetchLike;
  calls: FetchCall[];
};

/** `fetch` falso que registra cada llamada y delega en `handler`. */
export function createFetchMock(handler: FetchMockHandler): FetchMock {
  const calls: FetchCall[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push({ url, init: init ?? undefined });
    return handler(url, init ?? undefined);
  };
  return { fetchImpl, calls };
}

export function headerValue(call: FetchCall, name: string): string | null {
  return new Headers(call.init?.headers).get(name);
}

export type ResponseInitLike = {
  status?: number;
  headers?: Record<string, string>;
};

export function jsonResponse(
  payload: unknown,
  init: ResponseInitLike = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export function bytesResponse(
  bytes: Uint8Array,
  init: ResponseInitLike = {},
): Response {
  return new Response(Buffer.from(bytes), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/octet-stream",
      ...init.headers,
    },
  });
}

export function textResponse(
  text: string,
  init: ResponseInitLike = {},
): Response {
  return new Response(text, {
    status: init.status ?? 200,
    headers: {
      "content-type": "text/plain",
      ...init.headers,
    },
  });
}

export function rateLimitHeaders(input: {
  limit?: number;
  remaining: number;
  resetEpochSeconds?: number;
}): Record<string, string> {
  return {
    "x-ratelimit-limit": String(input.limit ?? 60),
    "x-ratelimit-remaining": String(input.remaining),
    "x-ratelimit-reset": String(input.resetEpochSeconds ?? 1_800_000_000),
  };
}
