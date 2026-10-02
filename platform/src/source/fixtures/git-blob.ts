import { createHash } from "node:crypto";

/**
 * Git blob SHA-1: sha1("blob <bytes>\0" + contenido). Coincide con
 * `git hash-object <archivo>`.
 */
export function computeGitBlobSha(content: Uint8Array): string {
  const header = Buffer.from(`blob ${content.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(content).digest("hex");
}
