# M2B-QA-T — QA técnica AC por AC (READ-ONLY)

- Hito: **Hito 2.5 — Autonomía de 4Geeks** (`docs/milestones/M2B_AUTONOMY.md`, AC-2.5.1..AC-2.5.10).
- Fecha: 2026-10-02. Rama: `m2b-autonomy` (árbol de trabajo con los cambios sin commitear de W0–W3 y D0; sin commits, sin cambio de rama, sin push).
- Plan de referencia: `docs/milestones/M2B_AUDIT_PLAN.md` (§3, §5, §6 y §8 prevalecen) + `docs/milestones/M2B_LINK_INVENTORY.md`.
- Único artefacto escrito por esta tarea: **este informe**. Se re-ejecutó el CLI de captura (única escritura permitida, AC-2.5.7) y dio **0 cambios**. No se tocó código, migraciones, `.env.local` ni el servidor de desarrollo.
- Entorno: dev server del coordinador en `http://localhost:3100` (no se paró ni se arrancó otro). Los scripts efímeros y las builds temporales vivieron fuera del repo, en `/var/folders/yk/…/T/opencode/m2b-qa/`.
- `DATABASE_URL` se cargó desde `platform/.env.local` dentro de scripts efímeros y **nunca** se imprimió, copió ni registró; todas las consultas SQL corrieron dentro de `BEGIN READ ONLY` con `SET LOCAL statement_timeout = '60s'`.
- Resultado global: **10 PASS · 0 FAIL · 0 PARTIAL**. Tres hallazgos no bloqueantes: **T-01 (MAJOR)**, **T-02 (MINOR)**, **T-03 (MINOR)**.

## 0. Resumen de veredictos

| AC        | Veredicto | Evidencia principal                                                                                                                                                                                        | Hallazgo                  |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| AC-2.5.1  | PASS      | Inventario reproducible: CLI `--dry-run --resolve` da 1543 ocurrencias / 127 URL / 180 docs (archivables 1463/49/180), idéntico a §2 del plan y a `M2B_LINK_INVENTORY.md`; test `inventory.test.ts` verde. | —                         |
| AC-2.5.2  | PASS      | 8 items de lección: 5 `captured` (3 ficheros Markdown literales, sha256 = §3.3) + 3 `alias` (`user-alias`, §8); 12 assets con sha256 verificado; 33 enlaces item↔asset.                                    | —                         |
| AC-2.5.3  | PASS      | `/archive/…` con `role="note"` y texto literal «Material externo archivado. No forma parte del repositorio.» + URL original + fecha + método + hash (curl ES/EN).                                          | —                         |
| AC-2.5.4  | PASS      | Enlaces del corpus reescritos a `/archive/…` (lección capturada y URL retirada/alias) con acceso al original en el banner; 200 y contenido correcto por curl.                                              | T-01 (riesgo de frescura) |
| AC-2.5.5  | PASS      | Tool `playground…/docs`: original intacto + respaldo Wayback etiquetado; `diagram` y `learn` solo original (sin captura). En el Markdown, AC cumplido.                                                     | T-02                      |
| AC-2.5.6  | PASS      | Diff render vs Markdown fuente: 0 URL de marketing alteradas; solo se reescribe la lección archivada. Hosts de marketing ausentes del índice.                                                              | —                         |
| AC-2.5.7  | PASS      | `--dry-run` con 0 escrituras (fingerprint de la tabla idéntico) y re-ejecución real con `insertadas 0 / actualizadas 0 / sin cambios 5+1+33`; `source_files`/`source_snapshots` = 899/1.                   | T-03 (copy del informe)   |
| AC-2.5.8  | PASS      | 0 `fetch` en el código de render (grep) y tests con `fetch` espiado; imágenes de `/archive` servidas desde `/archive-assets/<sha256>`; 0 `src` externos en el HTML.                                        | —                         |
| AC-2.5.9  | PASS      | `DECISIONS.md:342` ADR-020 `Accepted (2026-10-02)` con clase `EXTERNAL_ARCHIVE` separada de SOURCE; tablas propias con RLS.                                                                                | —                         |
| AC-2.5.10 | PASS      | `content_sha256` recalculado en SQL = guardado = fixture (3/3); títulos literales del registro; guard `no-hardcoded-catalog.test.ts` verde (14 tests).                                                     | —                         |

## 1. Comprobaciones transversales (literales)

### 1.1 lint

```text
$ npx --yes pnpm@12.8.1 --dir platform lint
$ eslint .
```

