# Data Model

## source_repositories

- id
- owner
- name
- canonical_url
- default_branch

Unique:

- owner + name (`UNIQUE(owner, name)` en el esquema real)

## source_snapshots

- id
- repository_id
- ref
- commit_sha
- imported_at (`NOT NULL DEFAULT now()`)
- status (`NOT NULL DEFAULT 'importing'`)

Unique:

- repository_id + commit_sha (base de la idempotencia de AC-1.11)

## source_files

- id
- snapshot_id
- path
- blob_sha
- media_type
- language nullable
- language_evidence nullable
- raw_content nullable
- binary_reference nullable

Unique:

- snapshot_id + path

Check:

- exactamente uno de `raw_content`/`binary_reference` no nulo.

## source_projects

Representación indexada de un proyecto sin perder la fuente.

- id
- snapshot_id
- source_path
- canonical_order nullable
- title nullable
- preferred_readme_path nullable
- language nullable
- language_evidence nullable
- metadata jsonb (`NOT NULL DEFAULT '{}'::jsonb`)

Unique:

- snapshot_id + source_path

## source_contexts

- id
- snapshot_id
- source_path
- title nullable
- preferred_readme_path nullable
- language nullable
- language_evidence nullable
- metadata jsonb (`NOT NULL DEFAULT '{}'::jsonb`)

Unique:

- snapshot_id + source_path

## source_lessons

- id
- snapshot_id
- source_path
- title nullable
- preferred_readme_path nullable
- language nullable
- language_evidence nullable
- metadata jsonb (`NOT NULL DEFAULT '{}'::jsonb`)

Unique:

- snapshot_id + source_path

## source_relations

Relaciones extraídas de referencias explícitas.

- from_source_path
- to_source_path
- relation_type
- evidence

## user_progress

- user_id
- source_identity
- status
- started_at
- completed_at
- snapshot_first_seen
- updated_at

`source_identity` debe ser estable entre commits siempre que el path lógico siga siendo el mismo.

## user_notes

- id
- user_id
- source_identity
- body
- created_at
- updated_at

## user_bookmarks

- id
- user_id
- source_identity
- created_at

## linked_project_repositories

- id
- user_id
- source_project_identity
- github_repository
- created_at

## ai_threads

- id
- user_id
- source_identity nullable
- source_snapshot_id
- created_at

## ai_messages

- id
- thread_id
- role
- content
- source_citations jsonb
- created_at

## Regla

No existe una tabla donde la IA pueda crear proyectos o lecciones oficiales.

## source_import_errors (M1)

Registro de errores de importación (AC-1.13). No existía en el modelo original;
se añade vía ADR-011.

- id
- snapshot_id
- source_path nullable
- error_kind
- message
- detail jsonb nullable
- created_at

`error_kind` se restringe en base de datos a los nueve tipos declarados en
`platform/src/source/types.ts` (`SOURCE_IMPORT_ERROR_KINDS`). Hay un índice por
`snapshot_id`. Un error nunca sustituye contenido: la importación continúa con
el resto y el snapshot termina en `complete_with_errors`; un fallo global
termina en `failed`.

## Estados de snapshot (M1)

`source_snapshots.status` queda restringido por `CHECK` a exactamente cuatro
valores:

- `importing` — snapshot creado, ingesta en curso.
- `complete` — archivos importados sin errores registrados.
- `complete_with_errors` — ingesta terminada con errores registrados en
  `source_import_errors`.
- `failed` — fallo global (árbol truncado, commit irresoluble, tarball
  corrupto).

`UNIQUE(repository_id, commit_sha)` garantiza la idempotencia: reimportar el
mismo commit devuelve el snapshot existente sin modificarlo; un commit nuevo
crea otro snapshot y no toca el anterior.

## language_evidence (M1)

En `source_files`, `source_projects`, `source_contexts` y `source_lessons`, la
pareja `language`/`language_evidence` solo admite, por `CHECK`, combinaciones
con evidencia de path (ADR-012):

- `es` + `suffix` (`.es.md`)
- `en` + `suffix` (`.en.md`)
- `en` + `pair-convention` (`X.md` con `X.es.md` en el mismo directorio)
- `null` + `null` (sin evidencia)

Nunca se infiere del contenido ni se traduce.

## Alineación con el esquema implementado (M1)

Este documento refleja el esquema real de
`platform/src/source/store/schema.ts` y de la migración versionada
`platform/drizzle/0000_puzzling_tenebrous.sql`. Precisiones que M1 añade al
diseño original, sin retirar nada del previsto para hitos futuros:

- `title` es nullable en `source_projects`, `source_contexts` y
  `source_lessons`; M1 escribe `NULL` en las tres (derivar el título del
  cuerpo es H2). `source_files`, `source_snapshots` y `source_import_errors` no
  tienen columna `title`.
- `preferred_readme_path` es nullable en proyectos, contextos y lecciones.
  `null` significa "sin documento reconocible": se registra en `metadata` o
  como error de importación; nunca se inventa.
- `language`/`language_evidence` son nullable en las cuatro entidades que las
  exponen (`source_files`, `source_projects`, `source_contexts`,
  `source_lessons`); el `CHECK` solo admite las combinaciones de ADR-012,
  incluida `null`/`null`.
