# Functional Specs

## Dashboard

Datos permitidos:

- progreso del usuario;
- siguiente proyecto según orden importado;
- elemento activo;
- notas recientes;
- cambios de upstream.

El dashboard no inventa recomendaciones curriculares fuera del orden fuente.

## Catálogo

Debe permitir navegar:

- Projects
- Contexts
- Lessons

Los nombres y elementos proceden del snapshot importado.

## Project View

Debe mostrar:

- título fuente;
- README preferido;
- selector de idioma cuando exista;
- source path;
- commit;
- contexto relacionado;
- archivos/asset relevantes;
- criterios/requisitos exactamente como aparezcan;
- botón de progreso;
- notas;
- repo personal vinculado.

## Context View

Debe mostrar el archivo fuente sin reinterpretarlo como instrucciones nuevas.

## Lesson View

Debe renderizar el material fuente disponible.

## Search

Debe buscar únicamente corpus SOURCE.

Resultados muestran:

- título/path;
- snippet;
- categoría;
- commit/snapshot.

## Tutor

Cada respuesta debe:

- usar corpus SOURCE;
- incluir referencias internas;
- diferenciar claramente una inferencia de una instrucción explícita;
- rechazar atribuir al curso algo no presente.

## Progreso

Es USER STATE.

No modifica archivos SOURCE.

## Sincronización

El usuario debe poder ver:

- commit anterior;
- commit nuevo;
- archivos añadidos;
- modificados;
- eliminados.

El progreso asociado a un elemento no desaparece simplemente porque upstream cambie.