Sin diagnósticos (exit 0).

### 1.2 typecheck

```text
$ npx --yes pnpm@12.8.1 --dir platform typecheck
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

Sin errores de `tsc` (exit 0).

### 1.3 test

```text
$ npx --yes pnpm@12.8.1 --dir platform test
$ vitest run
 Test Files  69 passed | 1 skipped (70)
      Tests  689 passed | 1 skipped (690)
   Duration  16.90s
```

El único skip es el smoke test de GitHub desactivado por defecto (`platform/src/source/github/smoke.test.ts:28`, `describe.skip` cuando no hay flag).

### 1.4 prettier

```text
$ npx --yes prettier@3.8.3 --check .   # dentro de platform/
Checking formatting...
All matched files use Prettier code style!
```

### 1.5 `next build` sin `DATABASE_URL`

No existe variable `NEXT_DIST_DIR`; el mecanismo documentado es `distDir` de `next.config.ts` (no editable en READ-ONLY) y, en Next 16.3.8, la separación dev/build: `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md` («Development builds output to `.next/dev` instead of `.next`. This allows you to run `next dev` and `next build` concurrently without conflicts»).

**Build A (in-place, con el dev server en marcha):**

```text
$ DATABASE_URL= npx --yes pnpm@12.8.1 --dir platform build
▲ Next.js 16.3.8 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 956ms
✓ Generating static pages using 9 workers (6/6) in 46ms

Route (app)                              ...
┌ ƒ /            ├ ƒ /_not-found      ├ ƒ /archive-assets/[sha256]
├ ƒ /archive/[...path]  ├ ƒ /contexts ... ├ ƒ /projects/[slug]/[subslug]
└ ƒ /source-files/[...path]
ƒ  (Dynamic)  server-rendered on demand
```

`DATABASE_URL=` (vacío) prevalece sobre `.env.local` y `getCourseDatabaseUrl()` (`platform/src/course/database.ts:29-32`) trata la cadena vacía como ausente. El dev server siguió vivo antes y después (`dev:307` → `dev-tras-build:200`).

**Build B (limpia, en directorio temporal, sin `.env.local` y sin `DATABASE_URL` en el entorno):**

Copia del árbol de trabajo fuera del repo (`/var/folders/yk/…/T/opencode/m2b-qa/build-copy`, `node_modules` clonado con `cp -Rc`), sin `.env.local`, `env | grep '^DATABASE_URL='` = 0 coincidencias:

```text
$ "$TMP/node_modules/.bin/next" build
✓ Compiled successfully in 1889ms
✓ Generating static pages using 9 workers (6/6) in 51ms
Route (app): 14 rutas, todas ƒ (Dynamic)
```

Nota: con el binario `next` de `platform/node_modules` ejecutado sobre la copia, el build falló con un invariante de Next (`Expected workStore to be initialized` en `/_global-error`) por mezclar dos copias de React; usando el binario de la propia copia el build limpio pasa. Es un artefacto del método de copia, no del proyecto.

### 1.6 Integridad del snapshot SOURCE y del archivo (antes/después de todo)

Consultas `SELECT` dentro de `BEGIN READ ONLY`:

| Tabla                          | Antes | Después de dry-run | Después de re-ejecución real |
| ------------------------------ | ----: | -----------------: | ---------------------------: |
| `source_files`                 |   899 |                899 |                          899 |
| `source_snapshots`             |     1 |                  1 |                            1 |
| `source_blobs`                 |   112 |                112 |                          112 |
| `external_archive_items`       |    12 |                 12 |                           12 |
| `external_archive_assets`      |    12 |                 12 |                           12 |
| `external_archive_item_assets` |    33 |                 33 |                           33 |

Fingerprint de idempotencia (`json_agg` de `canonical_url, kind, status, method, content_sha256, captured_at, updated_at, alias_of_canonical_url, wayback_url` ordenado):

```text
d3bac740ac3f968079a300e1aa46abb51dda1f898f01537d83c46946407c1bb5  fingerprint-before.json
d3bac740ac3f968079a300e1aa46abb51dda1f898f01537d83c46946407c1bb5  fingerprint-after-dry.json
d3bac740ac3f968079a300e1aa46abb51dda1f898f01537d83c46946407c1bb5  fingerprint-after-real.json
d3bac740ac3f968079a300e1aa46abb51dda1f898f01537d83c46946407c1bb5  fingerprint-final.json
```

### 1.7 Árbol de trabajo

`git status --porcelain` antes y después de la QA: 32 entradas (19 modificadas + 13 sin seguimiento), idénticas. Esta tarea no añadió ni modificó ningún archivo salvo este informe.

---

## 2. Evidencia AC por AC

### AC-2.5.1 — Inventario reproducible

**Veredicto: PASS.**

Comando de la cabecera de `docs/milestones/M2B_LINK_INVENTORY.md` re-ejecutado:

```text
$ npx --yes pnpm@12.8.1 --dir platform archive:external --dry-run --resolve --report text --inventory-out /tmp/m2b-inventory.json
archivo externo: dry-run --resolve (GETs, sin escrituras)
inventario (snapshot): 781 archivos, 1543 ocurrencias, 127 URLs canónicas, 180 documentos
  hosts: 4geeks.com=294, 4geeksacademy.com=1143, breathecode.herokuapp.com=80, diagram.4geeks.com=14, learn.4geeks.com=4, playground.4geeks.com=8
  clases: lesson=122 occ/8 urls, tool=26 occ/4 urls, marketing=1315 occ/37 urls, out-of-scope=80 occ/78 urls
