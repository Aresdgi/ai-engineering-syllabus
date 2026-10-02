# Architecture

## Principio central

El dominio se divide claramente entre:

```text
SOURCE CONTENT
4Geeks repository
immutable from the app point of view

USER STATE
progress, notes, linked repositories

AI OUTPUT
ephemeral/contextual assistant responses
```

Nunca mezclar estas categorías.

## Arquitectura inicial

```text
GitHub: 4GeeksAcademy/ai-engineering-syllabus
                    |
                    v
              Repository Reader
                    |
                    v
               Source Parser
                    |
                    v
              Source Validator
                    |
                    v
              Source Database
                    |
         +----------+----------+
         |                     |
         v                     v
     Learning UI            Search/RAG
         |                     |
         v                     v
     User State             Grounded Tutor
```

## Stack sugerido

- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- PostgreSQL/Supabase

La elección de stack es una decisión de la aplicación, no contenido educativo.

## Capas

### source/

Responsable de:

- GitHub;
- commits;
- tree;
- blobs;
- parsers;
- idioma;
- relaciones;
- sincronización.

### course/

Lee exclusivamente registros SOURCE.

### user/

- progress;
- notes;
- bookmarks;
- linked repositories.

### ai/

No puede escribir ni alterar SOURCE.

## Inmutabilidad

Una sincronización puede crear una nueva versión SOURCE.

Nunca debe modificar el contenido antiguo de forma que se pierda la trazabilidad del commit previo.

## Render

Los renderers deben trabajar desde `raw_content` o una AST fiel del Markdown.

No resumir automáticamente para mostrar una "versión más bonita".
