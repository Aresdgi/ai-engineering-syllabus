# Status

## Hito activo

Hito 2 — Navegador del syllabus real

## Estado

EN CIERRE — implementación, correcciones y QA final completas; re-QA de la última
mini-ronda (QA-F1, QA-D1..D3) en curso. Pendiente de revisión del usuario antes de
mergear a `main` y de autorizar el siguiente hito.

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

1. Terminar la re-QA de la última mini-ronda y cerrar el hito.
2. Revisión del usuario de la rama `m2-syllabus-ui` y merge a `main`.
3. Propuesto: hito "Autonomía de 4Geeks" (archivar lecciones externas de
   4geeks.com, respaldos Wayback) antes del Hito 3 — ver `BACKLOG.md`.

## Blockers

Ninguno.