```

Totales archivables = 1543 − 80 (breathecode, fuera de alcance) = **1463 ocurrencias**, 127 − 78 = **49 URL canónicas**, **180 documentos**: idénticos a §2 del plan. `M2B_LINK_INVENTORY.md` declara los mismos totales. Implementación: `platform/src/external-archive/inventory.ts`; test `platform/src/external-archive/inventory.test.ts:174` («produce los totales reales del subconjunto»).

### AC-2.5.2 — Lecciones archivadas literales, con imágenes y procedencia

**Veredicto: PASS** (con la salvedad §8: las 3 URL retiradas son alias, no copias).

`SELECT` read-only de items de lección: 5 `captured` + 3 `alias` (8 URL canónicas del corpus, §2.4). Los 5 `captured` guardan `original_url`, `captured_at` (2026-10-02T18:47:23.152Z), `method = registry-api+github-raw`, `content_sha256` y procedencia (`breatheco-de/knowledge-base` @ `8f3c556fbe2dd7c3c129b4e000c642ff570a1b7a`):

| `source_path`                          | sha256 guardado = recalculado en SQL = fixture                     |
| -------------------------------------- | ------------------------------------------------------------------ |
| `content/how-to-start-a-project.md`    | `9261997020916708e1a9b7f88417a2a5baaacb49f654eb0e6a92126dde6b1a2e` |
| `content/how-to-start-a-project.es.md` | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` |
| `content/what-is-github-codespaces.md` | `a14968e4ad5c9991221370e9c9f6ae3c4f114c427b62d59fb5491ed7129734f6` |

Coinciden con §3.3 del plan y con `shasum -a 256` de `platform/fixtures/external-archive/knowledge-base/8f3c556f…/content/*.md`. Imágenes: 12 assets con `sha256` del contenido verificado en SQL (`encode(sha256(bytes),'hex') = sha256` → `true` en 12/12) y 33 enlaces `external_archive_item_assets` (7+7+7+7+5 = referencias `![…]()` reales de los 3 Markdown). Los 3 alias tienen `content`/`content_sha256` nulos (no copian bytes, §8b) y `method = user-alias`.

### AC-2.5.3 — Vista interna marcada

**Veredicto: PASS.**

```text
$ curl -s -b 'lang=es' http://localhost:3100/archive/4geeks.com/lesson/how-to-start-a-project
Material externo archivado. No forma parte del repositorio.
URL original · https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion
Capturado el 2 de octubre de 2026 · Método registry-api+github-raw · Hash sha256:5424302d0b6b…
```

```text
$ curl -s -b 'lang=en' http://localhost:3100/archive/4geeks.com/lesson/how-to-start-a-project
Archived external material. Not part of the repository.
Original URL · https://4geeks.com/lesson/how-to-start-a-project
Captured on October 2, 2026 · Method registry-api+github-raw · Hash sha256:926199702091…
```

El aviso es un `<section role="note">` persistente (no descartable) en `platform/src/components/external-material-banner.tsx:117-122`; los copys ES/EN están en `:45-66`. El original va como enlace externo `target="_blank" rel="noopener noreferrer"`. Título literal (`item.title` o H1 del documento) en `platform/src/app/archive/[...path]/page.tsx:94-103`.

### AC-2.5.4 — Enlaces del Markdown → copia archivada, con original

