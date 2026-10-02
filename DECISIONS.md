# Decisions

## ADR-001 — 4Geeks repo is the only pedagogical source

Status: Accepted

La plataforma no mantiene un syllabus paralelo.

## ADR-002 — Source/User/AI separation

Status: Accepted

Contenido fuente, estado personal y respuestas IA son dominios diferentes.

## ADR-003 — Source traceability

Status: Accepted

Todo elemento del curso conserva commit + path + hash.

## ADR-004 — Ingestion before LMS

Status: Accepted

No se construye primero un curso demo.

El LMS se desarrolla sobre contenido real importado.

## ADR-005 — No generated official content

Status: Accepted

La IA no puede persistir material generado como parte oficial del curso.

## ADR-006 — La app vive en platform/ como paquete pnpm independiente

Status: Accepted

El código de la plataforma vive en `platform/`, con su propio `package.json` y
`pnpm-lock.yaml`, sin declarar workspaces. Esto separa el corpus SOURCE
(`content/`, `marketing/`, `assets/`) del código de producto, mantiene el sync
con upstream path-disjoint y evita regenerar el lockfile raíz.

Matiz: `platform/pnpm-workspace.yaml` existe, pero no declara ningún miembro de
workspace (no contiene la clave `packages:`): solo fija la política de build
scripts de pnpm 12 (`allowBuilds`). "Sin declarar workspaces" se refiere a que
`platform/` es un proyecto pnpm independiente (lockfile y virtual store
propios), no a la ausencia de ese archivo de configuración.

## ADR-007 — Stack de fundación

Status: Accepted

Next.js (App Router) + TypeScript strict, Tailwind v4, shadcn/ui vendorizado,
ESLint flat config, `tsc --noEmit` y Vitest + Testing Library. M0 no incluye
base de datos ni IA; PostgreSQL/Supabase sigue como dirección para los hitos de
datos.

## ADR-008 — Guard automatizado contra catálogo hardcodeado

Status: Accepted

Un test falla si el código de la app contiene nombres de proyectos, lecciones o
contextos del syllabus. La denylist se deriva dinámicamente de `content/` y el
guard es fail-closed: sin `content/` falla en lugar de pasar en vacío.

## ADR-009 — Fixtures fuente verificables

Status: Accepted

Los fixtures de test que reproduzcan contenido del syllabus viven en
`platform/fixtures/source/<commit_sha>/<path original>` (copia verbatim,
conservando el path relativo del repo fuente) y se declaran en
`platform/fixtures/source/manifest.json` con `repository`, `commit`, `path` y
`blob_sha` (el SHA-1 de `git hash-object`).