- Todas las FK (`snapshot_id`, `repository_id`) son `ON DELETE RESTRICT`:
  nunca hay cascada. Los `UNIQUE` por snapshot y el índice
  `source_import_errors(snapshot_id)` están en el SQL versionado.
- `source_snapshots.imported_at` y `source_import_errors.created_at` usan
  `DEFAULT now()`; `source_snapshots.status` usa `DEFAULT 'importing'`;
  `metadata` usa `DEFAULT '{}'::jsonb`.
- Las siete tablas llevan `ENABLE ROW LEVEL SECURITY` sin políticas (ADR-010):
  el owner (servidor e ingesta) bypassa RLS y la Data API pública no expone
  filas.
- `source_relations`, `user_*`, `linked_project_repositories` y `ai_*` siguen
  ausentes en la base real: son diseño de H3/H4/H6/H7, no de M1.

La comparación columna a columna está auditada en
`docs/milestones/M1_QA_FIDELITY.md` §6.2.

## external_archive_items (M2.5)

Clase `EXTERNAL_ARCHIVE` (ADR-020). Diseño nuevo; no existía en el modelo
original. Es **global**, no cuelga de `source_snapshots`: se direcciona por URL
canónica y sobrevive a reingestas y cambios de snapshot.

- id (uuid, PK, `DEFAULT gen_random_uuid()`)
- original_url (text, `NOT NULL`) — tal cual aparece en el corpus
- canonical_url (text, `NOT NULL`, `UNIQUE`) — host en minúsculas, sin barra
  final
- kind (text, `NOT NULL`, `CHECK (kind IN ('lesson','tool'))`)
- host (text, `NOT NULL`)
- language (text, nullable, `CHECK (language IN ('es','en'))`)
- title (text, nullable) — literal (frontmatter/H1/API); nunca generado
- content (text, nullable) — Markdown literal (solo lecciones capturadas)
- content_sha256 (text, nullable)
- content_format (text, nullable, `CHECK (content_format = 'markdown')`)
- source_repository (text, nullable) — p. ej. `breatheco-de/knowledge-base`
- source_commit (text, nullable) — commit pinneado
- source_path (text, nullable) — path dentro del repo fuente
- captured_at (timestamptz, `NOT NULL`)
- method (text, `NOT NULL`, `CHECK (method IN ('registry-api+github-raw','wayback-metadata','manual','user-alias'))`)
- http_status (integer, nullable)
- wayback_url (text, nullable)
- wayback_captured_at (timestamptz, nullable)
- wayback_http_status (integer, nullable)
- status (text, `NOT NULL`, `CHECK (status IN ('captured','unavailable','error','alias'))`)
- alias_of_canonical_url (text, nullable) — FK lógica a `canonical_url`;
  `CHECK`: no nula si y solo si `status = 'alias'`
- last_error (text, nullable) — redactado
- created_at / updated_at (timestamptz, `NOT NULL`, `DEFAULT now()`)

En una fila `alias` el contenido se lee de la fila destino vía
`alias_of_canonical_url` (no se copian bytes). Índices por `kind`, `status`,
`host` y `language`.

## external_archive_assets (M2.5)

Bytes de las imágenes del material archivado, **direccionados por contenido con
SHA-256** (no el SHA-1 git de `source_blobs`: las clases no se mezclan).

- sha256 (text, PK)
- bytes (bytea, `NOT NULL`)
- content_type (text, `NOT NULL`)
- byte_size (integer, `NOT NULL`)
- source_url (text, `NOT NULL`) — URL de la que se descargó
- captured_at (timestamptz, `NOT NULL`)

## external_archive_item_assets (M2.5)

Relación item ↔ imagen, con URL y `alt` literales; permite deduplicar una misma
imagen entre items e idiomas.

- item_id (uuid, `NOT NULL`, FK a `external_archive_items(id)` `ON DELETE CASCADE`)
- asset_sha256 (text, `NOT NULL`, FK a `external_archive_assets(sha256)` `ON DELETE RESTRICT`)
- original_url (text, `NOT NULL`) — URL tal cual en el Markdown
- alt (text, nullable) — alt literal
- Primary key: `(item_id, original_url)`

## Idempotencia, RLS y aislamiento (M2.5)

- **Idempotencia**: `UNIQUE(canonical_url)` en items y `sha256` como PK de
  assets. Repetir la captura con el mismo contenido no inserta filas nuevas ni
  actualiza `captured_at`; el hash solo cambia en una recaptura real con
  contenido distinto. Los assets deduplican por hash.
- **RLS**: `ENABLE ROW LEVEL SECURITY` en las tres tablas, sin políticas (mismo
  patrón que el store SOURCE, ADR-010): el owner (servidor y CLI) bypassa RLS y
  la Data API pública no expone filas.
- **Aislamiento**: la migración nueva (`platform/drizzle/0002_*.sql`) crea solo
  estas tablas; el CLI de captura únicamente ejecuta `SELECT` sobre
  `source_files` y escribe en `external_archive_*`, jamás en el snapshot ni en
  tablas SOURCE.
- **Servido**: los assets se sirven por `/archive-assets/<sha256>`; leer el
  archivo no requiere ningún host externo.