**Veredicto: PASS.** (Riesgo de frescura por T-01.)

Diff de hrefs render vs Markdown fuente en `/projects/ai-eng-performance-caching` (ES): el único cambio es la reescritura de `https://4geeks.com/es/lesson/how-to-start-a-project` → `href="/archive/4geeks.com/es/lesson/how-to-start-a-project"`. En EN: `https://4geeks.com/lesson/how-to-start-a-project` → `/archive/4geeks.com/lesson/how-to-start-a-project`.

URL retirada en `/projects/ai-eng-building-bullet-proof-applications` (ES): `href="/archive/4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion"` (×2). La página alias muestra el aviso de sustitución y enlaza al original retirado y a la copia del destino:

```text
La lección original ya no existe en 4Geeks y no tiene copia archivada. En su lugar se muestra la lección de 4Geeks «Cómo comenzar un proyecto de programación», elegida por el usuario como equivalente.
Ver la URL original retirada → https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion
Ver la copia archivada de la lección equivalente → /archive/4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion
```

Implementación: `platform/src/course/links.ts:177-205` (`externalArchiveMarkdownUrl`) y `platform/src/course/external-archive.ts:96-120`; tests `platform/src/course/links.test.ts:661` (capturada), `:700` (alias), `:789` (PGlite con `CourseReader`).

### AC-2.5.5 — Herramientas: original + respaldo Wayback marcado

**Veredicto: PASS.**

`/projects/ai-eng-milestone-frontend-development` (ES y EN) renderiza:

```text
href="https://playground.4geeks.com/tracker/api/v1/docs"  (original intacto)
href="http://web.archive.org/web/20260613092255/https://playground.4geeks.com/tracker/api/v1/docs"
  → texto visible: "Respaldo en Wayback Machine (13 jun 2026)"
```

`diagram.4geeks.com` (sin captura) conserva el original y **no** añade respaldo; `learn.4geeks.com` (sin captura) igual. Renderer: `platform/src/components/source-markdown.tsx:149-168`; tests `source-markdown.test.tsx:618` y `:601`. Datos: `external_archive_items` tiene `wayback_url` solo en `playground…/docs`. Ver hallazgo **T-02** (la página `/archive/<tool>` no muestra ese respaldo).

### AC-2.5.6 — Marketing intacto

**Veredicto: PASS.**

Comparación exhaustiva render vs Markdown fuente (hosts `4geeks.com`/`4geeksacademy.com`) en 3 páginas:

```text
== ai-eng-performance-caching-es ==          solo en HTML: ninguna; solo en Markdown (reescrita): es/lesson/how-to-start-a-project
== ai-eng-building-bullet-proof-applications-es ==  solo en HTML: ninguna; solo en Markdown (reescrita): es/lesson/como-iniciar…
== data-modeling-and-class-diagrams-digital-wallet-es == solo en HTML: ninguna; solo en Markdown (reescrita): es/lesson/como-iniciar…
```

Ejemplos literales intactos: `href="https://4geeksacademy.com/es/comparar-programas"`, `href="https://4geeksacademy.com/"`, `href="https://4geeks.com"`, `href="https://x.com/4geeksacademy"`. El índice de archivo no contiene hosts de marketing (los `kind` solo admiten `lesson`/`tool`). Test `links.test.ts:758`.

### AC-2.5.7 — Captura idempotente con CLI y `--dry-run`, sin efectos en SOURCE

**Veredicto: PASS.**

```text
$ npx --yes pnpm@12.8.1 --dir platform archive:external --dry-run --report text
archivo externo: dry-run (sin red, sin escrituras)
...
alias: aplicados 3, omitidos 0
```

Tras el dry-run, fingerprint y conteos idénticos (0 escrituras). Re-ejecución real:

```text
$ npx --yes pnpm@12.8.1 --dir platform archive:external --report text
archivo externo: captura real
lecciones: capturadas 5, insertadas 0, actualizadas 0, sin cambios 5, unavailable 0, alias 3, errores 0
herramientas: capturadas 1, insertadas 0, actualizadas 0, sin cambios 1, unavailable 3, alias 0, errores 0
assets: insertados 0, sin cambios 33, enlaces 33, fallos 0
```

