# Product

## Objetivo

Convertir el repositorio `4GeeksAcademy/ai-engineering-syllabus` en una plataforma personal donde estudiar **ese mismo curso** con una experiencia mucho más cómoda.

## Producto

La aplicación es una capa de experiencia sobre el repositorio.

```text
4Geeks repository
        |
        v
exact ingestion
        |
        v
normalized source model
        |
        v
learning UI
        |
        +-- progress
        +-- notes
        +-- search
        +-- grounded tutor
        +-- personal project repos
```

## La plataforma no es

- un curso alternativo;
- un generador de contenido;
- una reinterpretación del syllabus;
- una academia propia;
- un agregador de cursos.

## Pantalla inicial

Debe ayudar a responder:

- ¿por dónde voy?
- ¿qué proyecto toca ahora?
- ¿qué contexto necesita?
- ¿qué instrucciones dice el repo?
- ¿qué tengo completado?

## Experiencia de proyecto

Al abrir un proyecto debe mostrar fielmente:

- título fuente;
- contenido del README;
- requisitos;
- criterios existentes;
- contexto relacionado;
- assets;
- enlaces;
- source path;
- source commit.

La plataforma puede añadir alrededor:

- marcar progreso;
- notas;
- repo personal asociado;
- tutor;
- navegación.

## Tutor

Debe responder basándose exclusivamente en el corpus importado.

Si la respuesta no está sustentada por el repositorio, debe decir que esa información no está en el material importado en lugar de presentarla como parte del curso.
