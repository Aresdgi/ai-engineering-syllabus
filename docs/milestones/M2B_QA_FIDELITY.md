# M2B — QA de fidelidad, alcance, seguridad y diseño (READ-ONLY)

- **Hito auditado:** Hito 2.5 — Autonomía de 4Geeks (`M2B_AUTONOMY.md`, AC-2.5.1..10).
- **Árbol:** rama `m2b-autonomy`, working tree con el trabajo de W0–W3/D0 sin commitear (el coordinador commitea). Baseline git: `578acff` + cambios de M2.5.
- **Fecha:** 2026-10-02.
- **Regla de oro impuesta a esta QA:** READ-ONLY; el único artefacto escrito es este informe. No se arrancó ni paró ningún servidor; las consultas a base fueron `SELECT` (y `pg_catalog`) contra la base real; los scripts efímeros vivieron fuera del repo (`$TMPDIR/opencode/m2bqa/`); las descargas externas fueron `GET` públicos de solo lectura. `DATABASE_URL` nunca se imprimió, copió ni registró (se leyó de `platform/.env.local` sin eco).
- **Servidor real usado:** `http://localhost:3100` (el del coordinador; no se tocó).
- **Navegador:** no había Chromium de Playwright descargable (el CDN no completó la descarga); las capturas se hicieron con **Brave headless** (Chromium-based) conducido por Playwright 1.55 y **axe-core 4.10.2**, en directorio temporal fuera del repo.
- **Método:** lectura de código; consultas SQL de verificación; re-descarga del raw pinneado y comparación byte a byte; conteo de inventario ejecutando el CLI real en `--dry-run --from-dir`; render real con Playwright/axe en 10 combinaciones (1280/375 × claro/oscuro × ES/EN); `curl` de rutas y cabeceras.

## 0. Resumen

| ID   | Área          | Severidad | Estado  | Hallazgo                                                                                                                                |
| ---- | ------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Independencia | media     | abierto | Un README carga una imagen desde `github.com` en runtime (`cinema_matrix.png`, fuera de `content/`)                                     |
| F-02 | Independencia | baja      | abierto | Los READMEs cargan badges de `img.shields.io` en runtime (tercero, decorativo; 336 refs)                                                |
| D-01 | Accesibilidad | media     | abierto | `code` dentro de `blockquote` en claro: **4,37:1** (< 4,5) según axe (`color-contrast`, serious)                                        |
| D-02 | Accesibilidad | media     | abierto | `<pre>` con scroll horizontal sin foco de teclado a 375 px (axe `scrollable-region-focusable`, serious)                                 |
| D-03 | Accesibilidad | media     | abierto | Checkboxes de listas de tareas sin nombre accesible (axe `label`, critical) en READMEs                                                  |
| D-04 | Diseño        | baja      | abierto | `hover-fine:` sin `:hover`: los estilos "solo hover" se aplican siempre en escritorio; el respaldo Wayback pierde la jerarquía atenuada |
| O-01 | Seguridad     | observ.   | abierto | `images.ts` captura `image/svg+xml` pero `/archive-assets/` no lo sirve (allowlist distinta)                                            |
| O-02 | Seguridad     | observ.   | abierto | El parser de `robots.txt` no implementa comodines `*`/`$` (documentado; ningún host del corpus los usa)                                 |
| O-03 | Documental    | observ.   | abierto | El plan §8 dice "4 URL retiradas" pero su tabla y el inventario real tienen 3; la implementación sigue tabla/inventario                 |

**Fidelidad, alcance y seguridad: sin hallazgos.** Las observaciones O-01/O-02 no afectan al corpus actual y O-03 es una discrepancia de prosa del plan, no del entregable. Los hallazgos F/D están detallados abajo con corrección archivo:línea.

---

## 1. Fidelidad (AC-2.5.10) — sin hallazgos

### 1.1 El `content` archivado es byte a byte el raw pinneado

Re-descarga real de `https://raw.githubusercontent.com/<repo>/<commit>/<path>` para los **5 items `captured`** (3 ficheros únicos):