Fingerprint final idéntico (incluye `captured_at`/`updated_at`), `source_files`/`source_snapshots` = 899/1. Aislamiento por código: el CLI solo hace `SELECT` sobre `source_files` (`inventory.ts:334-345`) y escribe únicamente en `external_archive_*` (`store.ts:214,253,272,308,361`). Tests: `cli.test.ts:335` (idempotencia con `captured_at` intacto), `:253` (dry-run sin escrituras). Ver **T-03** (copy «aplicados» en dry-run).

### AC-2.5.8 — Lectura sin hosts de 4Geeks en runtime

**Veredicto: PASS.**

Grep de `fetch(` sobre `src/app/archive/**`, `src/app/archive-assets/**`, `src/components/external-material-banner.tsx`, `src/components/source-markdown.tsx`, `src/course/{external-archive,links,routes}.ts`: **sin resultados**. Tests:

```text
$ npx --yes pnpm@12.8.1 test "src/app/archive/[...path]/page.test.tsx" src/course/external-archive.test.ts
 Test Files  2 passed (2)
      Tests  27 passed (27)
```

`page.test.tsx:278` («no hace ninguna petición de red durante el render (AC-2.5.8)») espía `globalThis.fetch` y afirma `not.toHaveBeenCalled()`; `external-archive.test.ts:358,388` hace lo mismo en la capa `course/`. En el HTML de las páginas de archivo: 0 `src="http(s)://…"` (todas las imágenes son `/archive-assets/<sha256>`). Assets servidos por `platform/src/app/archive-assets/[sha256]/route.ts` con allowlist raster, `nosniff`, CSP `sandbox`, `ETag` = sha256 y caché inmutable.

### AC-2.5.9 — ADR de la clase EXTERNAL_ARCHIVE

**Veredicto: PASS.**

`DECISIONS.md:342` → «ADR-020 — Clase EXTERNAL_ARCHIVE: material externo enlazado, archivado literal y separado de SOURCE», `Status: Accepted (2026-10-02)`. Define qué es/no es, fidelidad, no contradicción con `SOURCE_OF_TRUTH.md`, captura idempotente sin escrituras SOURCE, sin Save Page Now, licencia y alias de lecciones retiradas. `CONTENT_CONTRACT.md:40`, `ARCHITECTURE.md:89`, `DATA_MODEL.md:245` y `SOURCE_OF_TRUTH.md:96` referencian la clase. Migración `platform/drizzle/0002_chunky_hairball.sql` con las 3 tablas y `ENABLE ROW LEVEL SECURITY`; verificado en base: RLS `true` y 0 políticas en las 3 tablas del archivo.

### AC-2.5.10 — Nada inventado: literal, sin resúmenes ni traducciones

**Veredicto: PASS.**

- Contenido byte a byte: `encode(sha256(convert_to(content,'UTF8')),'hex')` = `content_sha256` = sha256 del fixture en los 3 ficheros (tabla de AC-2.5.2). `length(content)` = 6650/6087/6387 caracteres; `octet_length` = 6743/6100/6429 bytes = tamaños del manifiesto.
- Títulos literales del registro: `Cómo comenzar un proyecto de programación`, `How to start coding a project`, `What is Github Codespaces` (comparados con `platform/fixtures/external-archive/registry/*.json`).
- La variante ES que se muestra con cookie `lang=es` es el fichero `.es.md` de la fuente, no una traducción generada; con `lang=en` se elige el par EN por `source_path` (`external-archive.ts:166-183,269-302`).
- Copys añadidos: solo interfaz neutra (banner, «(copia archivada)», «Respaldo en Wayback Machine», aviso de sustitución).
- Guard AC-0.10: `npx --yes pnpm@12.8.1 --dir platform test src/test/no-hardcoded-catalog.test.ts` → `Test Files 1 passed (1) · Tests 14 passed (14)`.
- Saneado del material externo: `page.test.tsx:257` (script/onerror fuera).

---

## 3. Hallazgos

### T-01 — MAJOR: el índice EXTERNAL_ARCHIVE se memoiza en memoria sin invalidación

**Estado:** abierto. **Afecta a:** frescura de AC-2.5.4/AC-2.5.5 (un servidor en marcha no ve capturas nuevas hasta reiniciar). **Evidencia:** observación del coordinador durante el handoff W1→W3 (el dev server no vio la captura de W1 hasta reiniciarlo) + lectura de código.

**Causa.** Hay tres capas de caché de proceso:

