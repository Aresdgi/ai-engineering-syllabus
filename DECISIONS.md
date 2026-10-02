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