| Item canónico                                                            | Fichero / commit                   | Bytes | sha256 (fresco = almacenado)                                       | `bytesEqual` |
| ------------------------------------------------------------------------ | ---------------------------------- | ----: | ------------------------------------------------------------------ | ------------ |
| `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` | `.../how-to-start-a-project.es.md` |  6743 | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` | sí           |
| `https://4geeks.com/es/lesson/how-to-start-a-project`                    | `.../how-to-start-a-project.es.md` |  6743 | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` | sí           |
| `https://4geeks.com/lesson/como-comenzar-un-proyecto-de-codificacion`    | `.../how-to-start-a-project.es.md` |  6743 | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` | sí           |
| `https://4geeks.com/lesson/how-to-start-a-project`                       | `.../how-to-start-a-project.md`    |  6100 | `9261997020916708e1a9b7f88417a2a5baaacb49f654eb0e6a92126dde6b1a2e` | sí           |
| `https://4geeks.com/lesson/what-is-github-codespaces`                    | `.../what-is-github-codespaces.md` |  6429 | `a14968e4ad5c9991221370e9c9f6ae3c4f114c427b62d59fb5491ed7129734f6` | sí           |

Además, el hash recalculado en Node sobre `external_archive_items.content` coincide con `content_sha256` en **100 % de los items** (0 discrepancias), y los **12 assets** tienen `sha256(bytes)` = PK, `byte_size` = longitud real (recalculado en SQL con `encode(sha256(bytes),'hex')` y en Node). Los 33 enlaces `item↔imagen` conservan `original_url` y `alt` literales.

### 1.2 Nada de títulos, descripciones, resúmenes ni traducciones generados

- Los `title` en base son literales de la API del registro, verificados contra los fixtures reales: `"How to start coding a project"`, `"Cómo comenzar un proyecto de programación"`, `"What is Github Codespaces"`. El frontmatter/H1 originales no se mutan; el frontmatter se oculta en render (`remark-frontmatter`) y no se muestra.
- `generateMetadata` solo devuelve `title` (literal); no hay `description` generada.
- El aviso de sustitución de alias usa el **título literal del destino**: en el HTML real, `«Cómo comenzar un proyecto de programación»`, idéntico al `title` almacenado.
- Copys añadidos = solo interfaz neutra: `Material externo archivado. No forma parte del repositorio.` / `Archived external material. Not part of the repository.`, `URL original`, `Capturado el`, `Método`, `Hash`, `Respaldo en Wayback Machine`, `«…»`, `No hay copia archivada disponible`, `Ver la URL original retirada`, `(copia archivada)`. Sin texto educativo.

### 1.3 `aliases.json` refleja §8 y solo contiene las URL retiradas reales

`platform/src/external-archive/aliases.json` contiene exactamente las 3 filas de la tabla de §8, con `decidedBy: "user"`, `decidedAt: "2026-10-02"` y motivo; la regla `/es/`→destino ES, resto→destino EN se cumple. La base tiene 3 filas `status='alias'`, `method='user-alias'`, `http_status=404` y `alias_of_canonical_url` no nula (el check bidireccional está aplicado). El inventario real (`--dry-run --from-dir ../content`) confirma **8 URL canónicas de lección: 5 planificadas + 3 alias**, y 4 de herramienta. O-03: el texto de §8 dice "las 4 URL retiradas" pero su propia tabla lista 3 y el inventario da 3; no falta ningún alias.

### 1.4 Marketing intacto y archivo no recursivo

- 37 URL / 1315 ocurrencias de marketing no entran en `external_archive_*` (0 items de marketing en base). En el HTML real siguen como enlaces externos con `target="_blank" rel="noopener noreferrer"` sin backup.
- El archivo no es recursivo: los 12 items corresponden 1:1 con las 8 URL de lección + 4 de herramienta del corpus. Los 78 URLs de `breathecode.herokuapp.com` quedan fuera de alcance como documenta el plan.
- Referencias internas de los 3 Markdown archivados: todas las imágenes son URL absolutas; 0 `src` relativo y 0 `<img>` HTML (grep sobre los fixtures). No hay enlaces a lecciones archivadas dentro de esos 3 ficheros (los enlaces a 4Geeks que quedan sin copia son externos, límite no recursivo previsto).

### 1.5 Fixtures ADR-009 verificados

