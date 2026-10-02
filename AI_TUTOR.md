# Grounded AI Tutor

## Regla

El tutor está subordinado al repositorio fuente.

No es una fuente alternativa del curso.

## Corpus permitido

Únicamente contenido importado del snapshot activo de:

`4GeeksAcademy/ai-engineering-syllabus`

Incluyendo cuando sea pertinente:

- projects;
- contexts;
- lessons;
- README;
- archivos de soporte textuales.

## Respuesta

Una respuesta debe estar respaldada por uno o más source files.

Debe conservar:

- path;
- commit;
- fragmentos usados o referencias a ellos.

## Comportamiento cuando falta información

Respuesta conceptual:

> El material importado no especifica eso.

Después puede indicar qué archivos relacionados sí existen.

No debe rellenar huecos atribuyéndolos a 4Geeks.

## Modos

Los modos son de interfaz, no nuevo contenido:

- Explicar este fragmento
- Aclarar requisito
- ¿Qué me pide este proyecto?
- ¿Dónde se menciona X?
- Ayúdame a localizar el contexto
- Revisar mi solución contra este requisito

## Explicaciones

Cuando reformule un fragmento debe dejar claro que es una explicación del tutor.

Nunca sustituye el bloque SOURCE.

## RAG

Cuando se implemente:

- indexar únicamente SOURCE;
- metadata obligatoria de path + commit;
- threshold;
- citas;
- sin resultados => reconocer falta de evidencia.
