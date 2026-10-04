# Hito 2.5 — Autonomía de 4Geeks

## Objetivo

Que el curso siga siendo consultable aunque el usuario pierda el acceso al bootcamp
y desaparezcan los sitios de 4Geeks. Decisión del usuario (2026-10-02), tras el
Hito 2 (que ya eliminó la dependencia del GitHub de 4Geeks, ADR-018).

Alcance: los enlaces del corpus hacia sitios web de 4Geeks. No se añade contenido
educativo nuevo: lo archivado es material EXTERNO al repositorio, enlazado desde él,
conservado literal y claramente marcado como tal.

## AC

- [x] AC-2.5.1 Inventario reproducible de todos los enlaces del snapshot activo hacia hosts de 4Geeks, clasificados en lección, herramienta y marketing, con documentos de origen.
- [x] AC-2.5.2 Las lecciones externas enlazadas (todas las URL únicas de lección, en cada idioma) se archivan en la base propia de forma literal (contenido y sus imágenes), con URL original, fecha de captura, método y hash.
- [x] AC-2.5.3 Vista interna del material archivado, marcada de forma visible como "material externo archivado, no forma parte del repositorio", con URL original y fecha de captura.
- [x] AC-2.5.4 Los enlaces del Markdown hacia lecciones archivadas abren la copia archivada en la app, con acceso al original.
- [x] AC-2.5.5 Los enlaces a herramientas de 4Geeks conservan el original y muestran un respaldo de Wayback Machine claramente marcado.
- [x] AC-2.5.6 Los enlaces de marketing quedan intactos.
- [x] AC-2.5.7 Captura idempotente con CLI propio (`--dry-run`), sin efectos en el snapshot SOURCE.
- [x] AC-2.5.8 Leer el material archivado no requiere ningún host de 4Geeks en tiempo de ejecución.
- [x] AC-2.5.9 ADR que define la clase de material externo archivado, separada de SOURCE.
- [x] AC-2.5.10 Ningún elemento educativo inventado: el archivo es literal y sin resúmenes ni traducciones.

## Cierre

Verificado en `docs/milestones/M2B_QA_TECHNICAL.md` (10/10 AC PASS) y
`M2B_QA_FIDELITY.md` (fidelidad, alcance y seguridad sin hallazgos), con ronda de
correcciones (T-01..T-03, D-01..D-04, O-01) y re-QA de Claude Sonnet con capturas
reales: 9/9 cerrados, 0 nuevos. Plan y decisiones del usuario en
`M2B_AUDIT_PLAN.md` §8 (sin Save Page Now; copia literal; lecciones retiradas como
alias hacia la lección equivalente). Inventario en `M2B_LINK_INVENTORY.md`; clase
EXTERNAL_ARCHIVE en ADR-020. Fuera de alcance y anotado en `BACKLOG.md`: portada de
`seats-management-typescript` cargada desde GitHub (F-01, heredado de H2) y badges
de `img.shields.io` (F-02).