`platform/fixtures/external-archive/manifest.json` lista los 8 ficheros existentes (no sobra ni falta ninguno) y los 8 `sha256`/`byte_size` coinciden con los bytes reales. Los fixtures son respuestas/markdown/imágenes reales (los 3 markdown coinciden con el raw pinneado y con el `content` en base).

---

## 2. Alcance del hito y ownership — sin hallazgos

- `git diff --stat` (tracked) toca solo: docs raíz (`ARCHITECTURE.md`, `CONTENT_CONTRACT.md`, `DATA_MODEL.md`, `DECISIONS.md`, `SOURCE_OF_TRUTH.md`), `platform/{.prettierignore,drizzle.config.ts,drizzle/meta/_journal.json,package.json}` (W0), `platform/src/components/source-markdown{,.test}.tsx` (W3), `platform/src/course/{index,links,links.test,reader,routes,types}.ts` y `platform/src/lib/markdown/types.ts` (W2), y `platform/src/source/store/postgres-store.test.ts` (**único** cambio bajo `src/source`, autorizado: acota el test de RLS a `source\_%` y exige las 3 tablas `external_archive_*`). Nada fuera de W0–W3/D0/QA.
- No hay código del Hito 3: `grep -rn 'progress'` en lo nuevo no devuelve nada (0 resultados); no hay rutas, tablas ni estados de progreso.
- La migración `0002_chunky_hairball.sql` crea **solo** `external_archive_*` + `ENABLE ROW LEVEL SECURITY`; no altera ninguna tabla `source_*`.
- Aislamiento SOURCE verificado en la base real: `source_files = 899`, `source_snapshots = 1`, `source_projects = 84`, `source_contexts = 22`, `source_lessons = 5`, `source_blobs = 112` (coincide con la reconciliación de W1; ningún cambio).
- El `pnpm-lock.yaml` no está modificado (solo se añadió el script `archive:external` a `package.json`).

---

## 3. Independencia (requisito del usuario)

### 3.1 Evidencia positiva: `/archive/**` no pide nada externo

Con Playwright (Brave headless) sobre `/archive/4geeks.com/lesson/how-to-start-a-project`, `/archive/4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` y el alias `/archive/4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion`, en claro/oscuro y 1280/375: **0 peticiones externas** y **0 `src=` externos**; todas las imágenes del contenido salen de `/archive-assets/<sha256>` (p. ej. `src="/archive-assets/e3f6da…"`). El código de render (`course/external-archive.ts`, `course/reader.ts`, `components/*`, `app/archive*`) no contiene `fetch(` ni hosts externos; los enlaces al original y a Wayback son `<a>` que solo se activan al pulsarlos.

### F-01 — Un README carga una imagen desde GitHub en runtime (severidad media)

- **Evidencia literal:** en `/projects/seats-management-typescript` el HTML servido contiene
  `src="https://github.com/4GeeksAcademy/ai-engineering-syllabus/blob/main/assets/cover/images/cinema_matrix.png?raw=true"`,
  y el navegador emite peticiones reales a `https://github.com/…/cinema_matrix.png` y a `https://raw.githubusercontent.com/…/refs/heads/main/assets/cover/images/cinema_matrix.png`.
- **Alcance:** el corpus tiene 12 referencias de imagen "mismo repo" en Markdown; solo **2** (`content/projects/seats-management-typescript/README.es.md:28` y `README.md:26`) apuntan a un path que no está en el snapshot. Las otras 10 sí se sirven por `/source-files/` (verificado en `/projects/ai-eng-milestone-agentic-workflows-evaluate`).
- **Causa raíz:** la ingesta SOURCE importó únicamente `content/` (las 899 filas tienen ese prefijo) y `assets/cover/images/cinema_matrix.png`, aunque existe en el commit pinneado `962c1e5…`, no está en `source_files`. Al resolver la URL absoluta del propio repo, `resolveExistingTarget` (`platform/src/course/links.ts:316-354`) devuelve `null` y `resolveMarkdownHref` cae a `external` (`links.ts:356-395`); `source-markdown.tsx:366-383` emite el `src` externo.
- **Corrección propuesta:** ampliar la ingesta a los directorios fuera de `content/` referenciados por el corpus (al menos `assets/`) para que el resolvedor los sirva por `/source-files/…`, o archivarlos como EXTERNAL_ARCHIVE. Es un comportamiento heredado del Hito 2 (no lo introduce M2.5), pero incumple el chequeo de independencia de los README pedido en esta QA: sin acceso a GitHub esa imagen no carga.

