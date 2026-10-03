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

Solo trabajar el indicado en `STATUS.md`. En modo nocturno, el primer elemento sin
marcar de 'Cola nocturna'.

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

No iniciar el siguiente hito automáticamente, salvo en modo nocturno (ver abajo).

## Modo nocturno

Los elementos de "Cola nocturna" en STATUS.md están autorizados:
al cerrar uno, pasar al siguiente sin esperar al usuario.

### Al empezar cada elemento

- Lee el último cierre en docs/cierres/ (STATUS.md indica cuál).
  Si no hay cierres previos, parte de la rama actual.
- Verifica antes de construir encima: el commit indicado en el cierre
  existe y build, typecheck, lint y tests pasan en esa rama. Si no,
  escribe el motivo en AGENT_FAILED, marca el elemento [!] y para.

### Durante

- Decisiones de auditoría: tomar la interpretación más conservadora
  coherente con SOURCE_OF_TRUTH.md y anotarla en "Decisiones pendientes
  de validar" del plan de auditoría. Si la decisión inventaría contenido
  o cambia el alcance, escribe la pregunta en AGENT_BLOCKED, marca el
  elemento [!] y para.
- Si el elemento no tiene documento en docs/milestones/, crearlo en la
  auditoría a partir de BACKLOG.md antes de implementar.
- Límite de reparación: máximo 3 intentos sobre el mismo fallo (mismo
  test o mismo comando) y 5 rondas de reparación en total por elemento.
  Al superarlo, escribe el motivo en AGENT_FAILED, marca el elemento [!]
  y para. Aplica también a los workers.
- Una rama por elemento, creada desde la del elemento anterior.
  Nunca merge a main, nunca push.
- No escribir en la base real de Supabase. Tests con PGlite.
- Nunca borres AGENT_STOP, AGENT_BLOCKED ni AGENT_FAILED.

### Cierre obligatorio

Escribe docs/cierres/NN-nombre-corto.md con esta plantilla, todas las
secciones ("Ninguna" si no aplica):

```markdown
## Tarea NN: DONE

### Objetivo

### Cambios realizados

### Archivos modificados

### Verificación

- build / typecheck / lint / tests: PASS o FAIL
- QA técnica / fidelidad / diseño: PASS o FAIL

### Decisiones tomadas

### Deuda / problemas detectados

### Commit

### Notas para el siguiente
```

- "Verificación" solo con resultados de comandos ejecutados en esta sesión.
- "Commit" es el hash del commit con los cambios. El cierre y STATUS.md
  van en un commit posterior.
- No decidas la siguiente tarea: la decide la cola.
- En STATUS.md, actualiza solo la referencia al último cierre y, lo
  último de todo, marca el elemento [x].

## Backlog

Ideas ajenas al hito van a `BACKLOG.md`.

## Pregunta de seguridad conceptual

Antes de añadir una feature preguntar internamente:

> ¿Esto ayuda a consumir el repo o está inventando un curso nuevo?

Si es lo segundo, no implementarlo.
