/**
 * Contrato del resolvedor de URLs de Markdown (ADR-015/ADR-018 + Hito 2.5).
 *
 * Variantes congeladas del plan M2B (`docs/milestones/M2B_AUDIT_PLAN.md` §6.3
 * + §8):
 * - `internal`: vista interna del snapshot.
 * - `source`: archivo/directorio del snapshot servido por la app o en GitHub.
 * - `external`: enlace externo intacto; `backup` es el respaldo Wayback
 *   opcional de una herramienta (AC-2.5.5).
 * - `external-archive`: lección externa archivada (o alias de una retirada):
 *   abre la copia propia en `/archive/…` y conserva la URL original
 *   (AC-2.5.4).
 * - `archive-asset`: imagen del material archivado servida por la app
 *   (`/archive-assets/<sha256>`, AC-2.5.8).
 * - `broken`: enlace roto en el origen.
 */

export type MarkdownUrl =
  | { kind: "internal"; href: string; targetPath: string }
  | {
      kind: "external";
      href: string;
      /** Respaldo Wayback opcional de una herramienta (AC-2.5.5). */
      backup?: { href: string; capturedAt: string };
    }
  | {
      /** Lección externa archivada (AC-2.5.4): abre la copia propia. */
      kind: "external-archive";
      href: string; // /archive/<host>/<path…>
      originalHref: string;
      archiveId: string;
    }
  | {
      /** Imagen archivada servida por la app (AC-2.5.8). */
      kind: "archive-asset";
      href: string; // /archive-assets/<sha256>
      sha256: string;
    }
  | {
      kind: "source";
      href: string;
      targetPath: string;
      targetKind: "blob" | "tree" | "raw";
    }
  | { kind: "broken"; href: null; rawHref: string };

export type MarkdownUrlResolver = (rawHref: string) => MarkdownUrl;
