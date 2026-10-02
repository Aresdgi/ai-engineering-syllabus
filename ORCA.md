# ORCA Instructions

## Misión

Construir una interfaz de aprendizaje para el contenido real de:

`https://github.com/4GeeksAcademy/ai-engineering-syllabus`

## Restricción máxima

**NO INVENTAR CONTENIDO EDUCATIVO.**

No crear:

- cursos demo;
- módulos demo;
- proyectos demo;
- requisitos;
- lecciones;
- quizzes;
- contextos;
- rúbricas;
- orden alternativo.

Si hace falta contenido para probar, usar fixtures extraídos del repositorio real y mantener su source path.

## Primera lectura obligatoria

Antes de programar:

1. `SOURCE_OF_TRUTH.md`
2. `CONTENT_CONTRACT.md`
3. `REPO_MAP.md`
4. `MILESTONES.md`
5. `STATUS.md`
6. documento del hito activo
7. `DECISIONS.md`

## Hito activo

Solo trabajar el indicado en `STATUS.md`.

## Regla de procedencia

Toda entidad SOURCE creada por Orca debe poder remontarse a:

- repository;
- commit;
- path;
- hash/blob.

## No transformar silenciosamente

No convertir un README de proyecto en una versión resumida y almacenar ese resumen como proyecto.

Mantener original.

## Pruebas

Los fixtures deben proceder de archivos reales del repositorio.

Cada parser debe probar:

- contenido normal;
- español/inglés;
- archivos ausentes;
- enlaces relativos;
- cambios de commit;
- paths eliminados.

## IA

No incorporar generación de contenido.

Cuando llegue el hito del tutor, implementar retrieval fundamentado.

## Final de tarea

Verificar:

- build;
- typecheck;
- lint;
- tests;
- fidelidad fuente;
- no regresión.

## Final de hito

Actualizar:

- `STATUS.md`
- checklist del hito
- `DECISIONS.md` si procede

No iniciar el siguiente hito automáticamente.

## Backlog

Ideas ajenas al hito van a `BACKLOG.md`.

## Pregunta de seguridad conceptual

Antes de añadir una feature preguntar internamente:

> ¿Esto ayuda a consumir el repo o está inventando un curso nuevo?

Si es lo segundo, no implementarlo.