### F-02 — Badges de `img.shields.io` en runtime (severidad baja, observación)

- **Evidencia literal:** cada página de proyecto solicita `https://img.shields.io/badge/build_by-Developers-blue` y `https://img.shields.io/twitter/follow/4geeksacademy?style=social&logo=x`; en el corpus hay **336** referencias a ese host (`grep` sobre `raw_content`).
- **Valoración:** no es un host de 4Geeks/GitHub/archive.org y es decorativo (si falla, degrada a imagen rota con `alt`); no hay contenido educativo dependiente. Se documenta para que la decisión sea consciente; si se quiere independencia total, habría que servir los badges desde el snapshot (misma vía que F-01) o aceptar la degradación.

---

## 4. Seguridad — sin hallazgos (2 observaciones)

1. **Saneado del Markdown archivado.** `markdownSanitizeSchema` (`platform/src/lib/markdown/sanitize-schema.ts`) es allowlist: sin `script/iframe/object/style`, sin atributos `on*`, `href` solo `http|https|mailto`, `src` solo `http|https` (sin `data:`/`javascript:`). Tests literales: `source-markdown.test.tsx:260` ("elimina `<script>`, onerror y URLs javascript: conservando el texto") y `app/archive/[...path]/page.test.tsx:257` ("sanea el HTML del material externo (script y onerror fuera)"). Verde en la suite.
2. **Route de assets.** `GET /archive-assets/<sha256>` verificado con `curl`: `200` + `content-type: image/png` + `x-content-type-options: nosniff` + `content-security-policy: sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'` + `etag: "<sha256>"` + `cache-control: public, max-age=31536000, immutable`; `HEAD` 200; `If-None-Match` → `304`; SHA en mayúsculas → 200 (normaliza); no-hex → 404; `..%2f..%2fetc%2fpasswd` → 404; SHA inexistente → 404. Allowlist de tipos raster y validación del hash en `route.ts:21-28,71-88`.
3. **Rutas `/archive/`.** `parseArchiveTarget` rechaza `..`, barras codificadas, hosts no válidos (`routes.ts:122-152`); verificado con `curl`: `/archive/..%2f..%2fetc%2fpasswd`, `/archive/4geeks.com/%2e%2e/secret`, host inválido y lección inexistente → **404**. Item inexistente → `notFound()`.
4. **CLI: robots y lista negra.** `isBlockedUrl` (`urls.ts:185-199`) bloquea `learn.4geeks.com` y `4geeks.com/api/*` **antes** de tocar la red (`http.ts:126-128`) y en **cada** redirect (`http.ts:166-207`); `RobotsGate` es fail-closed (robots ilegible/429/5xx ⇒ denegado; `robots.ts:182-198`) y se consulta en registro, GitHub, Wayback e imágenes. `WaybackClient` usa **solo** `archive.org/wayback/available`; no existe `--request-wayback` ni llamada a Save Page Now (grep negativo).
5. **Secretos.** `grep` de `postgresql://`, `postgres://`, `service_role`, JWT, `PASSWORD=` en `docs/`, `platform/fixtures/` y `platform/src/` → 0 coincidencias. Los CLIs y el log de error del lector usan `redactSecrets`/`describeError` (`platform/src/lib/redact.ts`, `cli.ts:515-518,640-643,1076`, `reader.ts:1209-1213`).
6. **RLS.** En la base real: `relrowsecurity = true` en `external_archive_items`, `external_archive_assets` y `external_archive_item_assets`; `pg_policies` = 0 filas para esas tablas (mismo patrón que SOURCE). La migración y `schema.ts` lo declaran (`.enableRLS()`).
7. **Guard AC-0.10.** `src/test/no-hardcoded-catalog.test.ts`: **14/14 tests en verde** en ejecución dedicada.

