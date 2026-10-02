/**
 * Implementación PostgreSQL de `SourceStore` (contract en `source/types.ts`).
 *
 * Funciona sobre una instancia Drizzle genérica de dialecto pg, de modo que
 * sirve tanto para `drizzle-orm/node-postgres` (producción/Supabase) como
 * para `drizzle-orm/pglite` (tests sin nube). No abre conexiones: recibe la
 * base ya construida.
 *
 * Reglas de M1 que aplica:
 * - Idempotencia (AC-1.11): `createSnapshot` no duplica un commit ya
 *   registrado; devuelve el snapshot existente sin tocarlo.
 * - Inmutabilidad: un snapshot nuevo nunca actualiza filas de otro snapshot.
 *   `upsertFiles` solo ajusta una fila existente del mismo snapshot cuando su
 *   `blob_sha` difiere; `setSnapshotStatus` es la única escritura permitida
 *   sobre un snapshot existente.
 * - Escritura por lotes y una transacción por snapshot.
 * - Los fallos se registran en `source_import_errors`, nunca se sustituye
 *   contenido (AC-1.13).
 */

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  SOURCE_SNAPSHOT_STATUSES,
  type ActiveSourceSnapshot,
  type NewSourceBlob,
  type NewSourceContext,
  type NewSourceFile,
  type NewSourceImportError,
  type NewSourceLesson,
  type NewSourceProject,
  type NewSourceSnapshot,
  type SourceBinaryFileEntry,
  type SourceBlobSha,
  type SourceCommitSha,
  type SourceRepositoryDescriptor,
  type SourceRepositoryId,
  type SourceSnapshot,
  type SourceSnapshotId,
  type SourceSnapshotStatus,
  type SourceStore,
} from "../types";
import {
  sourceBlobs,
  sourceContexts,
  sourceFiles,
  sourceImportErrors,
  sourceLessons,
  sourceProjects,
  sourceRepositories,
  sourceSnapshots,
} from "./schema";

const INSERT_CHUNK_SIZE = 500;

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function groupBySnapshotId<T extends { readonly snapshotId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.snapshotId);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.snapshotId, [row]);
    }
  }
  return groups;
}

function isSnapshotStatus(value: string): value is SourceSnapshotStatus {
  return (SOURCE_SNAPSHOT_STATUSES as readonly string[]).includes(value);
}

function toSourceSnapshot(
  row: typeof sourceSnapshots.$inferSelect,
): SourceSnapshot {
  if (!isSnapshotStatus(row.status)) {
    throw new Error(
      `Estado de snapshot desconocido en la base de datos: "${row.status}"`,
    );
  }
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    ref: row.ref,
    commitSha: row.commitSha,
    // El contrato (`SourceTimestamp`) exige ISO-8601; `mode: "date"` evita
    // depender del formato textual de cada driver.
    importedAt: row.importedAt.toISOString(),
    status: row.status,
  };
}

function toFileInsert(file: NewSourceFile): typeof sourceFiles.$inferInsert {
  return {
    snapshotId: file.snapshotId,
    path: file.path,
    blobSha: file.blobSha,
    mediaType: file.mediaType,
    language: file.language,
    languageEvidence: file.languageEvidence,
    rawContent: file.rawContent,
    binaryReference: file.binaryReference,
  };
}

function toBlobInsert(blob: NewSourceBlob): typeof sourceBlobs.$inferInsert {
  if (blob.bytes.byteLength !== blob.byteSize) {
    throw new Error(
      `byte_size incoherente para el blob ${blob.blobSha}: declarado ${blob.byteSize}, real ${blob.bytes.byteLength}`,
    );
  }
  return {
    blobSha: blob.blobSha,
    bytes: blob.bytes,
    byteSize: blob.byteSize,
  };
}

/** Deduplica por `blob_sha` conservando el primer candidato (direccionamiento por contenido). */
function dedupeBlobs(
  blobs: readonly NewSourceBlob[],
): readonly NewSourceBlob[] {
  const bySha = new Map<SourceBlobSha, NewSourceBlob>();
  for (const blob of blobs) {
    if (!bySha.has(blob.blobSha)) {
      bySha.set(blob.blobSha, blob);
    }
  }
  return [...bySha.values()];
}

function toProjectInsert(
  project: NewSourceProject,
): typeof sourceProjects.$inferInsert {
  return {
    snapshotId: project.snapshotId,
    sourcePath: project.sourcePath,
    canonicalOrder: project.canonicalOrder,
    title: project.title,
    preferredReadmePath: project.preferredReadmePath,
    language: project.language,
    languageEvidence: project.languageEvidence,
    metadata: project.metadata,
  };
}

function toContextInsert(
  context: NewSourceContext,
): typeof sourceContexts.$inferInsert {
  return {
    snapshotId: context.snapshotId,
    sourcePath: context.sourcePath,
    title: context.title,
    preferredReadmePath: context.preferredReadmePath,
    language: context.language,
    languageEvidence: context.languageEvidence,
    metadata: context.metadata,
  };
}