1. `platform/src/course/external-archive.ts:189` (`private index: Promise<ArchiveIndex> | null = null`) y `:385-396`: `currentExternalArchiveReader()` guarda una instancia de lector en módulo, con clave = identidad del objeto `db` (estable, porque el pool vive en `globalThis` en `database.ts:43-56`). El índice se construye una sola vez por proceso.
2. `platform/src/course/reader.ts:151-155` y `:1203-1217`: `SnapshotContext.externalArchiveIndex` memoiza el mismo índice dentro del contexto del snapshot, que se guarda en `CourseReader.contexts` (`:205-208,266-278`) para toda la vida del `CourseReader`.
3. `platform/src/course/index.ts:80-92`: `currentReader()` guarda el `CourseReader` en módulo, y `reader.ts:210,1219-1224` guarda a su vez otro lector de archivo por instancia. El proceso entero comparte ambas cachés.

A diferencia del snapshot SOURCE (inmutable una vez `complete`, por eso su memo por `snapshotId` es correcto), `external_archive_items` es una tabla global y **mutable**: re-ejecutar `archive:external` puede insertar/actualizar filas. Con el índice cacheado, esas filas no aparecen hasta reiniciar (dev: salvo que HMR reevalúe los módulos; producción: nunca).

**Corrección mínima propuesta** (coherente con el plan §5.3, «una vez por request», y con el patrón de memoización de H2):

1. `platform/src/course/external-archive.ts:385-396` — sustituir las dos variables de módulo por una memoización por request con `cache()` de React:
   `const currentExternalArchiveReader = cache(() => createExternalArchiveReader(getCourseDb()));`
   En el servidor de React, `cache()` fuera de un request simplemente invoca la función sin cachear (`react.react-server.development.js:577-578`), así que route handlers y tests no se rompen.
2. `platform/src/course/reader.ts:151-155,354,1203-1217` — eliminar `SnapshotContext.externalArchiveIndex` y llamar directamente a `this.externalArchive().createExternalArchiveIndex()` desde `createMarkdownUrlResolver` (`:1192`); que `externalArchive()` (`:1219-1224`) construya un lector fresco por llamada (la ruta es async, no necesita instancia compartida). Así el memo de H2 para el snapshot queda intacto y el archivo se relee por request.
3. Test de regresión: con `CourseReader` sobre PGlite (patrón de `reader.test.ts`/`external-archive.test.ts`), resolver un path sin item, insertar después un item `captured` con el mismo lector y comprobar que el segundo `createMarkdownUrlResolver` devuelve `kind: "external-archive"`. Hoy ese test falla por el memo del contexto.

**Alternativa** si se prefiere no reconstruir el índice por request: marcador barato en el lector — `SELECT count(*)::int, max(updated_at) FROM external_archive_items` (una consulta agregada) comparado con la firma cacheada; reconstruir solo si cambia. Coste: +1 consulta por acceso (12 filas hoy); con `cache()` por request se colapsa a 1 por request. La opción 1+2 es más simple y no introduce una consulta nueva.

### T-02 — MINOR: `/archive/<tool>` no muestra el respaldo Wayback ni la fecha aunque existan

**Estado:** abierto. **Afecta a:** plan §5.4 («El original se muestra como enlace externo … y, si existe, el respaldo Wayback») y §4.2; el AC-2.5.5 se cumple en el Markdown.

**Causa.** `platform/src/app/archive/[...path]/page.tsx:322` cae a `ArchiveUnavailableState` (`:132-159`) para todo item sin `content` (las herramientas con `status = "captured"` pero `content = null`, como `playground…/docs`). Ese componente solo pinta el título neutro y la URL original; no recibe `waybackUrl`/`waybackCapturedAt`. El banner que sí soporta Wayback (`external-material-banner.tsx:160-175`) solo se usa en `ArchivedLessonView` (`page.tsx:222-250`). Evidencia:

```text
$ curl -s -b 'lang=es' http://localhost:3100/archive/playground.4geeks.com/tracker/api/v1/docs
No hay copia archivada disponible
https://playground.4geeks.com/tracker/api/v1/docs
# no aparece web.archive.org ni "Respaldo en Wayback Machine" (aunque wayback_url existe en la fila)
```

**Corrección concreta.** Pasar el item (o `waybackUrl`/`waybackCapturedAt`/`capturedAt`) a `ArchiveUnavailableState` y, cuando `waybackUrl !== null`, renderizar el enlace de respaldo marcado con la fecha — reutilizando `ExternalMaterialBanner` o una fila equivalente; alternativamente, un estado específico de herramienta en `page.tsx:268-286` que muestre banner + original + backup. Añadir test de página para el item tool `captured` con `waybackUrl`.

