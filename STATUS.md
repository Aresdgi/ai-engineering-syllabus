# Status

## Hito activo

Hito 1 — Ingestión fiel del repositorio

## Estado

DONE — pendiente de revisión del usuario antes de autorizar el Hito 2.

## Fuente educativa

`4GeeksAcademy/ai-engineering-syllabus`

## Regla activa

No utilizar contenido demo inventado. Fixtures solo del repo real (ADR-009).

## Resultado del Hito 1

- Ingesta en `platform/src/source/` (reader GitHub, clasificación, validación,
  store Drizzle) y CLI `pnpm ingest` / `pnpm db:migrate` (ADR-010..012).
- Importado en Supabase el snapshot `main` @
  `962c1e5fc8ebad273abaa348fb3d161568ce8707`: 899 archivos (625 projects, 264
  contexts, 10 lessons; 781 texto / 118 binario), índices 84/22/5, 0 errores,
  RLS en las 7 tablas, reimportación idempotente (no-op).
- AC-1.1 .. AC-1.13 verificados: `docs/milestones/M1_QA_TECHNICAL.md` (fidelidad
  byte a byte 899/899) y `docs/milestones/M1_QA_FIDELITY.md` (incl. re-QA).

## Próxima acción

Esperar la revisión del Hito 1 por parte del usuario. No iniciar el Hito 2 sin
autorización explícita.

## Blockers

Ninguno.
