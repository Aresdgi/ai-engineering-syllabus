# Hito 2.5 — Autonomía de 4Geeks

## Objetivo

Que el curso siga siendo consultable aunque el usuario pierda el acceso al bootcamp
y desaparezcan los sitios de 4Geeks. Decisión del usuario (2026-10-02), tras el
Hito 2 (que ya eliminó la dependencia del GitHub de 4Geeks, ADR-018).

Alcance: los enlaces del corpus hacia sitios web de 4Geeks. No se añade contenido
educativo nuevo: lo archivado es material EXTERNO al repositorio, enlazado desde él,
conservado literal y claramente marcado como tal.

## AC

- [ ] AC-2.5.1 Inventario reproducible de todos los enlaces del snapshot activo hacia hosts de 4Geeks, clasificados en lección, herramienta y marketing, con documentos de origen.
- [ ] AC-2.5.2 Las lecciones externas enlazadas (todas las URL únicas de lección, en cada idioma) se archivan en la base propia de forma literal (contenido y sus imágenes), con URL original, fecha de captura, método y hash.
- [ ] AC-2.5.3 Vista interna del material archivado, marcada de forma visible como "material externo archivado, no forma parte del repositorio", con URL original y fecha de captura.
- [ ] AC-2.5.4 Los enlaces del Markdown hacia lecciones archivadas abren la copia archivada en la app, con acceso al original.
- [ ] AC-2.5.5 Los enlaces a herramientas de 4Geeks conservan el original y muestran un respaldo de Wayback Machine claramente marcado.
- [ ] AC-2.5.6 Los enlaces de marketing quedan intactos.
- [ ] AC-2.5.7 Captura idempotente con CLI propio (`--dry-run`), sin efectos en el snapshot SOURCE.
- [ ] AC-2.5.8 Leer el material archivado no requiere ningún host de 4Geeks en tiempo de ejecución.
- [ ] AC-2.5.9 ADR que define la clase de material externo archivado, separada de SOURCE.
- [ ] AC-2.5.10 Ningún elemento educativo inventado: el archivo es literal y sin resúmenes ni traducciones.
