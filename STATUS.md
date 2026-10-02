# Status

## Hito activo

Hito 2.5 — Autonomía de 4Geeks (`docs/milestones/M2B_AUTONOMY.md`)

## Estado

PAUSADO (2026-10-02, a petición del usuario) — Hito 2 cerrado y mergeado en `main`
(`0db4d89`). Hito 2.5 definido (AC en `docs/milestones/M2B_AUTONOMY.md`); la
auditoría se interrumpió antes de entregar y debe relanzarse. No iniciar el Hito 3.

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

1. Retomar el Hito 2.5 en la rama `m2b-autonomy`: relanzar la auditoría read-only
   (`docs/milestones/M2B_AUDIT_PLAN.md`) y seguir el flujo habitual.
2. Después, pasada de alineación con shadcn/ui (ver `BACKLOG.md`), antes del Hito 3.

## Blockers

Ninguno.
