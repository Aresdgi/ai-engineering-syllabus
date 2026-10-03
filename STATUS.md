# Status

## Hito activo

Hito 2.5 — Autonomía de 4Geeks (`docs/milestones/M2B_AUTONOMY.md`)

## Estado

EN CURSO (2026-10-03), rama `m2b-autonomy` (sin commitear). Hito 2 cerrado y
mergeado en `main` (`0db4d89`).

- Auditoría: `docs/milestones/M2B_AUDIT_PLAN.md` (§8: decisiones del usuario —
  sin Save Page Now; licencia: copia literal; lecciones retiradas → alias hacia la
  lección equivalente archivada).
- Implementación completa (W0 esquema/migración 0002 aplicada, W1 inventario y
  CLI `archive:external` con captura real, W2 capa `course/`, W3 vista `/archive`
  y `/archive-assets`, D0 ADR-020 y docs).
- QA: `M2B_QA_TECHNICAL.md` (10/10 AC PASS) y `M2B_QA_FIDELITY.md`.
- Correcciones post-QA: FXC (T-03, O-01) hecha; FXA (T-01) y FXB (T-02,
  D-01..D-04) interrumpidas por un reinicio del equipo con cambios parciales en el
  árbol: relanzar como reanudación. Después, re-QA y cierre.

## Fuente educativa

`4GeeksAcademy/ai-engineering-syllabus` (snapshot `main` @ `962c1e5`), con espejo
propio `Aresdgi/ai-engineering-syllabus` para enlaces (ADR-018).

## Regla activa

No utilizar contenido demo inventado. Fixtures solo del repo real (ADR-009).

## Resultado del Hito 2

- Navegador en `platform/`: `/projects` (orden y secciones literales de
  `content/projects/README.md`, subproyectos de `4-devs` derivados en lectura),
  `/projects/[slug]`, `/contexts`, `/contexts/[slug]` (`?doc=`), `/lessons`,
  `/lessons/[slug]`, con render Markdown fiel y saneado, enlaces relativos resueltos
  (rotos visibles, nunca "arreglados") y procedencia visible (ADR-013..017).
- Independencia de 4Geeks en tiempo de ejecución (ADR-018): 118 binarios guardados
  en `source_blobs` (112 blobs, 6,7 MB) y servidos en `/source-files/…`; 0 enlaces
  generados hacia hosts de 4Geeks.
- Idioma global ES/EN por cookie con selector único (ADR-019) y selector de tema
  claro/oscuro/sistema.
- QA: `docs/milestones/M2_QA_TECHNICAL.md` (13/13 AC PASS), `M2_QA_FIDELITY.md`,
  `M2_QA_DESIGN.md`.

## Próxima acción

1. Reanudar FXA y FXB, re-QA (`M2B-RQA`) y cerrar el Hito 2.5 (commit en
   `m2b-autonomy`); revisión del usuario antes de mergear a `main`.
2. Después, pasada de alineación con shadcn/ui (ver `BACKLOG.md`), antes del Hito 3.

## Cola nocturna

Marcas: `[ ]` pendiente · `[x]` cerrado según "Final de hito" de `ORCA.md` ·
`[!]` necesita una decisión del usuario (motivo en la misma línea).

## Blockers

Ninguno.
