/**
 * Resumen de una ingesta para el CLI (M1-W4): objeto JSON estable y texto
 * humano. Nunca incluye secretos: solo repo, commit, conteos, errores y
 * tiempos.
 */

import type { SourceSnapshotStatus, SourceTimestamp } from "../types";
import type {
  IngestFileCounts,
  IngestIndexCounts,
  IngestSnapshotResult,
} from "./ingest";

export type IngestJsonErrorSummary = Readonly<{
  path: string | null;
  kind: string;
  message: string;
}>;

export type IngestJsonSummary = Readonly<{
  dryRun: boolean;
  repository: string;
  ref: string;
  commit: string;
  snapshotId: string;
  status: SourceSnapshotStatus;
  noop: boolean;
  files: IngestFileCounts | null;
  indexes: IngestIndexCounts | null;
  errorCount: number;
  errors: readonly IngestJsonErrorSummary[];
  startedAt: SourceTimestamp;
  finishedAt: SourceTimestamp;
  durationMs: number;
}>;

export function buildIngestJsonSummary(
  result: IngestSnapshotResult,
  dryRun: boolean,
): IngestJsonSummary {
  return {
    dryRun,
    repository: `${result.repository.owner}/${result.repository.name}`,
    ref: result.ref,
    commit: result.commitSha,
    snapshotId: result.snapshot.id,
    status: result.status,
    noop: result.noop,
    files: result.counts ? { ...result.counts.files } : null,
    indexes: result.counts ? { ...result.counts.indexes } : null,
    errorCount: result.errors.length,
    errors: result.errors.map((error) => ({
      path: error.sourcePath,
      kind: error.errorKind,
      message: error.message,
    })),
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
  };
}

export function formatIngestHumanSummary(
  result: IngestSnapshotResult,
  dryRun: boolean,
): string {
  const label = dryRun ? "ingest (dry-run)" : "ingest";
  const lines: string[] = [
    `${label}: repo=${result.repository.owner}/${result.repository.name} ref=${result.ref} commit=${result.commitSha} snapshot=${result.snapshot.id} estado=${result.status}`,
  ];

  if (result.noop) {
    lines.push(
      `${label}: no-op: ya existía un snapshot ${result.status} para ese commit; no se escribió nada`,
    );
  }
  if (result.counts) {
    const { files, indexes, errors } = result.counts;
    lines.push(
      `${label}: archivos total=${files.total} texto=${files.text} binarios=${files.binary} porRoot projects=${files.byRoot.projects} contexts=${files.byRoot.contexts} lessons=${files.byRoot.lessons}`,
    );
    lines.push(
      `${label}: índices projects=${indexes.projects} contexts=${indexes.contexts} lessons=${indexes.lessons} errores=${errors}`,
    );
  }
  result.errors.forEach((error, index) => {
    lines.push(
      `${label}: error[${index + 1}] tipo=${error.errorKind} path=${error.sourcePath ?? "-"} mensaje=${error.message}`,
    );
  });
  lines.push(`${label}: duración ${result.durationMs}ms`);

  return lines.join("\n");
}
