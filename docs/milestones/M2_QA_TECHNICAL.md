# M2 — QA técnica independiente (Hito 2: navegador del syllabus real)

- **Fecha:** 2026-10-02.
- **Rama:** `m2-syllabus-ui` (`HEAD` = `3fdde62`); la implementación M2 es working tree
  sin commitear. Baseline al empezar: idéntico a la auditoría (12 archivos `M`, nuevos
  `docs/milestones/M2_AUDIT_PLAN.md`, `platform/src/{app,components,course,lib}/…`,
  fixtures y `M2_QA_DESIGN.md`/`M2_QA_FIDELITY.md` de las otras QA paralelas).
- **Fuente auditada:** `4GeeksAcademy/ai-engineering-syllabus`, commit pinneado
  `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- **Snapshot activo real (solo lectura):** `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`,
  `ref = main`, `status = complete`, `imported_at = 2026-10-02T12:13:49.515Z`,
  0 errores de importación. 899 `source_files` (781 texto / 118 binario), 84 proyectos,
  22 contextos, 5 lecciones.
- **Entorno:** macOS (darwin), Node `v26.10.0`, pnpm `12.8.1`, Prettier `3.8.3`,
  Next.js `16.3.8` (Turbopack), PGlite `0.5.8`, servidor de desarrollo en
  `http://localhost:3100` gestionado por el coordinador.
- **Convención:** comandos de app con `npx --yes pnpm@12.8.1 --dir platform <cmd>`
  (nunca `pnpm install` en la raíz); build sin base con
  `cd platform && DATABASE_URL= npx --yes pnpm@12.8.1 exec next build`.
- **Carácter de la QA:** READ-ONLY sobre el repo. El único archivo escrito es este
  informe. La base se consultó exclusivamente con `SELECT` dentro de
  `BEGIN READ ONLY` + `SET LOCAL statement_timeout`; `DATABASE_URL` nunca se imprimió
  ni se copió. Los scripts efímeros viven fuera del repo
  (`/var/folders/…/T/opencode/m2qa/`) y no se tocan `.next` ni `node_modules` del dev.
- **Documentos leídos:** `docs/milestones/M2_REAL_SYLLABUS_UI.md`,
  `docs/milestones/M2_AUDIT_PLAN.md` (incl. «Decisiones del usuario»), ADR-013..017 de
  `DECISIONS.md`, `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `ORCA.md`,
  `docs/milestones/M1_QA_TECHNICAL.md`, y el código nuevo completo
  (`platform/src/course/**`, `platform/src/lib/markdown/**`,
  `platform/src/components/**`, `platform/src/app/**`, tests de `platform/src/test/**`).

---

## 1. Gate desde el working tree

No se borraron `.next` ni `node_modules` (hay un `next dev` en :3100 sirviendo datos
reales que el coordinador gestiona y que la instrucción prohíbe parar). Se ejecutó el
gate completo en el orden indicado.

| #   | Comando                                                              | Exit | Extracto literal                                                                                                                                        |
| --- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile`     | 0    | `✓ Lockfile passes supply-chain policies (verified 45m ago)` · `Lockfile is up to date, resolution step is skipped` · `Done in 24ms using pnpm v12.8.1` |
| 2   | `npx --yes pnpm@12.8.1 --dir platform lint`                          | 0    | sin salida (log de 11 bytes: `$ eslint .`)                                                                                                              |
| 3   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                     | 0    | `$ next typegen && tsc --noEmit` · `Generating route types...` · `✓ Types generated successfully`                                                       |
| 4   | `npx --yes pnpm@12.8.1 --dir platform test`                          | 0    | `Test Files  42 passed \| 1 skipped (43)` · `Tests  354 passed \| 1 skipped (355)` · `Duration  5.29s`                                                  |
| 5   | `cd platform && npx --yes prettier@3.8.3 --check .`                  | 0    | `Checking formatting...` · `All matched files use Prettier code style!`                                                                                 |
| 6   | `npx --yes pnpm@12.8.1 --dir platform build`                         | 0    | `- Environments: .env.local` · `✓ Compiled successfully in 752ms` · `Generating static pages using 9 workers (6/6) in 57ms`                             |
| 7   | `cd platform && DATABASE_URL= npx --yes pnpm@12.8.1 exec next build` | 0    | `- Environments: .env.local` · `✓ Compiled successfully in 163ms` · `Generating static pages using 9 workers (6/6) in 56ms`                             |

Tabla de rutas de ambos builds (idéntica, extracto literal):

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /contexts
├ ƒ /contexts/[slug]
├ ƒ /lessons
├ ƒ /lessons/[slug]
├ ƒ /projects
├ ƒ /projects/[slug]
└ ƒ /projects/[slug]/[subslug]

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

El único test omitido es el smoke real contra GitHub, gated por variable de entorno
(`platform/src/source/github/smoke.test.ts:28`), comportamiento previsto ya documentado
en `M1_QA_TECHNICAL.md` §1; no es un fallo de M2.

### 1.1 Build sin base y convivencia con `next dev`

- **`DATABASE_URL` vacía se trata como ausente.** `platform/src/course/database.ts:29-32`
  normaliza con `process.env.DATABASE_URL?.trim()` y devuelve `null` si es
  `undefined` o `""`; `getCourseDb()` (`database.ts:38-42`) no crea el `Pool` en ese
  caso. El import de `course/` no conecta (pool perezoso).
- **Next no sobrescribe la variable vacía.** Comprobado con el `@next/env` real de la
  versión instalada (`@next+env@16.3.8`) invocando `loadEnvConfig(platform, true)` con
  `DATABASE_URL=""`: `{"databaseUrlAfterLoad":"\"\"","combinedEnvDatabaseUrl":"\"\"",
"treatedAsAbsentByCourseCode":true}`. La `.env.local` real no reemplaza el valor vacío
  del shell.
- **El build no conecta a la base.** Las 7 rutas que leen datos son dinámicas (`ƒ`)
  porque cada página llama `await connection()` de `next/server` antes de la primera
  query (9 llamadas, una por página y por `generateMetadata` donde aplica:
  `src/app/{projects,contexts,lessons}/**/page.tsx`). Solo `/` y `/_not-found` se
  prerenderizan y no consultan. El build sin `DATABASE_URL` terminó con exit 0 y sin
  errores de conexión.
- **Convivencia con el dev de :3100.** `next build` terminó sin tocar `.next/dev`
  (`ls -d platform/.next/dev` sigue existiendo) y el dev respondió después de ambos
  builds: `projects=200 contexts=200 lessons=200`. No hubo que reiniciar nada.

---

## 2. Veredicto por AC (AC-2.1 .. AC-2.13)

Resumen: **12 PASS, 1 PARCIAL, 0 FAIL**. La única parcial es AC-2.11 (procedencia
ausente en las 4 vistas de contexto sin documento preferido, H-1).

| AC      | Veredicto   | Evidencia principal                                                                                                                                                                                                       |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2.1  | PASS        | `/projects` renderiza 84 filas únicas = 84 filas reales de `source_projects` (0 de diferencia en ambos sentidos); subproyectos derivados en el padre, no como filas.                                                      |
| AC-2.2  | PASS        | Secuencia completa de slugs renderizada con SHA-256 `69a3264f…c0f` == secuencia derivada del README real (79 listados + 5 sin listar al final); secciones literales 71/1/7/5.                                             |
| AC-2.3  | PASS        | `/projects/4-devs`, su subproyecto, `n8n-snackcheck-nutrition` y `ai-eng-capstone-project` en `es` y `?lang=en` (200, documento correcto, procedencia, selector y aside de subproyectos).                                 |
| AC-2.4  | PASS        | `/contexts` lista 22 filas únicas = 22 reales, en orden `source_path`, títulos = primer H1 real o slug (0 discrepancias).                                                                                                 |
| AC-2.5  | PASS        | Contexto con preferido y los 4 sin preferido listan 16/16/16/8 documentos reales y exigen `?doc`; `?doc` de subdirectorio 200; `?doc` inventado → 404; no se elige preferido sintético.                                   |
| AC-2.6  | PASS        | `/lessons` lista 5 filas = 5 reales, orden `source_path`, títulos = H1 del documento preferido.                                                                                                                           |
| AC-2.7  | PASS        | Lección en `es` y `?lang=en` (200), frontmatter YAML oculto, par real de variantes ofrecido.                                                                                                                              |
| AC-2.8  | PASS        | 5 documentos: enlaces 14/14, 14/14, 13/13, 1/1 y 5/5; ítems de lista = `li` renderizados (46/46, 35/35, 16/16, 24/24, 35/35); `<details>` 10/10; tablas GFM 3/3 y 1/1; `<img>` real con `src` pinneado.                   |
| AC-2.9  | PASS        | 670 referencias relativas (589 `./`, 79 `../`, 2 de raíz) reproducidas contra el snapshot: 652 resuelven y **18 rotas** (idénticas al apéndice B); las 8 con vista se pintan como rotas; 235 enlaces internos siguen 200. |
| AC-2.10 | PASS        | 118/118 `binary_reference` con la forma `raw.githubusercontent.com/<repo>/<commit>/<path>`; 4/4 imágenes relativas con vista renderizadas con esa URL; contexto 09 lista sus 12 PDFs.                                     |
| AC-2.11 | **PARCIAL** | Todas las vistas con documento muestran repo/ref/commit/blob/path/snapshot/fecha/enlace GitHub; las 4 vistas de contexto sin preferido y los índices `/contexts` y `/lessons` no muestran procedencia (H-1/H-3).          |
| AC-2.12 | PASS        | Selector solo con ≥2 variantes reales; todos los documentos con vista tienen par; sin variante no se muestra (tests + caso sin preferido); `?lang` no inventa idiomas.                                                    |
| AC-2.13 | PASS        | 84/22/5 filas y títulos literales (0 inventados), guard AC-0.10 verde, slug/`?doc` inventados → 404, textos educativos siempre subcadenas de la fuente.                                                                   |

### AC-2.1 vista Projects

- `/projects` (es) y `/projects?lang=en`: **84** filas cada uno, 84 únicas.
  `dbMinusRendered: []`, `renderedMinusDb: []` (comparación con
  `SELECT source_path FROM source_projects WHERE snapshot_id = $1`).
- Los 2 subproyectos de `4-devs` no son filas del índice
  (`subprojectLinksOnIndex: []`) sino enlaces del aside del padre
  (`/projects/4-devs/ai-eng-incident-manager-for-devs`,
  `/projects/4-devs/ai-eng-inventory-manager-for-devs`), conforme a la decisión del
  usuario; se derivan en lectura desde `source_files` + `learn.json`
  (`reader.ts:478-518,657-702`).
- Desglose por secciones en `es`: `Proyectos (orden sugerido)` 71 ·
  `Curso For Devs` 1 · `Otros proyectos` 7 · `Sin posición en el índice del
