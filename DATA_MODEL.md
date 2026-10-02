# Data Model

## source_repositories

- id
- owner
- name
- canonical_url
- default_branch

## source_snapshots

- id
- repository_id
- ref
- commit_sha
- imported_at
- status

## source_files

- id
- snapshot_id
- path
- blob_sha
- language
- media_type
- raw_content nullable
- binary_reference nullable

Unique:

- snapshot_id + path

## source_projects

Representación indexada de un proyecto sin perder la fuente.

- id
- snapshot_id
- source_path
- canonical_order nullable
- title
- preferred_readme_path
- metadata jsonb

## source_contexts

- id
- snapshot_id
- source_path
- title nullable
- language
- metadata jsonb

## source_lessons

- id
- snapshot_id
- source_path
- title
- language
- metadata jsonb

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