**O-01 (observación).** `images.ts:19-25` permite descargar `image/svg+xml`, pero `route.ts:21-26` no lo sirve (solo png/jpeg/gif/webp): un SVG capturado quedaría almacenado y nunca renderizaría (404 silencioso). Hoy el corpus tiene 0 SVG. Si se quiere coherencia, quitar `svg` del downloader o servirlo como texto con las cautelas del caso.

**O-02 (observación).** El parser de `robots.txt` no interpreta comodines `*`/`$` (documentado en `robots.ts:13-15`); ningún `robots.txt` de los hosts usados los usa hoy. Endurecimiento futuro, no un defecto actual.

---

## 5. Diseño y accesibilidad

**Método:** 10 capturas full-page en `$TMPDIR/opencode/m2bqa/shots/` (archive capturado EN/ES, alias ES/EN, README con herramienta y con lección archivada; 1280×800 y 375×812; `theme=light|dark`; `lang=es|en`) + `axe-core` (wcag2a/2aa/21aa) + medición de contraste sobre los colores renderizados. Navegador Brave headless (Playwright no pudo descargar su Chromium: CDN incompleto).

### Verificado correctamente

- **Aviso persistente y no estridente:** `<section role="note">` encima del contenido, con el texto literal exigido, URL original, fecha, método y hash plegable (`<details>`); en alias, además el aviso de sustitución con enlaces. No es toast ni descartable.
- **Contraste:** aviso 19,16:1 (claro) / 17,98:1 (oscuro), etiquetas del banner 4,67:1 / 7,14:1, enlace Wayback y enlace del título del alias ≥ 18:1, sufijo "(copia archivada)" **4,76:1** (claro) y **7,56:1** (oscuro) — todos AA. Sometido a la regla del indicador y del enlace Wayback pedida.
- **Sin scroll horizontal** en ninguna de las 10 combinaciones (`scrollWidth == innerWidth`); el banner usa `overflow-wrap:anywhere` para la URL larga.
- **Foco visible:** outline global de 2 px verificado con `Tab` (skip link, navegación); los componentes nuevos incluyen `focus-visible:ring-2`.
- **`prefers-reduced-motion`** cubierto globalmente (`globals.css:218-226`). Tema claro/oscuro y `html lang` correctos por cookie; jerarquía y coherencia con H2 (mismo `DocumentView`, prosa y tokens).
- El título se muestra una sola vez (si el cuerpo trae H1, la cabecera pasa a `p`, `page.tsx:94-103`), sin duplicar encabezados.

### D-01 — `code` dentro de `blockquote` no llega a AA en claro (severidad media)

- **Evidencia literal (axe):** `color-contrast`, impact `serious`, nodo `blockquote … > p > .bg-muted.px-1.text-[0.875em]`, texto "Your stars", en `/archive/4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` (claro). Medición: `rgb(114,114,115)` sobre `rgb(244,244,245)` = **4,37:1** (< 4,5). En oscuro pasa (5,77:1).
- **Corrección:** en `platform/src/components/source-markdown.tsx:323-329` añadir al `blockquote` `[&_code]:text-foreground`, o en `code` (`:337-341`) usar `text-foreground` (≈18:1). Es un componente compartido con H2, pero afecta al material archivado.

### D-02 — `<pre>` con scroll no enfocable a 375 px (severidad media)

- **Evidencia literal (axe):** `scrollable-region-focusable`, impact `serious`, nodo `pre` (varias páginas archive y README a 375 px). El `pre` usa `overflow-x-auto` sin `tabIndex`, así que un usuario de teclado no puede desplazar el código.
- **Corrección:** en `platform/src/components/source-markdown.tsx:330-336`, añadir `tabIndex={0}` y un `aria-label` neutro (p. ej. "Bloque de código"/"Code block") o `role="region"`.

### D-03 — Checkboxes de tareas sin nombre accesible (severidad media)

- **Evidencia literal (axe):** `label`, impact `critical`, nodos `input` de listas de tareas (`list-disc has-[input]…`) en `/projects/ai-eng-milestone-frontend-development` y `/projects/ai-eng-performance-caching`. Son `input type=checkbox` `disabled`/`readOnly` sin `aria-label`.
- **Corrección:** en `platform/src/components/source-markdown.tsx:425-433`, añadir `aria-label` neutro (p. ej. "Elemento de tarea"/"Task item") o `aria-hidden="true"` si se considera decorativo (el texto del `li` ya comunica la tarea).