repositorio` 5 = 84.

### AC-2.2 orden obtenido de `content/projects/README.md`

- El orden de presentación se deriva del README importado
  (`content/projects/README.md`, blob `972ec8eb730e6ca243da177c08e008977d514e42`,
  24 085 B) mediante `parseProjectOrder` (`order.ts:106-187`), no de listas en código.
- Comparación completa de secuencias:
  - Rendered (84 slugs) SHA-256:
    `69a3264ff67ed5df0f72c3dc081908c948272dabd8182ca935f414d32f1c9c0f`.
  - Esperada (79 primeras apariciones `./<slug>` o `./<slug>/…` del README + 5 no
    listadas ordenadas por `source_path`): el mismo SHA-256.
- Primeras 3: `n8n-snackcheck-nutrition`, `ai-eng-milestone-choose-company`,
  `html-css-artist-landing-seo-access`. Últimas 6: `ai-eng-real-time-communication`,
  `ai-eng-cybersecurity-practices`, `ai-eng-cybersecurity-vulnerabilities`,
  `ai-eng-evaluating-regression-model`, `ai-eng-sales-forecasting-timeseries`,
  `vps-ssh-resource-optimization`.
- El README real tiene 81 enlaces `./` (71 numeradas + 1 track + 2 anidadas + 7 «Other
  projects») y 3 `../contexts/…` (relaciones, no unidades); 0 duplicados. Las 5 no
  listadas van al final con el encabezado neutro
  `Sin posición en el índice del repositorio` (`projects-index.tsx:14-15`).
- `?lang=en` cambia 78/84 etiquetas (las del README inglés) manteniendo el orden.

### AC-2.3 vista Project

- `200` y documento preferido correcto en las 4 unidades probadas:
  - `/projects/4-devs` → `content/projects/4-devs/README.es.md` (blob `a568616…`);
    `?lang=en` → `README.md` (blob `9028c6a…`). Aside con los 2 subproyectos.
  - `/projects/4-devs/ai-eng-incident-manager-for-devs` (subproyecto) →
    `…/README.es.md` (blob `f8b584e…`); `?lang=en` → `…/README.md`
    (blob `4f3482a…`). `aria-current` en el subproyecto actual y «Volver al proyecto».
  - `/projects/n8n-snackcheck-nutrition` → `README.es.md` (blob `ab24601…`);
    `?lang=en` → `README.md` (blob `7880014…`).
  - `/projects/ai-eng-capstone-project` → `README.es.md` (blob `d592e9b…`).
- Título de cabecera = etiqueta literal del README para los 79 listados (comparación
  sin discrepancias en `es` y en `en`); los 5 no listados usan el H1 real del documento
  preferido.
- Slug desconocido → 404 (`projects-pages.test.tsx:397` y `curl`:
  `/projects/proyecto-inventado` → 404).

### AC-2.4 vista Contexts

- `/contexts` → 22 filas únicas = 22 filas de `source_contexts`; orden `source_path`
  exacto (`orderMatchesDb: true`).
- Títulos = primer H1 del documento preferido o slug: 18 H1 reales y 4 slugs
  (`06-telemetry-data-pipelines`, `08-agent-engineering`, `10-realtime`,
  `sales-forecasting`); 0 discrepancias contra el H1 del snapshot.

### AC-2.5 vista Context

- Con preferido: `/contexts/01-web-fundamentals` (200) → `CONTEXT-brasaland.es.md`;
  `/contexts/4-devs` (200) → `README.es.md`; `/contexts/09-agentic-workflows` (200) →
  `CONTEXT-brasaland.es.md` + 12 assets.
- Sin preferido (4/22): la vista no inventa principal; muestra la lista real de
  documentos y pide selección:
  - `06-telemetry-data-pipelines` 16 docs · `08-agent-engineering` 16 ·
    `10-realtime` 16 · `sales-forecasting` 8.
  - `?doc=data-pipelines/CONTEXT-brasaland.es.md` → 200 con procedencia y selector;
    `?doc=telemetry/CONTEXT-trackflow.md` → 200; `?doc=nope.md` → **404**.
  - El título es el slug literal (derivación permitida), no un texto nuevo.
- La lista de documentos sale de `metadata.contextDocumentPaths` (no de un escaneo
  inventado) y los `href` internos usan la ruta relativa literal (`?doc=`).

### AC-2.6 vista Lessons

- `/lessons` → 5 filas únicas = 5 filas de `source_lessons`, orden `source_path`:
  `4geeks-student-extension`, `cursor-github-codespaces`,
  `optimize-ubuntu-vps-ram-efficiency`, `simple-rag-fastapi-qdrant-example`,
  `you-have-finished-your-course-now-what`.
- Títulos = H1 real del `.es.md` preferido (p. ej.
  `Tus modelos de IA de la academia en Codespaces: 4Geeks Student + Copilot Chat`).

### AC-2.7 vista Lesson

- `/lessons/4geeks-student-extension` (200) → `4geeks-student-extension.es.md`
  (blob `41313f0…`); `?lang=en` (200) → `4geeks-student-extension.md`
  (blob `e27610c…`), `aria-current` correcto.
- **Frontmatter oculto:** `frontmatterVisible: false` y
  `bodyStartsWithDashDashDash: false` en ambos idiomas (el Markdown real de las 10
  lecciones empieza por `---`; `remark-frontmatter` lo elimina).
- `?lang` sin variante real → 404 (`lessons/[slug]/page.tsx:48-64`).

### AC-2.8 render Markdown fiel

Documentos verificados (fixtures reales del snapshot):

| Documento                                         | Vista                               | Enlaces | Ítems de lista  | `<details>` | Tablas GFM | `<img>` |
| ------------------------------------------------- | ----------------------------------- | ------- | --------------- | ----------- | ---------- | ------- |
| `ai-eng-milestone-data-pipeline-design/README.md` | `/projects/…?lang=en`               | 14/14   | 46/46 (46 `li`) | 10/10       | —          | 2/2     |
| `simple-dashboard-tailwind-css/README.md`         | `/projects/…?lang=en`               | 14/14   | 35/35 (35 `li`) | —           | —          | 2/2     |
| `html-css-artist-landing-seo-access/README.md`    | `/projects/…?lang=en`               | 13/13   | 16/16 (16 `li`) | —           | —          | 3/3     |
| `09-agentic-workflows/CONTEXT-brasaland.es.md`    | `/contexts/09-agentic-workflows`    | 1/1     | 24/24 (24 `li`) | —           | 3/3        | —       |
| `4geeks-student-extension.es.md`                  | `/lessons/4geeks-student-extension` | 5/5     | 35/35 (35 `li`) | —           | 1/1        | —       |

- «Enlaces 14/14» = todos los `[…](target)` del Markdown fuente tienen su etiqueta
  literal en el HTML y un destino coherente con la política (interno, GitHub@commit,
  raw o roto); las imágenes cuentan aparte.
- El conteo de `li` del contenedor `div.break-words` coincide exactamente con los ítems
  de lista del Markdown (incluidas task lists), en los 5 documentos.
- El `<details>` verbatim del README real se conserva con su `summary` (10 elementos);
  las tablas GFM se renderizan; el `<img src="./.learn/page-speed-example.png">` sale
  con la URL `raw.githubusercontent.com/…/962c1e5…/…/page-speed-example.png`.
- El pipeline es el de ADR-014 (`source-markdown.tsx:266-269`:
  `remarkGfm` + `remarkFrontmatter` + `rehypeRaw` + `rehypeSanitize` con allowlist,
  `lib/markdown/sanitize-schema.ts`). Tests de saneado y fidelidad en
  `source-markdown.test.tsx:142-296` (script/onerror/javascript:/iframe/object/embed).

### AC-2.9 enlaces relativos

- Inventario independiente recorriendo los **666** markdown del snapshot:
  **3 271** referencias totales (2 601 externas, 0 anclas), de las cuales **670
  relativas**: 589 `./`, 79 `../`, 2 de raíz (`/forgot-password`). Resuelven 652 y
  **18 no existen** en el snapshot.
- Los 18 rotos coinciden **uno a uno** con el apéndice B del plan: 8 en
  `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-*.{es.,}md`
  (enlaces `*-pipeline.*`), 4 en `content/contexts/README{,.es}.md`, 2
  `/forgot-password`, 2 `../README.md` de `company-financial-dashboard-specs-project` y
  2 más en `.learn/solution/README.md` de los milestones de tiempo real.
- De esos 18, **8 están en documentos con vista** (los 8 de data-pipelines): los 8 se
  renderizan como rotos (`span[aria-disabled="true"]` con
  `title="Enlace roto en el origen: <rawHref>"`), verificado página a página. Los otros
  10 viven en `.learn/**` y `content/contexts/README*.md`, documentos **sin vista en
  H2**; no hay nada que comprobar en UI.
- Seguimiento de enlaces internos: 15 páginas recorridas, **235 enlaces internos
  únicos** (`/projects`, `/contexts`, `/lessons`) seguidos con HTTP: **0 con estado
  ≥ 400**.
- Enlaces «source»: 29 URLs a GitHub pinneadas al commit en esas páginas; muestra de 6
  (`blob`, `tree` y raw) respondió **200**. Ninguna URL apunta a `main`.

### AC-2.10 assets

- Consulta real: **118/118** binarios con `binary_reference` que casa con
  `^https://raw\.githubusercontent\.com/4GeeksAcademy/ai-engineering-syllabus/962c1e5…/.+$`;
  0 binarios sin referencia / 0 sin bytes.
- Imágenes relativas en documentos con vista: **4/4** renderizadas con la URL pinneada
  (`collaborative-project-html-tailwind-online-store` y
  `html-css-artist-landing-seo-access`, en `es` y `?lang=en`); las otras 9 referencias
  relativas a imagen del corpus viven en `.learn/**` sin vista.
- Assets de contexto: `/contexts/09-agentic-workflows` lista sus **12 PDFs** con `href`
  a `raw.githubusercontent.com/…/commit/…` (p. ej.
  `…/content/contexts/09-agentic-workflows/rfp-requests/trackflow/CONTEXT-trackflow-request-3.pdf`),
  con su `mediaType` visible. Sin proxy ni `next/image` (ADR-016).

### AC-2.11 procedencia (PARCIAL)

- Con documento seleccionado, la cabecera muestra todo lo exigido (evidencia literal):
  `4GeeksAcademy/ai-engineering-syllabus` · `Rama main` · `Commit 962c1e5` ·
  `Blob 972ec8e` · `Importado el 2 de octubre de 2026` ·
  `Commit completo 962c1e5fc8ebad273abaa348fb3d161568ce8707` ·
  `Blob completo 972ec8eb…` · `Snapshot 1b8fb5cc-…` · `Fuente content/projects` ·
  `Documento content/projects/README.md` · enlace `Ver en GitHub` a
  `blob/962c1e5…/…`.
- Verificado con procedencia completa y correcta en: `/projects`, `/projects?lang=en`,
  `/projects/[slug]` (+ subproyecto), `/contexts/[slug]` con documento,
  `/lessons/[slug]` (es/en). En `complete_with_errors` se añade el aviso con el número
  de archivos sin importar (`provenance-header.tsx:93-98`).
- **Gap:** las 4 vistas `/contexts/<slug>` sin documento preferido
  (`06-telemetry-data-pipelines`, `08-agent-engineering`, `10-realtime`,
  `sales-forecasting`) no muestran repo, commit, path ni blob, porque
  `contexts-detail.tsx:107-117` pasa `provenance={null}` cuando
  `selectedDocument === null` y `contexts/[slug]/page.tsx:62-76` deja la selección en
  `null`. Se convierte en AC-2.11 PARCIAL (ver H-1).

### AC-2.12 selector de idioma

- Proyectos y lecciones: selector con exactamente 2 variantes reales
  (`Español`/`English`), `aria-current` en la actual, enlaces sin `?lang` para la
  preferida y `?lang=en` para la inglesa.
- Contextos: el selector se calcula sobre el documento seleccionado (p. ej.
  `/contexts/01-web-fundamentals` ofrece `CONTEXT-brasaland.en.md`); sin documento
  seleccionado (4 contextos) no hay selector.
- En los 5 casos con vista de 09/06/etc. las variantes son los archivos reales del
  snapshot; **no** se ofrece ningún idioma sin archivo. El caso «< 2 variantes» no es
  alcanzable en H2 (los 94 markdown sin par del corpus son `.learn/solution/README.md`
  sin vista), pero está cubierto por `language-selector.test.tsx:25` y por el lector
  (`reader.ts:864-900` exige `language`/`evidence` reales).
- No hay textos de traducción ni etiquetas inventadas (`language-selector.tsx:10-13`,
  solo `Español`/`English`).

### AC-2.13 nada educativo inexistente

- Reconciliación exacta: `/projects` 84/84, `/contexts` 22/22, `/lessons` 5/5 (0
  elementos de más o de menos, sin duplicados).
- Títulos: 79/79 etiquetas de proyecto idénticas al README en `es` y 79/79 en `en`;
  los 5 no listados usan el H1 real; contextos 22/22 = H1 real o slug; lecciones =
  H1 real. Verificación automatizada contra `raw_content` del snapshot.
- Guard AC-0.10 verde: `vitest run` de
  `src/test/no-hardcoded-catalog.test.ts` + `src/test/source-fixtures.test.ts` →
  `Test Files 2 passed (2)` · `Tests 31 passed (31)`.
- Slug inventado en los tres catálogos y subproyecto inventado → 404; `?doc`
  inventado → 404; `?lang` sin variante en lecciones → 404. No se reescribe ni resume
  ningún documento: el HTML contiene el `raw_content` completo (los conteos de ítems
  46/46, 35/35, 16/16, 24/24, 35/35 y los frontmatter ocultos lo respaldan).

---

## 3. Robustez

### 3.1 Sin snapshot / sin `DATABASE_URL`

- Código: `getActiveSnapshot` devuelve `null` sin base (`reader.ts:179-182`) y
  `null/[]` en todas las lecturas (`reader.ts:597-750`); `getCourseDatabaseUrl`
  (`database.ts:29-32`) trata `""` como ausente. Las páginas degradan a
  `SourceUnavailableState` → `EmptySourceState` («Contenido todavía no sincronizado»),
  sin catálogo demo.
- Tests verdes: `reader.test.ts:258-273` («sin ningún snapshot terminado devuelve null
  y listas vacías»), `reader.test.ts:729-763` («CourseReader sin base de datos» +
  resolvedor degradado a roto) y los 5 tests de página «muestra el estado vacío neutro
  cuando no hay snapshot activo» (`projects-pages.test.tsx:228`, `contexts/page.test.tsx:75`,
  `contexts/[slug]/page.test.tsx:249`, `lessons/page.test.tsx:75`,
  `lessons/[slug]/page.test.tsx:184`).
- Con `complete_with_errors` se muestra el aviso neutro con `errorCount`
  (`provenance-header.tsx:93-98`); el estado activo se elige entre
  `complete`/`complete_with_errors` por `imported_at` (`reader.ts:183-201`,
  tests `reader.test.ts:200-256`).

### 3.2 `error.tsx` y 404

- `error.tsx:9-16` usa la firma correcta de Next 16.3 (`{ error, retry }`; `retry`
  estable en v16.3.0 según `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`),
  mensaje neutro, botón «Reintentar» y enlace de vuelta, sin trazas ni secretos.
  `errors` reales se redactan con `describeError` (`index.ts:75-81`).
- `not-found.tsx` es neutro y no lista contenido inexistente.

### 3.3 N+1 y payload

- Revisión del lector: el mapa de 899 paths se lee **una vez** por snapshot y se
  memoiza (`reader.ts:241-316`); las listas no seleccionan `raw_content`
  (`reader.ts:250-289,804-862`); `raw_content` se lee solo por lotes de paths concretos
  (`reader.ts:320-350`, `IN (...)`) y se cachea; el resolvedor de enlaces se construye
  una vez y se memoiza (`reader.ts:902-989`), sin consultas por enlace.
- Test que lo protege: `reader.test.ts:765-849` exige que los listados no lean
  `raw_content` y que toda lectura de `raw_content` esté acotada a `path IN/=`.
- En request real cada vista repite las 2 consultas del snapshot activo (fila +
  `errorCount`), reutiliza el mapa de paths memoizado por snapshot y, si acaso, hace
  una lectura acotada del documento/N preferidos; no hay consultas por fila ni por
  enlace.

### 3.4 `server-only`

- `import "server-only"` en `course/index.ts:14`, `course/database.ts:12` y
  `course/reader.ts:18`. Los componentes presentacionales importan solo módulos puros
  (`course/routes`, `course/types`, `course/links`, `course/path-utils`), no la capa
  con acceso a base; `error.tsx` (client) importa únicamente `routes`. No hay
  `NEXT_PUBLIC_*` ni credenciales en cliente.

### 3.5 Validación de parámetros

| Petición                                            | Estado       |
| --------------------------------------------------- | ------------ |
| `/projects/proyecto-inventado`                      | 404          |
| `/projects/4-devs/sub-inventado`                    | 404          |
| `/contexts/contexto-inventado`                      | 404          |
| `/contexts/06-telemetry-data-pipelines?doc=nope.md` | 404          |
| `/lessons/leccion-inventada`                        | 404          |
| `/ruta-inventada`                                   | 404          |
| `/lessons/4geeks-student-extension?lang=xx`         | 404          |
| `/projects?lang=xx`                                 | 200 (ignora) |
| `/projects/n8n-snackcheck-nutrition?lang=xx`        | 200 (ignora) |
| `/contexts/01-web-fundamentals?lang=xx`             | 200 (ignora) |

Los slugs y `?doc` se validan contra filas/paths reales. El `?lang` inválido es
inconsistente entre rutas: lecciones hace `notFound()` y proyectos/contextos lo
ignoran (comportamiento documentado en `projects-pages.test.tsx:329` y `:467`), lo que
incumple el mínimo «`?lang` inventado → 404» de esta QA (ver H-2).

---

## 4. Hallazgos priorizados

**BLOCKER: 0 · MAJOR: 1 · MINOR: 2 · NIT: 2.**

### H-1 (MAJOR) — AC-2.11: 4/22 vistas de contexto sin procedencia

- **Archivos:** `platform/src/components/catalog/contexts-detail.tsx:107-117`
  (`provenance={selectedDocument ? <ProvenanceHeader …/> : null}`),
  `platform/src/app/contexts/[slug]/page.tsx:62-76` (sin `?doc` y sin preferido,
  `selectedEntry = null`).
- **Reproducción:**

  ```sh
  for s in 06-telemetry-data-pipelines 08-agent-engineering 10-realtime sales-forecasting; do
    curl -s "http://localhost:3100/contexts/$s" | grep -c 'aria-label="Procedencia del contenido"'
  done
  # 0 · 0 · 0 · 0
  ```

  Evidencia del script: `06/08/10 → docs: 16, provenance: false`; `sales-forecasting →
docs: 8, provenance: false`.

- **Impacto:** el AC exige «source path y commit visibles» y el plan
  «cabecera de procedencia visible en cada vista de unidad y documento»; en estas 4
  unidades no hay repo, commit, path ni blob en la página (hasta seleccionar un
  documento, que es un paso extra del usuario). No se inventa contenido: es un hueco de
  procedencia.
- **Corrección sugerida:** cuando `selectedDocument === null`, renderizar una cabecera
  de procedencia de unidad con `snapshot` + `unit.sourcePath` (Documento/path `null`) y
  el enlace `tree@commit` del directorio; reutiliza `ProvenanceHeader` con
  `documentPath` opcional o una variante `unit` explícita.

### H-2 (MINOR) — `?lang` inventado: 200 en proyectos/contextos, 404 en lecciones

- **Archivos:** `platform/src/app/projects/page.tsx:36-37`,
  `platform/src/app/projects/[slug]/page.tsx:53-73`,
  `platform/src/app/contexts/[slug]/page.tsx:53-76` (no lee `lang`),
  `platform/src/app/lessons/[slug]/page.tsx:48-54`.
- **Reproducción:** `curl` de §3.5: `/projects?lang=xx` 200,
  `/projects/n8n-snackcheck-nutrition?lang=xx` 200,
  `/contexts/01-web-fundamentals?lang=xx` 200, `/lessons/4geeks-student-extension?lang=xx` 404.
- **Impacto:** la política es inconsistente entre secciones y no cumple el mínimo
  explícito de esta QA («`?lang` inventado → 404»). No muestra contenido inventado (en
  proyectos cae al documento preferido real), por eso MINOR.
- **Corrección sugerida:** decidir una política única. Si es rechazar: en
  `projects/*` y `contexts/[slug]`, si `searchParams.lang !== undefined` y
  `parseLangParam` devuelve `null` → `notFound()` (como lecciones); si es ignorar,
  documentarlo en el plan y aceptar el 200. Añadir test de la ruta de contextos.

### H-3 (MINOR) — Índices `/contexts` y `/lessons` sin procedencia

- **Archivos:** `platform/src/components/catalog/contexts-index.tsx`,
  `platform/src/components/catalog/lessons-index.tsx`,
  `platform/src/app/contexts/page.tsx`, `platform/src/app/lessons/page.tsx`.
- **Reproducción:** `hasProvenance: false` en `/contexts` y `/lessons` (el bloque
  `section[aria-label="Procedencia del contenido"]` no existe). En cambio `/projects`
  sí muestra la procedencia del README del que sale el orden.
- **Impacto:** si «cada vista» incluye los índices, falta la indicación de versión del
  syllabus en dos de las tres listas; con `/projects` como precedente, la asimetría es
  visible.
- **Corrección sugerida:** mostrar en ambos índices una cabecera de unidad/snapshot
  (repo + commit + snapshot + fecha) del mismo estilo que la de `/projects`, sin
  asociarla a un documento inexistente.

### H-4 (NIT) — Título literal con backticks en `4-devs`

- **Archivo:** `platform/src/course/reader.ts:449-460` (título = `labelEntry.label`
  literal).
- **Reproducción:** `/projects/4-devs` muestra `<h1>\`./4-devs\`</h1>`y`<title>\`./4-devs\`</title>`; el README real enlaza
`` [`./4-devs`](./4-devs) ``, así que la etiqueta incluye backticks.
- **Impacto:** es fiel (no inventa), pero el título visible conserva decoración
  Markdown. Afecta a esta unidad (probablemente única con formato en la etiqueta).
- **Corrección sugerida:** al construir el título, si la etiqueta contiene
  decoración inline, renderizarla por el pipeline seguro o preferir el H1 real
  (fallback ya existente); mantener la etiqueta literal para los enlaces si se desea.

### H-5 (NIT) — Cabecera en español al ver variantes inglesas de contextos/lecciones

- **Archivos:** `platform/src/course/reader.ts:566-593` (`buildIndexUnits` titula
  siempre con el documento preferido), `platform/src/components/catalog/lessons-detail.tsx`
  y `contexts-detail.tsx` (reciben `unit.title` sin variación de idioma).
- **Reproducción:** `/lessons/4geeks-student-extension?lang=en` tiene `<h1>` en español
  (`Tus modelos de IA…`) mientras el cuerpo renderiza el `.md` inglés; en proyectos el
  H1 sí cambia (`/projects/n8n-snackcheck-nutrition?lang=en` →
  `Is This Snack Healthy? …`).
- **Impacto:** inconsistencia de presentación, no de contenido (el cuerpo es la fuente
  real). NIT.
- **Corrección sugerida:** derivar el título del documento efectivamente mostrado en
  lecciones/contextos, o documentar que la cabecera es la del preferido.

---

## 5. Conclusión

Los 13 AC del Hito 2 quedan **12 PASS y 1 PARCIAL (AC-2.11), 0 FAIL**, con el gate
completo verde (install frozen, lint, typecheck, 354 tests + 1 skipped previsto,
prettier y `next build` normal y sin `DATABASE_URL`) y verificación real contra el
snapshot `1b8fb5cc…` (commit `962c1e5…`): 84/22/5 filas exactas, orden del README
reproducido bit a bit (SHA-256 de la secuencia), 670 referencias relativas
re-clasificadas con los 18 rotos del apéndice B (8/8 visibles como rotos cuando el
documento tiene vista), 118/118 assets pinneados, 235 enlaces internos HTTP 200 y
frontmatter/HTML/GFM fieles en los 5 documentos muestreados. La única brecha de
aceptación es la procedencia ausente en las 4 vistas de contexto sin documento
preferido (H-1); H-2..H-5 son robustez/consistencia y no afectan a la fidelidad del
contenido. No se detectó contenido educativo inventado, ninguna escritura en base y
ningún secreto expuesto.

---

## Re-QA (post-correcciones)

- **Fecha:** 2026-10-02 (segunda pasada). `HEAD` = `3fdde62`, rama `m2-syllabus-ui`;
  working tree con la ronda de correcciones FX1–FX5 aplicada (H-1..H-5 de este informe
  y F-01/F-02/F-04/F-05/F-06 de `M2_QA_FIDELITY.md`, solapando D-01..D-17 de
  `M2_QA_DESIGN.md`). No se reescribe nada de lo anterior.
- **Carácter:** READ-ONLY igual que la primera pasada; el único archivo escrito es este
  informe. La base se consultó con `SELECT` en `BEGIN READ ONLY` (+ `statement_timeout`),
  `DATABASE_URL` nunca se imprimió; los scripts efímeros viven fuera del repo
  (`/var/folders/…/T/opencode/m2rqa/`). `git status` al terminar: los mismos 13 archivos
  `M` y untracked del baseline, sin escrituras nuevas de la QA.
- **Snapshot verificado:** `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, commit
  `962c1e5fc8ebad273abaa348fb3d161568ce8707`, 899 archivos (781 texto / 118 binario),
  84 proyectos / 22 contextos / 5 lecciones, 0 errores. `next build` no tocó `.next/dev`
  y :3100 respondió 200 en todas las comprobaciones posteriores a ambos builds.

### Re-QA.1 Gate completo desde el estado actual

| #   | Comando                                                              | Exit | Extracto literal                                                                                                                                       |
| --- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile`     | 0    | `✓ Lockfile passes supply-chain policies (verified 1h ago)` · `Lockfile is up to date, resolution step is skipped` · `Done in 36ms using pnpm v12.8.1` |
| 2   | `npx --yes pnpm@12.8.1 --dir platform lint`                          | 0    | sin salida (log de 11 bytes: `$ eslint .`)                                                                                                             |
| 3   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                     | 0    | `$ next typegen && tsc --noEmit` · `Generating route types...` · `✓ Types generated successfully`                                                      |
| 4   | `npx --yes pnpm@12.8.1 --dir platform test`                          | 0    | `Test Files  44 passed \| 1 skipped (45)` · `Tests  417 passed \| 1 skipped (418)` · `Duration  5.57s`                                                 |
| 5   | `cd platform && npx --yes prettier@3.8.3 --check .`                  | 0    | `Checking formatting...` · `All matched files use Prettier code style!`                                                                                |
| 6   | `npx --yes pnpm@12.8.1 --dir platform build`                         | 0    | `- Environments: .env.local` · `✓ Compiled successfully in 639ms` · `✓ Generating static pages using 9 workers (6/6) in 56ms`                          |
| 7   | `cd platform && DATABASE_URL= npx --yes pnpm@12.8.1 exec next build` | 0    | `✓ Compiled successfully in 163ms` · `✓ Generating static pages using 9 workers (6/6) in 55ms`                                                         |

Tabla de rutas idéntica en ambos builds (mismo árbol que la primera pasada; ninguna ruta
nueva):

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /contexts
├ ƒ /contexts/[slug]
├ ƒ /lessons
├ ƒ /lessons/[slug]
├ ƒ /projects
├ ƒ /projects/[slug]
└ ƒ /projects/[slug]/[subslug]

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

El único test omitido sigue siendo el smoke real contra GitHub gated por variable de
entorno (previsto). La suite crece de `354 passed` (primera pasada) a **417 passed**:
los 63 tests nuevos cubren las correcciones (H-1..H-5, F-01/F-02/F-04/F-05/F-06,
D-01..D-17 donde aplica). El guard AC-0.10 se ejecutó además aislado:
`src/test/no-hardcoded-catalog.test.ts` + `src/test/source-fixtures.test.ts` →
`Test Files 2 passed (2)` · `Tests 31 passed (31)`.

### Re-QA.2 AC-2.1..AC-2.13 re-verificados

Resumen: **13 PASS, 0 PARCIAL, 0 FAIL** (la primera pasada tenía AC-2.11 PARCIAL por
H-1; queda corregido, ver Re-QA.3).

| AC      | Veredicto | Evidencia literal (abreviada, contra :3100 y el snapshot real)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2.1  | PASS      | `/projects` y `/projects?lang=en`: **84** filas, 84 `href` únicos = 84 `source_path` de `source_projects`; `dbMinusRendered: []`, `renderedMinusDb: []`, sin subproyectos como fila (`nestedOnIndex: []`).                                                                                                                                                                                                                                                                              |
| AC-2.2  | PASS      | Secuencia de 84 slugs idéntica a la derivada del README real (79 listados + 5 sin listar): SHA-256 esperado == renderizado == `69a3264ff67ed5df0f72c3dc081908c948272dabd8182ca935f414d32f1c9c0f`. **Marcadores: 71 exactos `0..70` en orden, sin hueco, y ningún ítem después con marcador** (`markers>70=[]`); secciones `Proyectos (orden sugerido)` / `Curso For Devs` / `Otros proyectos` / `Sin posición en el índice del repositorio`; 78/86 etiquetas cambian con `?lang=en`.    |
| AC-2.3  | PASS      | `/projects/4-devs` (es/en) 200 con aside de sus 2 subproyectos; subproyecto 200 con `aria-current` y `← Volver al proyecto`; `/projects/n8n-snackcheck-nutrition` es/en 200; `/projects/ai-eng-capstone-project` es/en 200; slug/subslug inventado → 404.                                                                                                                                                                                                                               |
| AC-2.4  | PASS      | `/contexts`: 22 filas únicas = 22 reales; `orderMatchesDb: true`; 0 discrepancias de título contra «primer H1 del preferido o slug»; procedencia de directorio visible.                                                                                                                                                                                                                                                                                                                 |
| AC-2.5  | PASS      | Con preferido: `01-web-fundamentals`, `4-devs`, `09-agentic-workflows` 200 con documento + blob. Sin preferido (4/22): `06`/`08`/`10` listan **16/16/16** documentos y `sales-forecasting` **8**, sin principal sintético y ya **con procedencia**; `?doc=data-pipelines/…es.md` y `?doc=telemetry/CONTEXT-trackflow.md` 200; `?doc=nope.md`, `?doc=` vacío y traversal → 404.                                                                                                          |
| AC-2.6  | PASS      | `/lessons`: 5 filas = 5 reales, orden `source_path` exacto (`4geeks-student-extension`, `cursor-github-codespaces`, `optimize-ubuntu-vps-ram-efficiency`, `simple-rag-fastapi-qdrant-example`, `you-have-finished-your-course-now-what`); títulos = H1 real.                                                                                                                                                                                                                            |
| AC-2.7  | PASS      | `/lessons/4geeks-student-extension` es/en 200 con pares reales (`41313f0…` / `e27610c…`); `h1es` ≠ `h1en` (el título sigue el idioma mostrado, H-5); frontmatter oculto (`frontmatterVisible:false`, `bodyHasDash:false`); `?lang=xx` → 404.                                                                                                                                                                                                                                            |
| AC-2.8  | PASS      | 5 documentos reales, conteo extraído == renderizado: data-pipeline-design 16 enlaces/16 `<a>`, 46/46 `li`, 10/10 `<details>`; simple-dashboard 16/16, 35/35; html-css-artist 15/15, 16/16, 3/3 `<img>`; `09-agentic-workflows` 1/1, 24/24, 3/3 tablas GFM; lección 5/5, 35/35, 1/1 tabla. Badges anidados cuentan como enlaces+imagen y el pipeline los resuelve.                                                                                                                       |
| AC-2.9  | PASS      | Inventario independiente de los 666 markdown: 3 271 referencias (2 601 externas, **670 relativas**: 589 `./`, 79 `../`, 2 de raíz); **18 rotas** en 15 archivos, idénticas al apéndice B; de las 8 con vista (`data-pipelines`), las 8 renderizan **1 `<span aria-disabled="true">`** con `title="Enlace roto en el origen: ./CONTEXT-…-pipeline…"` y **sin `href`**; 376 enlaces internos únicos seguidos con HTTP: **0 con estado ≥ 400**; 143 anclas a GitHub@commit en 112 páginas. |
| AC-2.10 | PASS      | **118/118** `binary_reference` == `raw.githubusercontent.com/<owner>/<name>/962c1e5…/<path>` (0 desviaciones / 0 binarios sin referencia); `/contexts/09-agentic-workflows` lista sus **12 PDFs** con URL pinneada; 4/4 `<img src="./…">` de documentos con vista renderizadas con URL pinneada (`collaborative-project-html-tailwind-online-store` y `html-css-artist-landing-seo-access`, es/en).                                                                                     |
| AC-2.11 | PASS      | **Procedencia presente en las 17 vistas probadas** (incluidos los 4 contextos sin preferido y los índices `/contexts`/`/lessons`). Muestra repo, commit corto/completo, rama, snapshot, fecha y enlace GitHub@commit; con documento añade `Documento` + `Blob completo`; sin documento usa `Fuente`/`Directorio` + `tree@commit` (H-1/H-3). Ver Re-QA.3/Re-QA.4.                                                                                                                        |
| AC-2.12 | PASS      | Selector con exactamente 2 variantes reales y `aria-current` correcto en proyectos, contextos y lecciones (probados 10 URLs es/en); sin documento seleccionado (4 contextos) no hay selector; `?lang=en` sin variante real no es alcanzable con los pares 84/84, 5/5 y los 244 markdown de contexto.                                                                                                                                                                                    |
| AC-2.13 | PASS      | Reconciliación exacta 84/84, 22/22, 5/5; guard AC-0.10 `31 passed`; 0 rastros de sintaxis Markdown en títulos (`>…`…`<` en `/projects`: 0); slugs/`?doc`/`?lang` inventados → 404; todo texto educativo del HTML sigue siendo derivación literal (las correcciones solo normalizan decoración con `markdownInlineToText`, no añaden palabras).                                                                                                                                          |

Detalles de los AC con cambios respecto a la primera pasada:

#### AC-2.2 — marcadores (F-02 corregido)

- El marcador sale del `listMarker` literal de la línea del README
  (`order.ts:150-151,188-196`) y `UnitList` solo pinta marcador si existe
  (`unit-list.tsx:52-56`). Secuencia renderizada comprobada ítem a ítem:
  71 marcadores que son exactamente `0,1,…,70` (en el orden del README), 13 filas
  restantes sin marcador (`4-devs`, 7 «Otros proyectos» y los 5 no listados). Ya no hay
  hueco 72–73 ni números sobre entradas no numeradas.
- Orden intacto: SHA-256 de la secuencia renderizada == esperada (arriba);
  primeras 3 `n8n-snackcheck-nutrition`, `ai-eng-milestone-choose-company`,
  `html-css-artist-landing-seo-access`; últimas 6 las 5 no listadas + `vps-ssh-resource-optimization`.

#### AC-2.11 — procedencia (H-1/H-3 corregidos)

- **Los 4 contextos sin preferido** muestran ahora cabecera de procedencia de
  directorio (H-1 corregido). Evidencia literal (`/contexts/06-telemetry-data-pipelines`):

  ```text
  <section aria-label="Procedencia del contenido" class="rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
  …<span class="font-medium text-foreground">4GeeksAcademy<!-- -->/<!-- -->ai-engineering-syllabus</span> … <span class="sr-only">Commit </span><code class="font-mono text-foreground/80" title="Commit 962c1e5…">962c1e5</code> <span class="sr-only">Directorio </span><code class="font-mono text-foreground/80 [overflow-wrap:anywhere]" title="content/contexts/06-telemetry-data-pipelines">content/contexts/06-telemetry-data-pipelines</code> …
  <a href="https://github.com/4GeeksAcademy/ai-engineering-syllabus/tree/962c1e5fc8ebad273abaa348fb3d161568ce8707/content/contexts/06-telemetry-data-pipelines" target="_blank" rel="noopener noreferrer" class="whitespace-nowrap …">Ver en GitHub<span class="sr-only"> (se abre en una pestaña nueva)</span></a>…</section>
  ```

- Campos `dl` de los 4: `["Fuente","Rama","Commit completo","Snapshot","Importado el"]`
  (sin `Documento`/`Blob` porque describen el directorio; `documentPath=null`).
- **Índices** (H-3 corregido): `/contexts` y `/lessons` muestran
  `4GeeksAcademy/ai-engineering-syllabus Commit 962c1e5 Directorio content/contexts|content/lessons
Ver en GitHub` con enlace `tree@commit` (snippet real; ver Re-QA.4).
- Vista con documento sin cambios (`content/projects/n8n-snackcheck-nutrition/README.es.md`,
  blob `ab24601820cc1bcc3252442a4a11dd2e4c26b0b3`, snapshot `1b8fb5cc…`, fecha
  `2 de octubre de 2026`, enlace `blob/962c1e5…`).

### Re-QA.3 Estado de H-1..H-5 y regresiones

| H   | Sev. orig. | Estado         | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 | MAJOR      | **CORREGIDO**  | `contexts-detail.tsx:118-136` renderiza `ProvenanceHeader` con `documentPath=null`/`blobSha=null` y `githubTreeUrl` cuando no hay documento; los 4 contextos sin preferido (`06`, `08`, `10`, `sales-forecasting`) devuelven `prov=true` con `Fuente=<sourcePath>` y `tree@commit`; AC-2.11 pasa a PASS.                                                                                                                                                                              |
| H-2 | MINOR      | **CORREGIDO**¹ | `projects/page.tsx:39-45`, `projects/[slug]/page.tsx:63-69`, `contexts/[slug]/page.tsx:70-76` aplican `parseLangParam` + `notFound()`. HTTP real: `/projects?lang=xx` 404 · `/projects/n8n-snackcheck-nutrition?lang=xx` 404 · `/contexts/01-web-fundamentals?lang=xx` 404 · `/contexts/06-telemetry-data-pipelines?lang=xx` 404 · `/lessons/4geeks-student-extension?lang=xx` 404; con variante real, `?lang=en` 200 en las tres secciones. Tests de H-2 en verde en la suite (417). |
| H-3 | MINOR      | **CORREGIDO**  | `contexts-index.tsx:31-37` y `lessons-index.tsx:31-37` añaden `ProvenanceHeader` de directorio (`content/contexts` / `content/lessons`) con enlace `tree@commit`; comprobado por HTTP (`prov=true` en ambos índices).                                                                                                                                                                                                                                                                 |
| H-4 | NIT        | **CORREGIDO**  | `reader.ts:450` usa `markdownInlineToText`; `/projects` fila `4-devs` → `title="./4-devs"` (sin backticks) y 0 ocurrencias de ``>`…`<`` en el HTML; `/projects/4-devs` muestra el H1 real del documento (`Curso For Devs — proyectos`) como único `<h1>`.                                                                                                                                                                                                                             |
| H-5 | NIT        | **CORREGIDO**  | `lessons-detail.tsx:38-44` deriva el título del documento mostrado (`extractDocumentTitle`): `/lessons/4geeks-student-extension` → H1 español, `?lang=en` → `Your academy AI models in Codespaces…`; `generateMetadata` (`lessons/[slug]/page.tsx:39-51`) hace lo mismo. En contextos la cabecera es siempre el slug literal y el documento aporta el único H1 (identidad neutra de idioma, D-01).                                                                                    |

¹ Ver **R-1** abajo para el único matiz encontrado.

**Regresiones nuevas: R-1 (MINOR)** — `?lang` inválido sigue devolviendo 200 en los
índices `/contexts` y `/lessons`.

- **Dónde:** `platform/src/app/contexts/page.tsx` y `platform/src/app/lessons/page.tsx`
  no leen `searchParams` en absoluto.
- **Reproducción literal:** `/contexts?lang=xx` → `200`; `/lessons?lang=xx` → `200`
  (también `?lang=en`, sin efecto). En cambio las 4 vistas que sí interpretan el
  parámetro devuelven 404 (H-2).
- **Impacto:** mínimo; esos índices no tienen dimensión de idioma ni selector (no hay
  documento que elegir), así que `?lang` es un parámetro desconocido más, como
  `?foo=bar`. No incumple ningún AC ni muestra contenido erróneo; solo queda un hueco
  si el criterio «`?lang` inválido → 404 en proyectos/contextos/lecciones» se aplica
  literalmente a las rutas índice además de las vistas de documento.
- **Corrección sugerida:** o aplicar el mismo `notFound()` en los dos índices, o
  documentar que allí `?lang` se ignora (no hay variante de lista). No bloquea el
  cierre.

No se detectaron otras regresiones: conteos, orden, enlaces, assets, procedencia,
selectores, saneado y degradación sin base se comportan igual que en la primera pasada.

### Re-QA.4 Comprobaciones nuevas

#### a) Exactamente un `<h1>` por vista de documento (17 vistas + 3 índices)

| Vista                                                                              | `<h1>` | Texto                                                     |
| ---------------------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `/projects`                                                                        | 1      | `Proyectos`                                               |
| `/projects?lang=en`                                                                | 1      | `Proyectos`                                               |
| `/projects/4-devs`                                                                 | 1      | `Curso For Devs — proyectos`                              |
| `/projects/4-devs?lang=en`                                                         | 1      | `For Devs course — projects`                              |
| `/projects/4-devs/ai-eng-incident-manager-for-devs`                                | 1      | `Backoffice de Operaciones – Centralizado de Incidencias` |
| `/projects/n8n-snackcheck-nutrition`                                               | 1      | `¿Es Saludable Este Snack? — …`                           |
| `/projects/n8n-snackcheck-nutrition?lang=en`                                       | 1      | `Is This Snack Healthy? — …`                              |
| `/projects/html-css-artist-landing-seo-access`                                     | 1      | `Un website para mostrar el talento de tu amigo artista`  |
| `/projects/ai-eng-capstone-project`                                                | 1      | `Entrega final — Vídeo del proyecto final: …`             |
| `/contexts`                                                                        | 1      | `Contextos`                                               |
| `/contexts/01-web-fundamentals`                                                    | 1      | `CONTEXT.md — Brasaland`                                  |
| `/contexts/09-agentic-workflows`                                                   | 1      | `CONTEXT — Brasaland: Hito 9, …`                          |
| `/contexts/06-telemetry-data-pipelines`                                            | 1      | `06-telemetry-data-pipelines` (slug)                      |
| `/contexts/06-telemetry-data-pipelines?doc=data-pipelines/CONTEXT-brasaland.es.md` | 1      | `CONTEXT — Brasaland (Pipeline de Desempeño de Negocio)`  |
| `/lessons`                                                                         | 1      | `Lecciones`                                               |
| `/lessons/4geeks-student-extension`                                                | 1      | `Tus modelos de IA de la academia en Codespaces: …`       |
| `/lessons/4geeks-student-extension?lang=en`                                        | 1      | `Your academy AI models in Codespaces: …`                 |

Resultado: **20/20 vistas con exactamente 1 `<h1>`** (D-01 corregido: el título de
cabecera de las vistas con documento ya no es un encabezado). Los 8 documentos
`data-pipelines` también dieron `h1=1` cada uno.

#### b) `?lang` inválido → 404

| Petición                                        | Estado                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `/projects?lang=xx`                             | **404**                                                                    |
| `/projects/n8n-snackcheck-nutrition?lang=xx`    | **404**                                                                    |
| `/contexts/01-web-fundamentals?lang=xx`         | **404**                                                                    |
| `/contexts/06-telemetry-data-pipelines?lang=xx` | **404**                                                                    |
| `/lessons/4geeks-student-extension?lang=xx`     | **404**                                                                    |
| `/contexts?lang=xx`                             | 200 (índice sin `lang`, ver R-1)                                           |
| `/lessons?lang=xx`                              | 200 (índice sin `lang`, ver R-1)                                           |
| `/projects?lang=es` / `?lang=en`                | 200 (variante real)                                                        |
| `/contexts/01-web-fundamentals?lang=en`         | 200 (sirve `CONTEXT-brasaland.en.md`, selector con English `aria-current`) |
| `/lessons/4geeks-student-extension?lang=en`     | 200 (sirve el `.md`)                                                       |

#### c) Enlaces absolutos same-repo de F-01 (resueltos a interno/commit)

- **Barrido del corpus:** 147 referencias absolutas same-repo a `main` (`github.com/.../(blob|tree|raw)/main/…`
  y `raw.githubusercontent.com/.../main/…`) en 109 documentos; de las alcanzables
  (sin `.learn/`), 135 referencias y 33 apuntan a paths que existen en el snapshot.
- **Barrido del HTML renderizado:** 112 páginas (3 índices + 84 proyectos + 2 subproyectos
  - 18 contextos con preferido + 5 lecciones) con 0 violaciones de
    «`/blob|tree|raw/main/<path>` existente en el snapshot»; 143 anclas salen pinneadas
    al commit `962c1e5…` y los enlaces internos resultantes responden 200.
- **3 ejemplos reales (muestra):**
  1. `content/lessons/4geeks-student-extension/4geeks-student-extension.es.md`
     (blob/main al par `.md`) → renderizado como enlace **interno**
     `href="/lessons/4geeks-student-extension?lang=en"`.
  2. `content/projects/4-devs/ai-eng-incident-manager-for-devs/README.es.md`
     (`tree/main/content/contexts/4-devs/incident-manager-for-devs`) → renderizado
     `https://github.com/4GeeksAcademy/ai-engineering-syllabus/tree/962c1e5fc8ebad273abaa348fb3d161568ce8707/content/contexts/4-devs/incident-manager-for-devs`
     con `target="_blank" rel="noopener noreferrer"` (F-04 corregido).
  3. `content/projects/existing-model-sentiment-analysis-reviews/README.es.md`
     (`blob/main/…/reviews.csv`) → renderizado
     `blob/962c1e5…/content/projects/existing-model-sentiment-analysis-reviews/reviews.csv`
     (`commitPin=true`, `mainRemains=false`).
- Los enlaces same-repo a `main` cuyo path **no existe** en el snapshot se conservan
  externos por diseño del resolvedor (`links.ts:5-12`): no hay commit importado al que
  pinneárselos y no son enlaces rotos (apuntan a otra ref).

### Re-QA.5 Veredicto

**LISTO PARA CERRAR.** Gate completo verde (install frozen, lint, typecheck,
417 tests + 1 skipped previsto, prettier, `next build` normal y con `DATABASE_URL`
vacío), **13/13 AC en PASS**, los 5 hallazgos H-1..H-5 **CORREGIDOS** con evidencia
literal contra el snapshot real, los 3 checks nuevos superados (1 `<h1>` exacto en
20 vistas, `?lang` inválido 404 en las 5 vistas que interpretan el parámetro, 0 enlaces
`main` con path existente en 112 páginas renderizadas y 3 ejemplos resueltos a
interno/commit) y guard AC-0.10 en verde. No hay BLOCKER ni MAJOR; la única novedad es
**R-1 (MINOR, no bloqueante)**: los índices `/contexts` y `/lessons`, que no tienen
dimensión de idioma, ignoran `?lang` (200) — se sugiere 404 o documentarlo. No se
escribió en la base, no se modificó ningún archivo del repo salvo este informe y no se
expuso ningún secreto.

---

## QA final (independencia, idioma global, tema)

- **Fecha:** 2026-10-02 (tercera pasada, tras los tres cambios pedidos por el usuario).
  `HEAD` = `3fdde62`, rama `m2-syllabus-ui`; working tree con ADR-018 (independencia:
  bytes en `source_blobs`, servido `/source-files/<path>`, espejo
  `SOURCE_MIRROR_REPOSITORY`), ADR-019 (idioma global ES/EN con cookie `lang` y
  selector único) y selector de tema claro/oscuro/sistema con cookie `theme`. Sin
  commits, sin cambio de rama, sin push.
- **Carácter:** READ-ONLY igual que las pasadas anteriores; el único archivo escrito
  es este informe. La base se consultó solo con `SELECT` dentro de `BEGIN READ ONLY`
  (+ `statement_timeout`), `DATABASE_URL` nunca se imprimió; los scripts efímeros
  viven fuera del repo (`/var/folders/…/T/opencode/m2fqa/`) y `git status --porcelain`
  conserva las mismas 68 entradas del baseline (0 escrituras de la QA).
- **Snapshot verificado por consulta real:** `1b8fb5cc…`, `main`, commit
  `962c1e5fc8ebad273abaa348fb3d161568ce8707`, `complete`, 899 archivos (781 texto /
  118 binario), 84 proyectos / 22 contextos / 5 lecciones, 0 errores; `source_blobs`
  con **112 filas** (direccionamiento por contenido) y **0** binarios sin bytes.
- **Documentos leídos además de los de pasadas previas:** ADR-018 y ADR-019 en
  `DECISIONS.md`, y el código nuevo (`source-files/[...path]/route.ts`,
  `preferences/{language,theme}/[theme]/route.ts`, `lib/i18n/**`, `lib/theme/**`,
  `language-selector.tsx`, `theme-selector.tsx`, `app-shell.tsx`, `layout.tsx`,
  `reader.ts` en lo relativo a variantes/`getFileBytes`).

### QA-F.1 Gate completo (salida literal resumida)

| #   | Comando                                                              | Exit | Extracto literal                                                                                                                                       |
| --- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile`     | 0    | `✓ Lockfile passes supply-chain policies (verified 2h ago)` · `Lockfile is up to date, resolution step is skipped` · `Done in 36ms using pnpm v12.8.1` |
| 2   | `npx --yes pnpm@12.8.1 --dir platform lint`                          | 0    | sin salida (log de 11 bytes: `$ eslint .`)                                                                                                             |
| 3   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                     | 0    | `$ next typegen && tsc --noEmit` · `Generating route types...` · `✓ Types generated successfully`                                                      |
| 4   | `npx --yes pnpm@12.8.1 --dir platform test`                          | 0    | `Test Files  56 passed \| 1 skipped (57)` · `Tests  547 passed \| 1 skipped (548)` · `Duration  7.30s`                                                 |
| 5   | `cd platform && npx --yes prettier@3.8.3 --check .`                  | 0    | `Checking formatting...` · `All matched files use Prettier code style!`                                                                                |
| 6   | `npx --yes pnpm@12.8.1 --dir platform build`                         | 0    | `- Environments: .env.local` · `✓ Compiled successfully in 821ms` · `✓ Generating static pages using 9 workers (6/6) in 91ms`                          |
| 7   | `cd platform && DATABASE_URL= npx --yes pnpm@12.8.1 exec next build` | 0    | `✓ Compiled successfully in 167ms` · `✓ Generating static pages using 9 workers (6/6) in 87ms`                                                         |

Tabla de rutas idéntica en ambos builds:

```text
Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /contexts
├ ƒ /contexts/[slug]
├ ƒ /lessons
├ ƒ /lessons/[slug]
├ ƒ /preferences/language/[lang]
├ ƒ /preferences/theme/[theme]
├ ƒ /projects
├ ƒ /projects/[slug]
├ ƒ /projects/[slug]/[subslug]
└ ƒ /source-files/[...path]

ƒ  (Dynamic)  server-rendered on demand
```

El único test omitido sigue siendo el smoke real contra GitHub gated por
`SOURCE_READER_SMOKE` (`platform/src/source/github/smoke.test.ts:28`), previsto. La
suite crece de `417 passed` (Re-QA) a **547 passed** (+130 tests de las tres rondas de
cambios). Guard AC-0.10 aislado:
`vitest run src/test/no-hardcoded-catalog.test.ts src/test/source-fixtures.test.ts` →
`Test Files 2 passed (2)` · `Tests 31 passed (31)`. Tras ambos builds, `next dev` de
:3100 siguió respondiendo (`projects=200`) y `.next/dev` intacto.

### QA-F.2 AC-2.1..AC-2.13 re-verificados contra :3100 en ambos idiomas

Resumen: **13 PASS, 0 PARCIAL, 0 FAIL**. AC-2.12 se verifica con la reinterpretación
del usuario: selector global de idioma, variante del idioma elegido cuando existe y
nota neutra de fallback cuando no.

| AC      | Verdict | Evidencia (es y `lang=en`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2.1  | PASS    | `/projects` sin cookie y con cookie `en`: **84** enlaces únicos a `/projects/<slug>` cada uno = 84 filas reales de `source_projects` (consulta real). Cero filas de más o de menos; subproyectos solo en el aside del padre.                                                                                                                                                                                                                                                                                                                                |
| AC-2.2  | PASS    | Secuencia de 84 slugs idéntica en ambos idiomas (mismos `href` en el mismo orden) y SHA-256 `69a3264ff67ed5df0f72c3dc081908c948272dabd8182ca935f414d32f1c9c0f` (el mismo esperado de la Re-QA); marcadores literales `0..70` sin huecos (71); 78/84 etiquetas cambian con el idioma; primeras 3 `n8n-snackcheck-nutrition`, `ai-eng-milestone-choose-company`, `html-css-artist-landing-seo-access`.                                                                                                                                                        |
| AC-2.3  | PASS    | `/projects/4-devs` 200 es/en con aside de sus 2 subproyectos (`Subproyectos`/`Subprojects`); H1 `Curso For Devs — proyectos` / `For Devs course — projects`; subproyecto 200 con `aria-current` en el nav; `n8n-snackcheck-nutrition` y `ai-eng-capstone-project` 200 en ambos idiomas.                                                                                                                                                                                                                                                                     |
| AC-2.4  | PASS    | `/contexts` 22 filas únicas = 22 reales, orden `source_path` (hrefs ordenados); H1 `Contextos`/`Contexts`; títulos = primer H1 de la variante del idioma o slug; procedencia de directorio visible.                                                                                                                                                                                                                                                                                                                                                         |
| AC-2.5  | PASS    | Con preferido 200; los 4 sin preferido listan **8/8/8/4** documentos por idioma (pares ADR-012 unificados por ADR-019; antes 16/16/16/8 con ambas variantes) y muestran procedencia de directorio; `?doc` real de cada uno 200 en es y en; `?doc=nope.md`, `?doc=` vacío y traversal → 404.                                                                                                                                                                                                                                                                 |
| AC-2.6  | PASS    | `/lessons` 5 filas = 5 reales, orden `source_path`; títulos = H1 real de la variante del idioma; H1 de página `Lecciones`/`Lessons`.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| AC-2.7  | PASS    | `/lessons/4geeks-student-extension` es/en 200 con pares reales; H1 cambia de idioma (`Tus modelos…` / `Your academy AI models…`); frontmatter oculto (`startsWithDash=false`, sin `title:` YAML visible) y el cuerpo lleva `lang="es"`/`lang="en"` según variante.                                                                                                                                                                                                                                                                                          |
| AC-2.8  | PASS    | Fidelidad exacta en 5 documentos reales × 2 idiomas (conteo markdown ↔ HTML): data-pipeline-design 17/17 enlaces + 2/2 imgs + 46/46 `li` + 10/10 `<details>`; simple-dashboard 16/16 + 2/2 + 35/35; html-css-artist 15/15 + 3/3 + 16/16; contexto 09 1/1 + 24/24 + 3/3 tablas; lección 5/5 + 35/35 + 1/1 tabla. 0 elementos `script/style/iframe/object/embed` en contenido y 0 `href="javascript:"`.                                                                                                                                                       |
| AC-2.9  | PASS    | Inventario independiente de los 666 markdown: 3 271 referencias, 670 relativas, **18 rotas** idénticas al apéndice B; las 8 con vista (data-pipelines, 4 docs × 2 idiomas) renderizan exactamente **1 `<span aria-disabled="true">`** con `title="Enlace roto en el origen: ./CONTEXT-…-pipeline…"`; 368 enlaces internos únicos de las 238 páginas crawleadas: **0 con estado ≥ 400**.                                                                                                                                                                     |
| AC-2.10 | PASS    | **118/118** binarios servidos por la app con 200 y `ETag` == `git hash-object` local (bytes idénticos); `/contexts/09-agentic-workflows` lista sus **12 PDFs** con `href="/source-files/…pdf"` y `mediaType` visible; imágenes de documentos con vista vía `/source-files/…`; `binary_reference` 118/118 sigue en el store como procedencia, pero la UI ya no la usa para cargar (0 `<img>` a `raw.githubusercontent.com`).                                                                                                                                 |
| AC-2.11 | PASS    | Procedencia presente en **todas** las vistas reales (117 páginas es + 116 en; solo `/`, que es 307 a `/projects`, carece de ella): repo de origen, commit corto/completo, rama, snapshot, fecha, path/blob y enlace `Ver en GitHub (espejo)` a `github.com/Aresdgi/…@962c1e5…`; con documento añade `Documento`/`Blob completo`; sin documento, `Fuente`/`Directorio` + `tree@commit`.                                                                                                                                                                      |
| AC-2.12 | PASS    | Selector global único en el shell: **241/241** navs `Idioma`/`Language` con exactamente 2 enlaces y 1 `aria-current="true"` en el idioma de la cookie; la variante mostrada es la del idioma elegido en listas, asides y documentos (p. ej. doc `.es.md` visto con cookie `en` → H1 inglés); la nota neutra de fallback existe y está cubierta por tests (`document-view.test.tsx:158,175`, `lessons-detail.test.tsx:168`, `contexts-detail.test.tsx:203-217`, `projects-pages.test.tsx:484-489`), aunque no es alcanzable con el corpus actual (ver R2-2). |
| AC-2.13 | PASS    | Reconciliación 84/22/5 (DB ↔ render); guard AC-0.10 `31 passed`; títulos y textos del cuerpo son literales de la variante mostrada (fidelidad AC-2.8); slugs/`?doc` inventados → 404; los únicos textos nuevos son copys neutros de interfaz (selector, tema, nota de fallback, etiqueta «espejo», estados vacíos).                                                                                                                                                                                                                                         |

### QA-F.3 Independencia de 4Geeks en tiempo de ejecución (ADR-018)

#### a) `/source-files/<path>` (route handler)

| Caso                                                           | Resultado literal                                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG `.learn/supabase-transaction-pooler-connection-string.png` | `200` · `content-type: image/png` · `etag: "d99165a0051bb01eca9511826c7823c085bded31"` · bytes idénticos al `content/` local · `git hash-object` local == ETag                         |
| PDF `09-agentic-workflows/…/CONTEXT-trackflow-request-3.pdf`   | `200` · `content-type: application/pdf` · `etag: "3465abb3d19ac49793b06e806db5c66738feeec3"` · bytes idénticos                                                                         |
| HTML `.learn/solution/solution.html`                           | `200` · `content-type: text/plain; charset=utf-8` (nunca HTML activo)                                                                                                                  |
| Texto sin vista (`README.md` de `.learn`, `learn.json`)        | `200` · `text/plain; charset=utf-8` · bytes idénticos al `raw_content` local                                                                                                           |
| `.DS_Store`                                                    | `200` · `application/octet-stream` + `Content-Disposition: attachment`                                                                                                                 |
| Traversal `..`, `%2e%2e`, `..%2f`, `..%5C`, byte nulo          | `404` sin cuerpo; cualquier escape por encima de la raíz → `404`; el `..` sin codificar lo normaliza la capa HTTP a un path válido dentro del snapshot (nunca sale del repo, ver R2-3) |
| Revalidación                                                   | `If-None-Match` exacto y `W/` → `304`; ETag obsoleto → `200`; `HEAD` → `200`; `OPTIONS` → `204`; `Cache-Control: public, max-age=300, must-revalidate`                                 |
| Cabeceras de seguridad                                         | `X-Content-Type-Options: nosniff`; CSP `sandbox; default-src 'none'…` (imágenes/texto) o sin scripts/objetos para PDF                                                                  |
| **Barrido completo**                                           | Los **118/118** binarios del `content/` local devuelven `200` con `ETag` == `git hash-object` (0 discrepancias)                                                                        |

#### b) Barrido de enlaces a hosts de 4Geeks (≥40 páginas por idioma)

- Crawl real: **121 páginas es + 117 en** (índices, 84 proyectos, 2 subproyectos,
  22 contextos + 4 `?doc`, 5 lecciones; incluye 3 respuestas 404 de `?doc` inválido),
  2 760/2 825 anclas y 174 `<img>` por idioma.
- **Generados por la app hacia hosts de 4Geeks: 0** (procedencia, resolvedor y assets
  emiten espejo `github.com/Aresdgi/…` o `/source-files/…`; 576 referencias al espejo).
- **Literales externos del Markdown (los únicos): 83 URLs únicas**:
  - `4geeksacademy.com` 37 (badges/currículo del README),
  - `github.com/4GeeksAcademy` a **otros repos** 32,
  - `4geeks.com` 10 (lecciones externas citadas),
  - `github.com/4GeeksAcademy/ai-engineering-syllabus` 4: `graphs/contributors` y
    `blob/main/assets/cover/images/cinema_matrix.png?raw=true` (badge/asset fuera de
    `content/`) y `tree/main/content/contexts/10-realtime/{communication,notification}`
    (directorios que **no existen** en el snapshot; `links.ts:5-12` los conserva
    externos por diseño).
- **0 `<img>` cargan de `raw.githubusercontent.com`** en las 238 páginas; histograma de
  hosts de imagen: `img.shields.io` 166, `localhost:3100` (self-hosted) 7,
  `github.com` 1 (la imagen literal `cinema_matrix.png?raw=true` del Markdown), raw 0.
  Las 4 únicas menciones textuales de `raw.githubusercontent.com` están dentro de
  bloques `<pre><code>` (URL de ejemplo de un dataset IBM), no son cargas.

### QA-F.4 Idioma global y tema (ADR-019 + tema por cookie)

- **Listas solo con documentos del idioma elegido:** `/projects` (78/84 etiquetas
  cambian), `/contexts` y `/lessons` (H1 `Contextos/Contexts`, `Lecciones/Lessons`;
  0/5 títulos de lección iguales entre idiomas).
- **Asides de contexto:** 22 contextos × 2 idiomas → **0** documentos con sufijo del
  otro idioma y 0 pares duplicados; los 4 sin preferido pasan de 16/8 variantes a
  8/8/8/4 (una por par), con los `.md`/`.en.md` en inglés y `.es.md` en español.
- **Enlace «available in English/Spanish» del Markdown:** p. ej. en
  `/projects/ai-eng-milestone-data-pipeline-design` (es) →
  `/preferences/language/en?next=%2Fprojects%2F…`; cadena completa con cookie jar:
  `303` + `set-cookie: lang=en; Path=/; Max-Age=31536000; SameSite=Lax` → el siguiente
  GET sirve el H1 inglés. En la lección, `available in English` → H1 inglés; el
  selector global preserva `?doc` en `next` y al seguirlo se ve la variante inglesa
  del mismo documento del par.
- **`<html lang>` y clase de tema por cookie:** sin cookie → `lang="es" class="antialiased"`;
  `theme=dark` → `… dark`; `theme=light` → `… light`; `theme=system` o valor inválido →
  sin clase; `lang=en` → `lang="en"`. Ciclo del selector verificado con cookie jar
  (`/preferences/theme/dark` → `dark`, luego `light` → `light`).
- **Open-redirect bloqueado en ambas rutas** (`safeNextPath` en `lib/i18n/index.ts:42-60`):

  | `next` en `/preferences/language/en` y `/preferences/theme/dark` | `Location`          |
  | ---------------------------------------------------------------- | ------------------- |
  | `https://evil.example/x`                                         | `/projects`         |
  | `//evil.example/x`, `%2F%2Fevil.example`                         | `/projects`         |
  | `/\evil.example`, `/%0d%0aSet-Cookie:x=1`                        | `/projects`         |
  | `javascript:alert(1)`, `http:%2F%2Fevil.example`                 | `/projects`         |
  | `/projects%3Ffoo%3Dbar` (interno válido)                         | `/projects?foo=bar` |
  | idioma `de` / tema `neon`                                        | `404` sin cookie    |

- **`?lang` antiguo ignorado sin 404** en las 8 rutas probadas (`/projects`,
  `/projects/4-devs`, subproyecto, `/contexts`, `/contexts/01-web-fundamentals`,
  `/lessons`, lección, `/`→307); con cookie `en` + `?lang=es` gana la cookie. Esto
  resuelve por diseño la inconsistencia H-2/R-1 (ver QA-F.5).

### QA-F.5 Estado de R-1 y regresiones nuevas (R2-n)

- **R-1 (MINOR de la Re-QA) — resuelto por ADR-019.** Ya no existe una política
  distinta por ruta: `?lang` se ignora (200) de forma consistente en índices y vistas,
  y la variante la decide la cookie. Los tests de H-2 que exigían 404 se sustituyeron
  por la política nueva (suite 547 verde).
- **R2-1 (NIT, no bloqueante) — el shell estático desaparece.** Ambos builds muestran
  **todas** las rutas como `ƒ` (antes `/` y `/_not-found` eran `○`). Causa:
  `layout.tsx:22` lee `cookies()` (`getUiLanguage`/`getUiTheme`), lo que vuelve dinámico
  todo el árbol; es inherente al idioma/tema por cookie (ADR-019) y ninguna AC se
  resiente. Si en el futuro se quiere shell estático, habría que resolver el tema en
  cliente con script previo y cachear el idioma.
- **R2-2 (NIT, no bloqueante) — la nota de fallback no es ejercitable con el corpus
  actual.** Barrido local: 0 `.es.md` sin variante en y 0 `.en.md` sin variante es
  (los 94 `.md` sin par tienen `language=null` y se muestran tal cual, sin nota). El
  mecanismo está implementado (`document-view.tsx:84-87`) y cubierto por 5 tests; no
  hay defecto, solo falta un caso real para verlo en vivo.
- **R2-3 (NIT, no bloqueante) — `..` sin codificar se normaliza antes del handler.**
  `/source-files/content/projects/../projects/learn.json` devuelve `200` del archivo
  válido `content/projects/learn.json` (normalización de la capa HTTP); `%2e%2e` y
  cualquier intento de salir de la raíz devuelven `404`. No hay fuga: el handler
  rechaza segmentos `.`/`..`/separadores/byte nulo (`route.ts:69-100`).
- Sin más regresiones: conteos, orden, fidelidad, enlaces, assets, procedencia,
  saneado y degradación sin base se comportan igual que en la Re-QA.

### QA-F.6 Veredicto final

**LISTO PARA CERRAR.** Gate completo verde (install frozen, lint, typecheck,
**547 tests + 1 skipped** previsto, prettier, `next build` normal y con
`DATABASE_URL=` vacío), **13/13 AC en PASS en ambos idiomas**, independencia de 4Geeks
verificada en runtime (118/118 binarios servidos con bytes idénticos y ETag por
contenido, `/source-files` con traversal bloqueado y 304, **0 enlaces generados** a
hosts de 4Geeks y **0 `<img>` de `raw.githubusercontent.com`** en 238 páginas, con la
lista cerrada de 83 URLs literales del Markdown), idioma global y tema funcionando por
cookie con open-redirect bloqueado y `?lang` ignorado, y guard AC-0.10 en verde
(31 passed). No hay BLOCKER, MAJOR ni MINOR; solo 3 observaciones NIT (R2-1..R2-3)
que no bloquean el cierre. No se escribió en la base, no se modificó ningún archivo
del repo salvo este informe y no se expuso ningún secreto.
