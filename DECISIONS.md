# Decisions

## ADR-001 — 4Geeks repo is the only pedagogical source

Status: Accepted

La plataforma no mantiene un syllabus paralelo.

## ADR-002 — Source/User/AI separation

Status: Accepted

Contenido fuente, estado personal y respuestas IA son dominios diferentes.

## ADR-003 — Source traceability

Status: Accepted

Todo elemento del curso conserva commit + path + hash.

## ADR-004 — Ingestion before LMS

Status: Accepted

No se construye primero un curso demo.

El LMS se desarrolla sobre contenido real importado.

## ADR-005 — No generated official content

Status: Accepted

La IA no puede persistir material generado como parte oficial del curso.

## ADR-006 — La app vive en platform/ como paquete pnpm independiente

Status: Accepted

El código de la plataforma vive en `platform/`, con su propio `package.json` y
`pnpm-lock.yaml`, sin declarar workspaces. Esto separa el corpus SOURCE
(`content/`, `marketing/`, `assets/`) del código de producto, mantiene el sync
con upstream path-disjoint y evita regenerar el lockfile raíz.

Matiz: `platform/pnpm-workspace.yaml` existe, pero no declara ningún miembro de
workspace (no contiene la clave `packages:`): solo fija la política de build
scripts de pnpm 12 (`allowBuilds`). "Sin declarar workspaces" se refiere a que
`platform/` es un proyecto pnpm independiente (lockfile y virtual store
propios), no a la ausencia de ese archivo de configuración.

## ADR-007 — Stack de fundación

Status: Accepted

Next.js (App Router) + TypeScript strict, Tailwind v4, shadcn/ui vendorizado,
ESLint flat config, `tsc --noEmit` y Vitest + Testing Library. M0 no incluye
base de datos ni IA; PostgreSQL/Supabase sigue como dirección para los hitos de
datos.

## ADR-008 — Guard automatizado contra catálogo hardcodeado

Status: Accepted

Un test falla si el código de la app contiene nombres de proyectos, lecciones o
contextos del syllabus. La denylist se deriva dinámicamente de `content/` y el
guard es fail-closed: sin `content/` falla en lugar de pasar en vacío.

## ADR-009 — Fixtures fuente verificables

Status: Accepted

Los fixtures de test que reproduzcan contenido del syllabus viven en
`platform/fixtures/source/<commit_sha>/<path original>` (copia verbatim,
conservando el path relativo del repo fuente) y se declaran en
`platform/fixtures/source/manifest.json` con `repository`, `commit`, `path` y
`blob_sha` (el SHA-1 de `git hash-object`).