### T-03 — MINOR: el informe del CLI dice «alias: aplicados N» en `--dry-run`

**Estado:** abierto. **Afecta a:** claridad del informe de AC-2.5.7 (no a la idempotencia).

**Causa.** `platform/src/external-archive/cli.ts:959` asigna `report.aliases.applied` con el número de alias que _se aplicarían_ en dry-run, y `:761` imprime siempre `alias: aplicados N, omitidos M`, aunque el dry-run no escribe. Las lecciones/herramientas sí usan el estado `planned`, pero los alias no.

**Corrección concreta.** En `cli.ts:761`, imprimir `alias: planificados N` cuando `options.dryRun` sea verdadero (o no incrementar `applied` en dry-run y exponer `planned`), manteniendo `aplicados` para la captura real (`:1050,:1068`). Ajustar el test de dry-run que afirme el nuevo texto.

---

## 4. Punto adicional del coordinador — memoización del índice EXTERNAL_ARCHIVE

Ver **T-01**: severidad **MAJOR**. El defecto es real y reproducible por diseño: `archive:external` escribe en Postgres desde otro proceso, y ninguna de las tres cachés (`external-archive.ts:189,385-396`; `reader.ts:151-155,1203-1217`; `index.ts:80-92`) observa ese cambio. Con el árbol actual y el servidor reiniciado, las 10 AC se cumplen; el riesgo es operativo (capturar y no ver el resultado sin reiniciar). La corrección mínima recomendada es memoizar por request con `cache()` de React y quitar el memo del índice del contexto del snapshot, dejando intacto el memo de H2 por `snapshotId` (que sí es seguro porque el snapshot es inmutable). Presupuesto: ~10 líneas de cambio en 2 archivos + 1 test de regresión; no toca las interfaces congeladas de §6.3.

---

## Apéndice A — Comandos reproducibles

```sh
# Cierre
npx --yes pnpm@12.8.1 --dir platform lint
npx --yes pnpm@12.8.1 --dir platform typecheck
npx --yes pnpm@12.8.1 --dir platform test
cd platform && npx --yes prettier@3.8.3 --check .

# Build sin DATABASE_URL (in-place; dev server en :3100 intacto)
DATABASE_URL= npx --yes pnpm@12.8.1 --dir platform build

# Inventario + dry-run (0 escrituras) + captura idempotente (0 cambios)
npx --yes pnpm@12.8.1 --dir platform archive:external --dry-run --report text
npx --yes pnpm@12.8.1 --dir platform archive:external --dry-run --resolve --report text --inventory-out /tmp/m2b-inventory.json
npx --yes pnpm@12.8.1 --dir platform archive:external --report text

# HTTP contra el dev server
curl -s -b 'lang=es' http://localhost:3100/archive/4geeks.com/lesson/how-to-start-a-project
curl -s -b 'lang=en' http://localhost:3100/archive/4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion
curl -s -b 'lang=es' http://localhost:3100/projects/ai-eng-milestone-frontend-development
curl -sI http://localhost:3100/archive-assets/e3f6da9da82f48cfa848771197cb08128c02a6176c1df733daef4a640db3b152
```

Las consultas SQL de este informe corrieron con un script efímero fuera del repo que lee `DATABASE_URL` de `platform/.env.local` sin imprimirla, dentro de `BEGIN READ ONLY` + `SET LOCAL statement_timeout = '60s'`.

## Apéndice B — Cabeceras literales de `/archive-assets/<sha256>`

```text
HTTP/1.1 200 OK
cache-control: public, max-age=31536000, immutable
content-security-policy: sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'
content-type: image/png
etag: "e3f6da9da82f48cfa848771197cb08128c02a6176c1df733daef4a640db3b152"
x-content-type-options: nosniff
```

El cuerpo descargado tiene `shasum -a 256` = `e3f6da9d…db3b152` (direccionamiento por contenido). `If-None-Match` con el mismo ETag → `304 Not Modified`; sha no hex o desconocido → `404`; `HEAD` → `200` con las mismas cabeceras. `/archive/4geeks.com/lesson/no-existe-jamas` → `404`; `/archive/4geeksacademy.com/es/comparar-programas` → `404` (marketing no archivado); `/archive/4geeks.com/lesson/how-to-start-a-project/` → `308`; `?x=1` se ignora → `200`.

## Apéndice C — Observaciones no bloqueantes