function toLessonInsert(
  lesson: NewSourceLesson,
): typeof sourceLessons.$inferInsert {
  return {
    snapshotId: lesson.snapshotId,
    sourcePath: lesson.sourcePath,
    title: lesson.title,
    preferredReadmePath: lesson.preferredReadmePath,
    language: lesson.language,
    languageEvidence: lesson.languageEvidence,
    metadata: lesson.metadata,
  };
}

function toImportErrorInsert(
  error: NewSourceImportError,
): typeof sourceImportErrors.$inferInsert {
  return {
    snapshotId: error.snapshotId,
    sourcePath: error.sourcePath,
    errorKind: error.errorKind,
    message: error.message,
    detail: error.detail,
  };
}

export class PostgresSourceStore<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> implements SourceStore {
  constructor(private readonly db: PgDatabase<TQueryResult, TFullSchema>) {}

  async upsertRepository(
    repository: SourceRepositoryDescriptor,
  ): Promise<SourceRepositoryId> {
    const [row] = await this.db
      .insert(sourceRepositories)
      .values({
        owner: repository.owner,
        name: repository.name,
        canonicalUrl: repository.canonicalUrl,
        defaultBranch: repository.defaultBranch,
      })
      .onConflictDoUpdate({
        target: [sourceRepositories.owner, sourceRepositories.name],
        set: {
          canonicalUrl: sql`excluded.canonical_url`,
          defaultBranch: sql`excluded.default_branch`,
        },
      })
      .returning({ id: sourceRepositories.id });

    return row.id;
  }

  async findSnapshotByCommit(
    repositoryId: SourceRepositoryId,
    commitSha: SourceCommitSha,
  ): Promise<SourceSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(sourceSnapshots)
      .where(
        and(
          eq(sourceSnapshots.repositoryId, repositoryId),
          eq(sourceSnapshots.commitSha, commitSha),
        ),
      )
      .limit(1);

