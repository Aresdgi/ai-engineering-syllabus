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