Esto resuelve el conflicto entre `ORCA.md` ("los fixtures deben proceder de
archivos reales del repositorio" y conservar su source path) y el guard
AC-0.10 (ningún nombre del catálogo en `platform/`): el guard calcula el blob
SHA-1 de cada fixture y solo excluye del escaneo de nombres los archivos que
existen, están declarados en el manifiesto y coinciden byte a byte con el blob
declarado. Un archivo no declarado, un fixture alterado o una entrada del
manifiesto sin archivo son violaciones; el propio `manifest.json` se valida
(campos obligatorios, sin duplicados, paths relativos sin `..`) y no se escanea.

Consecuencia: la excepción al guard exige declaración e integridad. El guard no
excluye ningún archivo que no esté declarado en el manifiesto y cuyo contenido no
coincida byte a byte con el `blob_sha` declarado, de modo que un fixture ya dado
de alta no puede alterarse en silencio. `commit` y `path` son declarados por
quien añade el fixture: el guard no los contrasta contra el upstream, por lo que
darlo de alta exige verificar commit, path y blob_sha contra el repositorio
fuente (proceso del Hito 1).

## ADR-010 — Persistencia: PostgreSQL gestionado (Supabase) con Drizzle ORM y tests con PGlite

Status: Accepted

La persistencia SOURCE de la plataforma es PostgreSQL gestionado en Supabase,
con Drizzle ORM como capa de acceso:

- **Producción**: servidor y CLI se conectan directamente a Postgres (URI del
  Session pooler de Supabase) como owner de las tablas, usando `pg` +
  `drizzle-orm/node-postgres`. Motivo: es la dirección de `ARCHITECTURE.md`
  (PostgreSQL/Supabase), encaja sin fricción con `DATA_MODEL.md` (`jsonb`,
  `UNIQUE` compuestos, FKs, `CHECK`) y cubre a la vez Vercel (H2), estado de
  usuario (H3), búsqueda (H5) y `pgvector` (H6) sin migrar de motor. No exigió
  instalar nada local (esta máquina no tiene Docker ni `psql`).
- **Tests sin nube**: `@electric-sql/pglite` (Postgres en WASM) aplica las
  mismas migraciones SQL versionadas de `platform/drizzle/` en memoria. Los
  tests nunca se conectan a Supabase ni leen `DATABASE_URL`; no hay tests que
  dependan de la nube.
- **Migraciones**: `drizzle-kit generate` produce SQL versionado y revisable en
  `platform/drizzle/`; `pnpm --dir platform db:migrate` las aplica a
  `DATABASE_URL` con el migrador de `drizzle-orm/node-postgres`. No se aplica
  ninguna migración remota hasta disponer de `DATABASE_URL`.
- **RLS sin políticas**: todas las tablas llevan `ENABLE ROW LEVEL SECURITY` y
  ninguna política. Así la Data API pública de Supabase (roles
  `anon`/`authenticated` con la anon key) no expone ninguna fila; el servidor
  y la ingesta, que entran como owner, bypassan RLS. Añadir una política real
  es una decisión del hito que incorpore autenticación (H3).
- **Idempotencia e inmutabilidad**: `UNIQUE(repository_id, commit_sha)` en
  snapshots, `UNIQUE(snapshot_id, path)` en archivos e índices, e índices con
  FK `ON DELETE RESTRICT` (nunca cascada). Reimportar un commit es un no-op que
  devuelve el snapshot existente; un commit nuevo crea otro snapshot y no toca
  el anterior.
- **Dependencias**: `tar-stream` (reader del Hito 1), `drizzle-orm` y `pg` en
  runtime; `drizzle-kit`, `@electric-sql/pglite` y `tsx` en desarrollo.
  Ninguna compila código nativo. pnpm 12 exige declarar `allowBuilds` y se
  deniega explícitamente `esbuild: false` (lo traen `drizzle-kit` y `tsx`):
  sus binarios llegan prebuilt vía `optionalDependencies` y ambos funcionan
  con el postinstall ignorado (verificado); `sharp` y `unrs-resolver` siguen
  denegados como en M0.

## ADR-011 — source_import_errors: registrar errores, nunca sustituir contenido

Status: Accepted

`DATA_MODEL.md` no definía tabla de errores de importación y AC-1.13 exige
registrar los fallos sin inventar sustitutos. Se añade `source_import_errors`
(`snapshot_id` con FK `ON DELETE RESTRICT`, `source_path` nullable,
`error_kind` con `CHECK` de los nueve tipos declarados en
`platform/src/source/types.ts`, `message`, `detail jsonb`, `created_at`).

Un fallo por archivo no aborta la importación: se registra el error y el
snapshot termina en `complete_with_errors`; un fallo global (árbol truncado,
commit irresoluble, tarball corrupto) termina en `failed` con su error
registrado. Nunca se rellena, resume, reescribe ni sustituye contenido
educativo: `source_files` jamás contiene filas sintéticas.

## ADR-012 — Semántica de idioma: sufijo + convención de par

Status: Accepted

`language` y `language_evidence` solo se pueblan con evidencia de nombre de
archivo, nunca inferida del contenido ni de traducción:

- `"es"` + `"suffix"`: el archivo termina en `.es.md`.
- `"en"` + `"suffix"`: el archivo termina en `.en.md`.
- `"en"` + `"pair-convention"`: es `X.md` y existe `X.es.md` en el mismo
  directorio (convención declarada en
  `.cursor/rules/readme-translations.mdc`).
- `null` + `null`: cualquier otro caso.

La base de datos restringe por `CHECK` exactamente esas cuatro combinaciones,
incluida `null`/`null`, en `source_files`, `source_projects`,
`source_contexts` y `source_lessons`. La decisión del usuario se registró como
"sufijo + convención".

## ADR-013 — Capa `course/` de lectura server-only sobre el snapshot activo

Status: Accepted

La UI no consulta `source/` ni escribe SQL propio: lee a través de una capa
nueva `platform/src/course/` marcada con `server-only`, que usa el mismo
esquema Drizzle en modo solo lectura. El **snapshot activo** es la fila de
`source_snapshots` con `status IN ('complete','complete_with_errors')` más
reciente por `imported_at`. Sin snapshot activo o sin `DATABASE_URL`, todas las
funciones devuelven `null`/`[]` (nunca lanzan por falta de configuración) y la
UI muestra el estado vacío neutro; los errores reales de conexión se propagan
con mensaje redactado (`src/lib/redact.ts`) para `error.tsx`. El pool `pg` se
crea de forma perezosa (importar el módulo no conecta), de modo que `next build`
compila sin `DATABASE_URL`.

Orden, títulos, descripciones y variantes de idioma se derivan **en lectura**
con funciones puras desde `raw_content`/paths, sin escribir en la base ni
reingestar: se respetan la inmutabilidad y la idempotencia de M1. Los
subproyectos anidados (carpetas hijas directas de un proyecto de primer nivel
que contienen `learn.json`) también se derivan en lectura desde `source_files`
y se muestran en la vista del proyecto padre y en una ruta propia, sin filas
nuevas en `source_projects`. `learn.json` no se parsea ni se muestra en H2
(queda como material auxiliar para H4); ninguna derivación inventa contenido.

## ADR-014 — Render Markdown fiel server-side con allowlist de saneado

Status: Accepted

El Markdown del corpus y su HTML embebido real se renderizan en un Server
Component (`SourceMarkdown`) con el pipeline
`remarkPlugins=[remarkGfm, remarkFrontmatter]` y
`rehypePlugins=[rehypeRaw, [rehypeSanitize, schema]]`. `remark-gfm` cubre
tablas y task lists; `remark-frontmatter` oculta el YAML de las lecciones
(nunca se muestra como texto); `rehype-raw` parsea el HTML real (`details`,
`table`, `div`, `img`, `br`) y `rehype-sanitize` aplica una allowlist cerrada
antes de renderizar.

La allowlist permite `p`, `h1`..`h6`, `ul`, `ol`, `li`, `blockquote`, `pre`,
`code`, `em`, `strong`, `del`, `a[href|title]`,
`img[src|alt|title|width|height]`, `hr`, `br`, `table`/`thead`/`tbody`/`tr`/
`th`/`td`, `details`, `summary`,
`input[type=checkbox][checked][disabled]`, `span` y `div`, con protocolos
`http`, `https`, `mailto` y relativos; prohíbe `script`, `style`, `iframe`,
`object`/`embed`, atributos `on*` y URLs `javascript:`/`data:`. El corpus es de
un repo público de terceros: sin `rehype-raw` el HTML se vería como texto
(infiel) y sin saneado habría XSS almacenado, por lo que `skipHtml` no es
aceptable. No se usa `dangerouslySetInnerHTML` ni resaltado de sintaxis ni TOC
en H2. Toda URL de `a[href]`/`img[src]` pasa por `resolveUrl` después del
saneado; el frontmatter no se renderiza.

## ADR-015 — Política única de enlaces relativos

Status: Accepted

Toda referencia relativa de un documento se resuelve con una única política,
construida una vez por snapshot (mapa de paths a `blob_sha`/`binary_reference`
memoizado, sin consultas por enlace):

1. **Tiene vista interna** (documento preferido o variante de una unidad, o
   documento de un contexto): ruta interna de `src/course/routes.ts`.
2. **Existe en el snapshot pero no tiene vista**: URL de GitHub `blob`/`tree`
   **pinneada al commit**; un binario usa su `binary_reference` (raw).
3. **No existe en el snapshot**: se muestra como **roto** (span sin `href`,
   `aria-disabled="true"`, estilo visible y
   `title="Enlace roto en el origen: <rawHref>"`), conservando el texto literal
   del enlace. Nunca se "arregla" ni se redirige a un destino inventado; una
   imagen rota muestra su `alt` literal marcado como roto.
4. **Externo** (`http(s)`, `mailto`): intacto, con `target="_blank"`,
   `rel="noopener noreferrer"` y aviso accesible de salida.
5. **Anclas** (`#...`): se dejan tal cual.

Consecuencia: los enlaces rotos del corpus (Apéndice B del plan de M2) quedan
visibles como tales; ninguna URL apunta a `main`, siempre al commit importado.

## ADR-016 — Assets vía `binary_reference` pinneada, sin proxy ni `next/image`

Status: Accepted; parcialmente reemplazado por ADR-018 (el servido de assets
pasa a ser propio desde `source_blobs`).

El store no guarda los bytes binarios: cada binario (118/118 verificados) tiene
solo una `binary_reference` con forma
`https://raw.githubusercontent.com/<owner>/<name>/<commit>/<path>`. H2 la usa
directamente: imágenes inline con
`<img loading="lazy" decoding="async" referrerPolicy="no-referrer">` y el resto
de assets (PDF, CSV, JSON…) como enlace de descarga a esa misma URL.

No se añade route handler ni proxy en H2: los bytes no están en el store, así
que un proxy solo reenviaría la descarga de GitHub añadiendo latencia, punto de
fallo y consumo de red del servidor, y la URL ya es inmutable (commit, no rama)
y cacheable. `next/image` queda descartado (implicaría fetch remoto en servidor
y `remotePatterns`). Visores de PDF/CSV y servido propio quedan como candidatos
de H4/BACKLOG (`/api/source-asset/[...path]`).

## ADR-017 — Orden y títulos literales derivados de la fuente

Status: Accepted

Ningún título, descripción, orden, sección, nivel, duración ni etiqueta se
inventa ni se escribe en código: todo sale del snapshot importado o de una
derivación literal de él. El título de una unidad es, en este orden, la
etiqueta literal del enlace del README de proyectos (emparejando por slug), el
primer H1 del documento preferido (sin frontmatter) o el slug del `source_path`.
Las descripciones existen solo para proyectos/subproyectos listados y son el
texto literal de la entrada del README en el idioma pedido.

El orden de `/projects` proviene de `content/projects/README.md` (primera
aparición del enlace por slug; se conservan los encabezados `##` literales);
los proyectos no listados van al final por `source_path` con sección nula. Los
contextos y lecciones se listan por `source_path` (el README de contextos no es
un orden canónico: contiene enlaces rotos y no cubre todas las carpetas). El
idioma inicial es el documento preferido (español cuando existe) según ADR-012 y
el selector solo aparece con dos o más variantes reales; no se traduce nada.

## ADR-018 — Independencia de 4Geeks en tiempo de ejecución

Status: Accepted (reemplaza la parte de servido de assets de ADR-016)

Requisito del usuario (2026-10-02): la plataforma debe seguir funcionando aunque
desaparezca el acceso al bootcamp y a los repos/hosts de 4Geeks. Hasta ahora
había tres dependencias en runtime: los 118 binarios se cargaban de
`raw.githubusercontent.com` vía `binary_reference`; los enlaces "Ver en GitHub" y
los directorios apuntaban a `github.com/4GeeksAcademy/...`; y la ingesta usaba
por defecto el repositorio de 4Geeks.

Decisión:

- **Bytes en Postgres.** Nueva tabla `source_blobs`
  (`blob_sha` PK, `bytes bytea NOT NULL`, `byte_size`), direccionada por
  contenido: la clave es el SHA-1 git del blob, de modo que un mismo binario
  importado en varios snapshots comparte una sola fila. La ingesta guarda los
  bytes junto a `source_files` (primero los blobs, con verificación
  `gitBlobSha(bytes) === blob_sha` y `ON CONFLICT (blob_sha) DO NOTHING`), y el
  CLI `blobs:backfill` rellena los snapshots ya importados sin bytes
  (`--dry-run` y `--from-dir <checkout local>` disponibles).
- **Servido propio.** La UI deja de usar `binary_reference` para cargar
  assets: sirve los bytes desde la propia app en `GET /source-files/<path>`
  (route handler: binario → `source_blobs`; texto sin vista interna →
  `raw_content` crudo). Sin proxy a GitHub y sin `next/image`.
- **Espejo configurable.** Los enlaces "Ver en GitHub" y a directorios usan
  `SOURCE_MIRROR_REPOSITORY` (repo espejo; si no está definido, el repo del
  snapshot). La **procedencia textual sigue diciendo la verdad**: repositorio
  de origen, commit, path y blob del snapshot; `binary_reference` se conserva
  como dato de procedencia aunque la UI ya no lo use para cargar.
- **Alcance.** El archivado de las lecciones externas de `4geeks.com` no entra
  en esta ronda: queda para el hito de autonomía.

Consecuencias: la base pasa a almacenar ≈6,6 MB de binarios (máx. 0,4 MB por
archivo); `source_blobs` es global (sin FK a snapshots) y no se borra en cascada;
los binarios de un snapshot antiguo cuyos bytes no se hayan backfilleado se
sirven solo si el backfill se ejecutó para ese `blob_sha`.

## ADR-019 — Idioma global de la interfaz

Status: Accepted (reemplaza el selector por documento de ADR-012/§3.6 del plan
en lo relativo a la UI; no cambia la semántica de idioma de ADR-012)

La interfaz tiene un único selector pequeño ES/EN en la cabecera del shell y
toda la app sigue esa elección: en español solo se ve lo español y en inglés
solo lo inglés (listas, títulos, descripciones del README de proyectos,
documentos mostrados y lista de documentos de cada contexto: de cada par de
variantes solo la del idioma elegido), incluidos los copys neutros de interfaz.
El idioma se guarda en la cookie `lang` (path `/`, 1 año, `SameSite=Lax`); la
ruta `GET /preferences/language/[lang]` valida el valor y redirige 303 a un
`next` interno (si no es un path relativo válido, a `/projects`). Por defecto:
`es`; un valor inválido o ausente también cae a `es`. No hay selectores por
documento o página, y `?lang` en URLs antiguas se ignora (sin 404).

Si un documento no tiene variante en el idioma elegido, se muestra la que exista
con una nota de interfaz pequeña y neutra ("Solo disponible en inglés" / "Only
available in Spanish"); los archivos sin idioma (`null`) se muestran tal cual.
Nada se traduce ni se inventa: el contenido educativo sigue saliendo literal del
snapshot y las variantes son las de ADR-012.

## ADR-020 — Clase EXTERNAL_ARCHIVE: material externo enlazado, archivado literal y separado de SOURCE

Status: Accepted (2026-10-02)

`CONTENT_CONTRACT.md` define SOURCE (importado del repo), USER y AI_RESPONSE. El
Hito 2.5 añade una cuarta clase: `EXTERNAL_ARCHIVE`.

- **Qué es**: copias literales de material externo (lecciones de `4geeks.com` y
  metadatos de respaldo Wayback de herramientas) **enlazado por documentos del
  corpus**, conservadas para que el curso siga consultable si desaparece el
  acceso a 4Geeks. La auditoría del 2026-10-02 midió 1463 ocurrencias y 49 URL
  canónicas: 8 URL de lección (5 con fuente archivada → 3 ficheros Markdown; el
  resto se sustituye por alias, ver abajo), 4 URL de herramienta y 37 URL de
  marketing que no se archivan (AC-2.5.6).
- **Qué no es**: no es contenido oficial del curso, no es SOURCE y no se mezcla
  con el catálogo. Vive en tablas propias (`external_archive_items`,
  `external_archive_assets`, `external_archive_item_assets`) y se muestra en una
  ruta propia marcada (`/archive/…`), con su URL original, fecha de captura,
  método y hash.
- **Fidelidad**: se guarda tal cual (Markdown literal, `sha256` verificable);
  sin resúmenes, traducciones, títulos ni descripciones generadas. El `title`
  del item solo se guarda si es literal (frontmatter/H1/API). Las únicas
  transformaciones son de render (URLs de imagen a `/archive-assets/…` y
  reescritura de enlaces, ADR-014/ADR-015), permitidas por el contrato de
  fidelidad.
- **No contradice `SOURCE_OF_TRUTH.md`**: la única fuente de contenido
  educativo oficial sigue siendo `4GeeksAcademy/ai-engineering-syllabus`. El
  archivo es material enlazado desde el propio repo, conservado como cita
  literal y marcado; no sustituye, resume, traduce ni reordena el syllabus, y
  nunca se presenta como contenido oficial.
- **Captura**: CLI propio idempotente (`pnpm archive:external`, `--dry-run`),
  sin escrituras en el snapshot SOURCE ni en sus tablas. Se captura la lección
  vía API pública del registro BreatheCode (`/v1/registry/asset/<slug>`) y raw
  de GitHub con commit pinneado (`breatheco-de/knowledge-base`); el hash y la
  procedencia (`source_repository`, `source_commit`, `source_path`) quedan
  registrados. Nunca se pide `learn.4geeks.com` (robots `Disallow: /`) ni
  `4geeks.com/api/*`; la API solo se usa en captura, jamás en runtime.
- **Sin Save Page Now**: no se envía nada a archive.org. Las herramientas
  conservan el enlace original y, solo si ya existe captura, muestran el
  respaldo Wayback claramente etiquetado (en la auditoría del 2026-10-02 solo
  `playground.4geeks.com/tracker/api/v1/docs`); no existe el modo
  `--request-wayback`.
- **Licencia**: `breatheco-de/knowledge-base` es público pero no declara
  licencia (`license: null`). El usuario confirmó (2026-10-02) la copia literal
  para consulta personal offline, marcada como material externo y sin
  redistribución.
- **Lecciones retiradas = alias decididos por el usuario**: las URL de lección
  sin fuente pública ni captura Wayback (3 canónicas y 15 ocurrencias en la
  auditoría del 2026-10-02) no quedan sin página: se registran como
  `status = 'alias'`, `method = 'user-alias'` y `alias_of_canonical_url` hacia
  la lección equivalente archivada (variante `/es/` → destino ES; resto →
  destino EN; la misma regla cubre cualquier variante adicional del inventario
  real). El mapa vive como dato versionado
  (`platform/src/external-archive/aliases.json`, con `decidedBy: "user"`,
  `decidedAt: "2026-10-02"` y motivo), no en código; el contenido mostrado es
  el Markdown literal del destino (la fila alias no copia bytes) y la página
  añade un aviso visible y persistente de sustitución, con enlace al original
  retirado y a la copia del destino. No es invención: no se genera texto
  educativo, es una sustitución explícita, marcada y reversible (editar el dato
  versionado revierte la decisión). Un enlace del corpus hacia una URL retirada
  abre esa página y el idioma global (ADR-019) elige la variante del destino.
- **Runtime**: leer `/archive/…` no requiere ningún host externo; los enlaces al
  original y a Wayback son acciones del usuario. Sin peticiones salientes en el
  render.

Consecuencias: las tablas `external_archive_*` son globales (direccionadas por
URL canónica y `sha256`, no por snapshot), con RLS sin políticas como el store
SOURCE (ADR-010); el contenido enlazado desde una lección archivada que no esté
en el índice del corpus sigue siendo un enlace externo (no hay archivado
recursivo); el guard de ADR-008 sigue aplicando (el inventario y el contenido
salen de la base, nunca hardcodeados).