Esto resuelve el conflicto entre `ORCA.md` ("los fixtures deben proceder de
archivos reales del repositorio" y conservar su source path) y el guard
AC-0.10 (ningún nombre del catálogo en `platform/`): el guard calcula el blob
SHA-1 de cada fixture y solo excluye del escaneo de nombres los archivos que
existen, están declarados en el manifiesto y coinciden byte a byte con el blob
declarado. Un archivo no declarado, un fixture alterado o una entrada del
manifiesto sin archivo son violaciones; el propio `manifest.json` se valida
(campos obligatorios, sin duplicados, paths relativos sin `..`) y no se escanea.

Consecuencia: la excepción al guard exige declaración e integridad. El guard no
excluye ningún archivo que no esté declarado en el manifiesto y cuyo contenido no
coincida byte a byte con el `blob_sha` declarado, de modo que un fixture ya dado
de alta no puede alterarse en silencio. `commit` y `path` son declarados por
quien añade el fixture: el guard no los contrasta contra el upstream, por lo que
darlo de alta exige verificar commit, path y blob_sha contra el repositorio
fuente (proceso del Hito 1).

## ADR-010 — Persistencia: PostgreSQL gestionado (Supabase) con Drizzle ORM y tests con PGlite

Status: Accepted

La persistencia SOURCE de la plataforma es PostgreSQL gestionado en Supabase,
con Drizzle ORM como capa de acceso:

- **Producción**: servidor y CLI se conectan directamente a Postgres (URI del
  Session pooler de Supabase) como owner de las tablas, usando `pg` +
  `drizzle-orm/node-postgres`. Motivo: es la dirección de `ARCHITECTURE.md`
  (PostgreSQL/Supabase), encaja sin fricción con `DATA_MODEL.md` (`jsonb`,
  `UNIQUE` compuestos, FKs, `CHECK`) y cubre a la vez Vercel (H2), estado de
  usuario (H3), búsqueda (H5) y `pgvector` (H6) sin migrar de motor. No exigió
  instalar nada local (esta máquina no tiene Docker ni `psql`).
- **Tests sin nube**: `@electric-sql/pglite` (Postgres en WASM) aplica las
  mismas migraciones SQL versionadas de `platform/drizzle/` en memoria. Los
  tests nunca se conectan a Supabase ni leen `DATABASE_URL`; no hay tests que
  dependan de la nube.
- **Migraciones**: `drizzle-kit generate` produce SQL versionado y revisable en
  `platform/drizzle/`; `pnpm --dir platform db:migrate` las aplica a
  `DATABASE_URL` con el migrador de `drizzle-orm/node-postgres`. No se aplica
  ninguna migración remota hasta disponer de `DATABASE_URL`.
- **RLS sin políticas**: todas las tablas llevan `ENABLE ROW LEVEL SECURITY` y
  ninguna política. Así la Data API pública de Supabase (roles
  `anon`/`authenticated` con la anon key) no expone ninguna fila; el servidor
  y la ingesta, que entran como owner, bypassan RLS. Añadir una política real
  es una decisión del hito que incorpore autenticación (H3).
- **Idempotencia e inmutabilidad**: `UNIQUE(repository_id, commit_sha)` en
  snapshots, `UNIQUE(snapshot_id, path)` en archivos e índices, e índices con
  FK `ON DELETE RESTRICT` (nunca cascada). Reimportar un commit es un no-op que
  devuelve el snapshot existente; un commit nuevo crea otro snapshot y no toca
  el anterior.
- **Dependencias**: `tar-stream` (reader del Hito 1), `drizzle-orm` y `pg` en
  runtime; `drizzle-kit`, `@electric-sql/pglite` y `tsx` en desarrollo.
  Ninguna compila código nativo. pnpm 12 exige declarar `allowBuilds` y se
  deniega explícitamente `esbuild: false` (lo traen `drizzle-kit` y `tsx`):
  sus binarios llegan prebuilt vía `optionalDependencies` y ambos funcionan
  con el postinstall ignorado (verificado); `sharp` y `unrs-resolver` siguen
  denegados como en M0.

## ADR-011 — source_import_errors: registrar errores, nunca sustituir contenido

Status: Accepted

`DATA_MODEL.md` no definía tabla de errores de importación y AC-1.13 exige
registrar los fallos sin inventar sustitutos. Se añade `source_import_errors`
(`snapshot_id` con FK `ON DELETE RESTRICT`, `source_path` nullable,
`error_kind` con `CHECK` de los nueve tipos declarados en
`platform/src/source/types.ts`, `message`, `detail jsonb`, `created_at`).

Un fallo por archivo no aborta la importación: se registra el error y el
snapshot termina en `complete_with_errors`; un fallo global (árbol truncado,
commit irresoluble, tarball corrupto) termina en `failed` con su error
registrado. Nunca se rellena, resume, reescribe ni sustituye contenido
educativo: `source_files` jamás contiene filas sintéticas.

## ADR-012 — Semántica de idioma: sufijo + convención de par

Status: Accepted

`language` y `language_evidence` solo se pueblan con evidencia de nombre de
archivo, nunca inferida del contenido ni de traducción:

- `"es"` + `"suffix"`: el archivo termina en `.es.md`.
- `"en"` + `"suffix"`: el archivo termina en `.en.md`.
- `"en"` + `"pair-convention"`: es `X.md` y existe `X.es.md` en el mismo
  directorio (convención declarada en
  `.cursor/rules/readme-translations.mdc`).
- `null` + `null`: cualquier otro caso.

La base de datos restringe por `CHECK` exactamente esas cuatro combinaciones,
incluida `null`/`null`, en `source_files`, `source_projects`,
`source_contexts` y `source_lessons`. La decisión del usuario se registró como
"sufijo + convención".