### D-04 — `hover-fine:` aplica siempre en escritorio (severidad baja)

- **Evidencia literal:** `platform/src/app/globals.css:15` define
  `@custom-variant hover-fine (@media (hover: hover) and (pointer: fine));`
  que Tailwind compila como `.hover-fine\:text-foreground { color: var(--foreground) }` **sin `:hover`** (CSS dev verificado). Sonda en la página real: `text-muted-foreground` → `lab(48.496 0 0)`; `text-muted-foreground hover-fine:text-foreground` → `lab(2.75381 0 0)`; el enlace "Respaldo en Wayback Machine (13 jun 2026)" computa `lab(2.75381 0 0)` en reposo, es decir, pierde el atenuado secundario que declara `backupLinkClass` (`source-markdown.tsx:71-72`) y su `transition-colors` no cambia nada al pasar el ratón. Mismo patrón en `linkClass` y demás usos de `hover-fine:*`.
- **Corrección:** definir el variant con el pseudoestado, p. ej.
  `@custom-variant hover-fine { @media (hover: hover) and (pointer: fine) { &:hover { @slot; } } }`
  (o usar `hover-fine:hover:*` en los call sites) y verificar que el CSS compilado incluye `:hover`. Afecta globalmente a H2; conviene coordinarlo.

---

## 6. Verificación ejecutada (comandos y resultados literales)

```text
npx --yes pnpm@12.8.1 --dir platform lint        → exit 0 (eslint .)
npx --yes pnpm@12.8.1 --dir platform typecheck   → exit 0 (next typegen && tsc --noEmit)
npx --yes pnpm@12.8.1 --dir platform test        → Test Files 69 passed | 1 skipped (70)
                                                   Tests 689 passed | 1 skipped (690)  (Vitest 5.0.3, 17,09 s)
… exec vitest run src/test/no-hardcoded-catalog.test.ts → 1 file passed, 14 tests passed
npx --yes prettier@3.8.3 --check <archivos de M2.5>     → All matched files use Prettier code style!
npx --yes pnpm@12.8.1 --dir platform archive:external --dry-run --from-dir ../content --report json
  → mode {"dryRun":true,"inventorySource":"directory"}; files 779, occurrences 1543 (1463 de 4Geeks + 80 out-of-scope)
    lesson 122/8/84 · tool 26/4/16 · marketing 1315/37/174 · 5 planificadas + 3 alias · 4 tools · outcomes 12
curl /archive-assets/<sha> → 200 + nosniff + CSP sandbox + ETag + immutable; 304; 404 para hash inválido/traversal/inexistente
curl /archive/<rutas maliciosas> → 404 (traversal, host inválido, item inexistente)
```

La consulta a la base real (solo `SELECT`, incluida `pg_catalog` para RLS) reprodujo: 12 items (5 `captured`, 3 `alias`, 1 herramienta `captured`, 3 `unavailable`), 0 de marketing, 12 assets, 33 enlaces item↔imagen, `source_files 899` / `source_snapshots 1`, RLS activo en las 3 tablas y 0 políticas.

---

## 7. Limitaciones de esta QA

- Read-only: no se modificó código ni datos; no se ejecutó `next build` (la tarea no lo pedía y el servidor del coordinador seguía vivo). El informe es el único artefacto.
- Las capturas y comprobaciones de navegador se hicieron con Brave headless (Playwright como cliente), porque el Chromium empaquetado de Playwright no llegó a descargarse; se citan los valores computados y las capturas quedan fuera del repo.
- Se muestrearon 3 variantes de `/archive/…` y 7 páginas de proyecto; no se recorrieron las 84 unidades ni todas las combinaciones de idioma/tema. axe-core cubre una parte automatizable de WCAG; la revisión visual de las capturas se hizo además a mano.
- No se auditó el contenido educativo en sí (prohibido inventar): la fidelidad se comprueba por hash/bytes contra la fuente, no por juicio de contenido.

---

## Re-QA (post-correcciones)

