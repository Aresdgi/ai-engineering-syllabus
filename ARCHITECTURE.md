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

### external-archive/

Clase `EXTERNAL_ARCHIVE` (ADR-020): copias literales de material externo
enlazado por el corpus, conservadas para leerlas sin acceso a 4Geeks. Vive en
`platform/src/external-archive/`:

- **Inventario**: `inventory.ts` y `urls.ts` extraen y normalizan las URL hacia
  hosts de 4Geeks del snapshot activo y las clasifican en lección, herramienta
  y marketing (función pura testeable).
- **CLI**: `cli.ts` (`pnpm archive:external`, con `--dry-run`) captura de forma
  idempotente: lecciones vía API pública del registro BreatheCode + raw de
  GitHub con commit pinneado (`registry.ts`, `github.ts`), imágenes del Markdown
  (`images.ts`), respeto de `robots.txt` (`robots.ts`, `http.ts`) y metadatos
  Wayback de herramientas. Solo lee `source_files`; escribe en
  `external_archive_*`.
- **Store**: `schema.ts`, `store.ts` y `types.ts` sobre las tres tablas de
  `DATA_MODEL.md`; los assets se direccionan por `sha256`.
- **Alias**: `aliases.json` guarda como dato versionado el mapa de lecciones
  retiradas decidido por el usuario.

Rutas propias (server):

- `/archive/[...path]` — `/archive/<host>/<path…>`: muestra el contenido literal
  con aviso persistente, URL original, fecha de captura, método y hash; si el
  item es `alias`, añade el aviso de sustitución. Sin peticiones salientes.
- `/archive-assets/[sha256]` — route handler de imágenes desde la base propia,
  con el mismo patrón de seguridad que `/source-files/` (allowlist de tipos,
  `nosniff`, CSP `sandbox`, `ETag` = sha256, caché inmutable).

Relación con `course/`:

`course/external-archive.ts` lee el índice de material archivado (solo lectura)
y `course/links.ts` lo recibe como
`MarkdownResolutionContext.externalArchive` (mapa de URL canónica a
`ExternalArchiveLink`). Al resolver un `href` `http(s)`: una lección `captured`
o `alias` pasa a `kind: "external-archive"` (abre `/archive/…` y conserva el
original), una herramienta con respaldo añade `backup` a `kind: "external"`, y
marketing o URL sin archivo no cambian. Las imágenes de una lección archivada se
resuelven a `kind: "archive-asset"` (`/archive-assets/<sha256>`). `course/`
sigue sin escribir en ninguna tabla: lee SOURCE para el catálogo y, además, este
índice externo archivado.

## Inmutabilidad

Una sincronización puede crear una nueva versión SOURCE.

Nunca debe modificar el contenido antiguo de forma que se pierda la trazabilidad del commit previo.

## Render

Los renderers deben trabajar desde `raw_content` o una AST fiel del Markdown.

No resumir automáticamente para mostrar una "versión más bonita".
