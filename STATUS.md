# Status

## Hito activo

Hito 2.5 — Autonomía de 4Geeks (`docs/milestones/M2B_AUTONOMY.md`) — cerrado

## Estado

DONE — pendiente de revisión del usuario (rama `m2b-autonomy`) antes de mergear a
`main`. Hito 2 en `main` (`0db4d89`).

## Fuente educativa

`4GeeksAcademy/ai-engineering-syllabus` (snapshot `main` @ `962c1e5`), con espejo
propio `Aresdgi/ai-engineering-syllabus` para enlaces (ADR-018).

## Regla activa

No utilizar contenido demo inventado. Fixtures solo del repo real (ADR-009).

## Resultado del Hito 2.5

- Lecciones de 4Geeks enlazadas desde el corpus archivadas literalmente en la base
  propia (`external_archive_*`, ADR-020) con sus imágenes, vista `/archive/…` con
  aviso de material externo, URL original, fecha, método y hash; servidas sin
  ningún host de 4Geeks (`/archive-assets/<sha256>`).
- Lecciones retiradas: alias decididos por el usuario hacia la lección equivalente,
  con aviso de sustitución. Herramientas: original + respaldo Wayback si existe.
  Marketing intacto.
- CLI idempotente `archive:external` (`--dry-run`), inventario reproducible en
  `docs/milestones/M2B_LINK_INVENTORY.md`.
- QA: `M2B_QA_TECHNICAL.md` (10/10 AC PASS) y `M2B_QA_FIDELITY.md`; correcciones y
  re-QA (Claude Sonnet, capturas reales) 9/9 cerrados.

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

1. Revisión del usuario de la rama `m2b-autonomy` y merge a `main`.
2. Propuesto: pasada de alineación con shadcn/ui (skill `shadcn` instalada) como
   refactor sin cambios funcionales — ver `BACKLOG.md`.

Último cierre: ninguno

## Blockers

Ninguno.

## Cola desatendida

<!-- [ ] pendiente · [x] cerrado según DESATENDIDO.md · [!] necesita al usuario (ver AGENT_BLOCKED o AGENT_FAILED) -->