    return row ? toSourceSnapshot(row) : null;
  }

  async createSnapshot(snapshot: NewSourceSnapshot): Promise<SourceSnapshot> {
    const [inserted] = await this.db
      .insert(sourceSnapshots)
      .values({
        repositoryId: snapshot.repositoryId,
        ref: snapshot.ref,
        commitSha: snapshot.commitSha,
        status: "importing",
      })
      .onConflictDoNothing({
        target: [sourceSnapshots.repositoryId, sourceSnapshots.commitSha],
      })
      .returning();

    if (inserted) {
      return toSourceSnapshot(inserted);
    }

    const existing = await this.findSnapshotByCommit(
      snapshot.repositoryId,
      snapshot.commitSha,
    );
    if (!existing) {
      throw new Error(
        `No se pudo crear ni encontrar el snapshot ${snapshot.commitSha} del repositorio ${snapshot.repositoryId}`,
      );
    }
    return existing;
  }

  async upsertFiles(files: readonly NewSourceFile[]): Promise<void> {
    for (const group of groupBySnapshotId(files).values()) {
      await this.db.transaction(async (tx) => {
        for (const chunk of chunkRows(group, INSERT_CHUNK_SIZE)) {
          await tx
            .insert(sourceFiles)
            .values(chunk.map(toFileInsert))
            .onConflictDoUpdate({
              target: [sourceFiles.snapshotId, sourceFiles.path],
              set: {
                blobSha: sql`excluded.blob_sha`,
                mediaType: sql`excluded.media_type`,
                language: sql`excluded.language`,
                languageEvidence: sql`excluded.language_evidence`,
                rawContent: sql`excluded.raw_content`,
                binaryReference: sql`excluded.binary_reference`,
              },
              setWhere: sql`${sourceFiles.blobSha} <> excluded.blob_sha`,
            });
        }
      });
    }
  }

  async upsertBlobs(blobs: readonly NewSourceBlob[]): Promise<void> {
    const unique = dedupeBlobs(blobs);
    if (unique.length === 0) {
      return;
    }
    await this.db.transaction(async (tx) => {
      for (const chunk of chunkRows(unique, INSERT_CHUNK_SIZE)) {
        await tx
          .insert(sourceBlobs)
          .values(chunk.map(toBlobInsert))
          .onConflictDoNothing({ target: sourceBlobs.blobSha });
      }
    });
  }

  /** Snapshot activo (último terminado) con su repositorio; `null` si no hay. */
  async findActiveSnapshot(): Promise<ActiveSourceSnapshot | null> {
    const [row] = await this.db
      .select({
        snapshotId: sourceSnapshots.id,
        commitSha: sourceSnapshots.commitSha,
        owner: sourceRepositories.owner,
        name: sourceRepositories.name,
      })
      .from(sourceSnapshots)
      .innerJoin(
        sourceRepositories,
        eq(sourceRepositories.id, sourceSnapshots.repositoryId),
      )
      .where(
        inArray(sourceSnapshots.status, ["complete", "complete_with_errors"]),
      )
      .orderBy(desc(sourceSnapshots.importedAt))
      .limit(1);

    return row ?? null;
  }

  /** Archivos binarios (`binary_reference`) del snapshot, ordenados por path. */
  async listBinaryFiles(
    snapshotId: SourceSnapshotId,
  ): Promise<readonly SourceBinaryFileEntry[]> {
    return this.db
      .select({ path: sourceFiles.path, blobSha: sourceFiles.blobSha })
      .from(sourceFiles)
      .where(
        and(
          eq(sourceFiles.snapshotId, snapshotId),
          isNotNull(sourceFiles.binaryReference),
        ),
      )
      .orderBy(sourceFiles.path);
  }

  /** Subconjunto de `blobShas` que ya existe en `source_blobs`. */
  async findExistingBlobShas(
    blobShas: readonly SourceBlobSha[],
  ): Promise<ReadonlySet<SourceBlobSha>> {
    const unique = [...new Set(blobShas)];
    const existing = new Set<SourceBlobSha>();
    for (const chunk of chunkRows(unique, INSERT_CHUNK_SIZE)) {
      const rows = await this.db
        .select({ blobSha: sourceBlobs.blobSha })
        .from(sourceBlobs)
        .where(inArray(sourceBlobs.blobSha, chunk));
      for (const row of rows) {
        existing.add(row.blobSha);
      }
    }
    return existing;
  }

  async upsertProjects(projects: readonly NewSourceProject[]): Promise<void> {
    for (const group of groupBySnapshotId(projects).values()) {
      await this.db.transaction(async (tx) => {
        for (const chunk of chunkRows(group, INSERT_CHUNK_SIZE)) {
          await tx
            .insert(sourceProjects)
            .values(chunk.map(toProjectInsert))
            .onConflictDoUpdate({
              target: [sourceProjects.snapshotId, sourceProjects.sourcePath],
              set: {
                canonicalOrder: sql`excluded.canonical_order`,
                title: sql`excluded.title`,
                preferredReadmePath: sql`excluded.preferred_readme_path`,
                language: sql`excluded.language`,
                languageEvidence: sql`excluded.language_evidence`,
                metadata: sql`excluded.metadata`,
              },
            });
        }
      });
    }
  }

  async upsertContexts(contexts: readonly NewSourceContext[]): Promise<void> {
    for (const group of groupBySnapshotId(contexts).values()) {
      await this.db.transaction(async (tx) => {
        for (const chunk of chunkRows(group, INSERT_CHUNK_SIZE)) {
          await tx
            .insert(sourceContexts)
            .values(chunk.map(toContextInsert))
            .onConflictDoUpdate({
              target: [sourceContexts.snapshotId, sourceContexts.sourcePath],
              set: {
                title: sql`excluded.title`,
                preferredReadmePath: sql`excluded.preferred_readme_path`,
                language: sql`excluded.language`,
                languageEvidence: sql`excluded.language_evidence`,
                metadata: sql`excluded.metadata`,
              },
            });
        }
      });
    }
  }

  async upsertLessons(lessons: readonly NewSourceLesson[]): Promise<void> {
    for (const group of groupBySnapshotId(lessons).values()) {
      await this.db.transaction(async (tx) => {
        for (const chunk of chunkRows(group, INSERT_CHUNK_SIZE)) {
          await tx
            .insert(sourceLessons)
            .values(chunk.map(toLessonInsert))
            .onConflictDoUpdate({
              target: [sourceLessons.snapshotId, sourceLessons.sourcePath],
              set: {
                title: sql`excluded.title`,
                preferredReadmePath: sql`excluded.preferred_readme_path`,
                language: sql`excluded.language`,
                languageEvidence: sql`excluded.language_evidence`,
                metadata: sql`excluded.metadata`,
              },
            });
        }
      });
    }
  }

  async insertImportErrors(
    errors: readonly NewSourceImportError[],
  ): Promise<void> {
    for (const chunk of chunkRows(errors, INSERT_CHUNK_SIZE)) {
      await this.db
        .insert(sourceImportErrors)
        .values(chunk.map(toImportErrorInsert));
    }
  }

  async setSnapshotStatus(
    snapshotId: SourceSnapshotId,
    status: SourceSnapshotStatus,
  ): Promise<void> {
    const updated = await this.db
      .update(sourceSnapshots)
      .set({ status })
      .where(eq(sourceSnapshots.id, snapshotId))
      .returning({ id: sourceSnapshots.id });

    if (updated.length === 0) {
      throw new Error(
        `No existe el snapshot ${snapshotId}; no se actualizó ningún estado`,
      );
    }
  }
}