- Fecha: 2026-10-04. Alcance: D-01..D-04 y O-01 (F-01, F-02 y O-02 fuera, backlog; no se reevalúan). READ-ONLY; solo se añade esta sección.
- Navegador: MCP de Playwright (Brave headless), solo navegación y captura (sin formularios). Tema claro/oscuro con `prefers-color-scheme` emulado. Capturas en `.playwright-mcp/` (raíz del repo): `rqa-archive-es-{1280,375}-{light,dark}.png`, `rqa-project-tasks-{1280,375}-{light,dark}.png`, `rqa-wayback-link-{1280,375}-{light,dark}.png`.
- **Veredicto: D-01 CERRADO · D-02 CERRADO · D-03 CERRADO · D-04 CERRADO · O-01 CERRADO. Hallazgos nuevos: 0.**

| ID   | Veredicto | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | CERRADO   | `source-markdown.tsx:333` añade `[&_code]:text-foreground` al `blockquote`. En `/archive/4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion`, `code` «Your stars»: claro `lab(2.75)` sobre `lab(96.52)` ≈ **18:1** (antes 4,37:1); oscuro `lab(98.26)` sobre `lab(15.20)` ≈ **16:1**. 1280 y 375, ambos temas.                                                                                                                                                                                             |
| D-02 | CERRADO   | `source-markdown.tsx:340-341`: `tabIndex={0}` y `aria-label={COPY[lang].codeBlock}` («Bloque de código»/«Code block»). En el DOM real a 375 px: `pre` con `tabIndex=0`, `aria-label="Bloque de código"` y `scrollWidth > clientWidth` (scroll real, ahora alcanzable por teclado). Sin scroll horizontal de página (`scrollWidth == innerWidth == 375`).                                                                                                                                                               |
| D-03 | CERRADO   | `source-markdown.tsx:438`: `aria-label={COPY[lang].taskItem}` («Elemento de tarea»/«Task item»). En `/projects/ai-eng-milestone-frontend-development`: 36 checkboxes, **0 sin nombre accesible**, `aria-label="Elemento de tarea"`; sin desbordamiento a 375 px.                                                                                                                                                                                                                                                       |
| D-04 | CERRADO   | `globals.css:18-24`: `@custom-variant hover-fine { @media (hover: hover) and (pointer: fine) { &:hover { @slot; } } }`. CSS compilado (`.next/dev/static/chunks/src_app_globals_162hn9o.css:1900`): `.hover-fine\:text-foreground:hover { color: var(--foreground); }` (ahora con `:hover`). Enlace «Respaldo en Wayback Machine (13 jun 2026)»: reposo claro `lab(48.496)` = `text-muted-foreground` (atenuado recuperado; antes `lab(2.75)`), oscuro `lab(66.128)`; tras `hover` pasa a `lab(2.75381)` (foreground). |
| O-01 | CERRADO   | `images.ts:31` `NON_ARCHIVABLE_IMAGE_CONTENT_TYPES = ["image/svg+xml"]`; `images.ts:163-164` detecta el SVG por firma y se rechaza antes de almacenar, coherente con la allowlist de `/archive-assets/`. Tests `images.test.ts:104-111` (el svg no es archivable) y `:170-179` verdes.                                                                                                                                                                                                                                 |

### Regresiones

- lint exit 0 · typecheck exit 0 · test **707 passed \| 1 skipped (708)** (69 archivos + 1 skipped) · prettier 3.8.3 limpio sobre `src` y docs · guard `no-hardcoded-catalog` **14/14** verde.
- `archive:external --dry-run --from-dir ../content`: sin red ni escrituras; 5 lecciones + 3 alias + 4 herramientas planificadas.
- Fidelidad: `/archive/4geeks.com/lesson/how-to-start-a-project` ES/EN → 200, banner literal, 0 recursos externos; alias → 200; README con enlace archivado (`/archive/…`) y con respaldo Wayback (`web.archive.org/web/20260613092255/…`) → 200; marketing (`https://4geeks.com`) sigue como enlace externo sin copia. Sin contenido educativo nuevo en la UI (solo copys neutros `Bloque de código`, `Elemento de tarea`).

### Hallazgos nuevos

Ninguno (0 `R-NN`).