- El paquete QA del plan §6.2 menciona `platform/src/test/m2b-acceptance.test.ts`; no está en el árbol todavía (la cobertura por AC existe repartida en `inventory/cli/store/links/routes/external-archive/page/route/*.test.*`). No es un AC de esta tarea, pero el gate final del plan lo lista.
- `--dry-run` sin `--resolve` lee el snapshot (SELECT) pero no hace red ni compara con las filas existentes del archivo, por eso lista las 5 lecciones y 4 herramientas como `planned` aunque la captura real confirma que todas ya existen (`sin cambios`). El copy de alias es el de T-03.
- `platform/.prettierignore` excluye `fixtures/external-archive/` (bytes reales, no formateables) además de `.next/`, `node_modules/`, `coverage/`, `pnpm-lock.yaml`, `next-env.d.ts`, `fixtures/source/` y `drizzle/meta/`.

---

## Re-QA (post-correcciones)

- Fecha: 2026-10-04. Alcance: T-01, T-02, T-03. READ-ONLY (solo se añade esta sección). Servidor `http://localhost:3100` del coordinador, sin tocarlo. **No se escribió en la base real** (T-01 verificado con el test de regresión sobre PGlite).
- **Veredicto: T-01 CERRADO · T-02 CERRADO · T-03 CERRADO. Hallazgos nuevos: 0.**

| ID   | Veredicto | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01 | CERRADO   | Sin caché de proceso: `external-archive.ts:396` `const currentExternalArchiveReader = cache(...)`; `reader.ts:208` `externalArchiveForDatabase = cache(...)`; `reader.ts:1221,1231` ya no hay `SnapshotContext.externalArchiveIndex`. Tests `external-archive.test.ts:497` (request nueva ve el item capturado después), `:512` (misma request: un solo índice), `:534` (`CourseReader` relee y ve el item posterior), `:553` (comparte índice dentro de la request): 4/4 verdes. |
| T-02 | CERRADO   | `page.tsx:202-206,287-288` pasan `waybackUrl`/`waybackCapturedAt` al estado de herramienta. `curl -b lang=es :3100/archive/playground.4geeks.com/tracker/api/v1/docs` → contiene «Respaldo en Wayback Machine» y `href="http://web.archive.org/web/20260613092255/https://playground.4geeks.com/tracker/api/v1/docs"` con fecha «13 de junio de 2026».                                                                                                                            |
| T-03 | CERRADO   | `cli.ts:769` imprime `alias: planificados N, omitidos M` en dry-run y `:770` conserva `aplicados` en captura real. `archive:external --dry-run --from-dir ../content` → `alias: planificados 3, omitidos 0`. Test `cli.test.ts:304` (T-03) verde.                                                                                                                                                                                                                                 |

### Regresiones

| Comprobación                                        | Resultado                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint                                                | `eslint .` → exit 0                                                                                                                                                             |
| typecheck                                           | `next typegen && tsc --noEmit` → exit 0                                                                                                                                         |
| test                                                | **69 passed \| 1 skipped (70) archivos; 707 passed \| 1 skipped (708) tests** (antes 689/690)                                                                                   |
| prettier 3.8.3                                      | `src`, `../*.md`, `M2B_QA_*.md`: «All matched files use Prettier code style!» (`fixtures/external-archive/` y `drizzle/meta/` están en `.prettierignore`)                       |
| guard `no-hardcoded-catalog`                        | 14/14 verde                                                                                                                                                                     |
| `archive:external --dry-run`                        | «dry-run (sin red, sin escrituras)»; 5 lecciones planificadas + 3 alias + 4 herramientas; sin escrituras (solo `SELECT` sobre `source_files`)                                   |
| `/archive/4geeks.com/lesson/how-to-start-a-project` | ES y EN → 200; banner «Material externo archivado» / «Archived external material»; 0 `src="http(s)://"` externos                                                                |
| Alias                                               | `/archive/4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion` → 200; `/archive/4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` → 200                 |
| README con enlace archivado y Wayback               | `/projects/ai-eng-milestone-frontend-development` → 200; contiene `href="/archive/4geeks.com/lesson/how-to-start-a-project"` y el enlace `web.archive.org/web/20260613092255/…` |
| Marketing intacto                                   | En el mismo README, `href="https://4geeks.com"` sigue como enlace externo, sin copia                                                                                            |
| Raíz `/`                                            | 307 → `/projects` (redirección existente)                                                                                                                                       |

### Hallazgos nuevos

Ninguno (0 `R-NN`).
