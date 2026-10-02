# M2 — Auditoría y Plan Mínimo (Navegador del syllabus real)

- Hito: **Hito 2 — Navegador del syllabus real** (`docs/milestones/M2_REAL_SYLLABUS_UI.md`).
- Estado: auditoría **READ-ONLY** + propuesta. No se ha creado ni modificado código ni datos; el único artefacto es este informe.
- Fecha de la auditoría: 2026-10-02.
- Repo fuente auditado: `4GeeksAcademy/ai-engineering-syllabus`, commit pinneado `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- Snapshot activo real consultado (solo lectura): `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, `ref = main`, `status = complete`, `imported_at = 2026-10-02T12:13:49.515Z`, 0 errores. Es el único snapshot de la base; la regla de "snapshot activo" definida abajo (último `complete`/`complete_with_errors`) lo selecciona.
- Documentos leídos completos: `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `REPO_MAP.md`, `MILESTONES.md`, `STATUS.md`, `docs/milestones/M2_REAL_SYLLABUS_UI.md`, `DECISIONS.md` (ADR-001..012), `ARCHITECTURE.md`, `DATA_MODEL.md`, `PRODUCT.md`, `SPECS.md`, `BACKLOG.md`, `docs/milestones/M1_QA_TECHNICAL.md`, `docs/milestones/M1_QA_FIDELITY.md`, `docs/milestones/M1_AUDIT_PLAN.md`, `platform/README.md`; además `platform/src/source/types.ts`, `store/schema.ts`, `store/postgres-store.ts`, `classify/indexes.ts`, `classify/paths.ts`, `platform/src/app/**`, `platform/src/components/**`, `platform/src/test/**`, `platform/vitest.config.mts`, `platform/tsconfig.json`, `platform/next.config.ts`, `platform/package.json`, `platform/fixtures/source/manifest.json` y la documentación relevante de Next 16 en `platform/node_modules/next/dist/docs/` (`fetching-data`, `caching`, `route-handlers`, `dynamic-routes`, `connection`).
- Skills de diseño leídas (las tres rutas existen): `/Users/aresdominguezgil/.claude/skills/impeccable/SKILL.md` (84 líneas), `/Users/aresdominguezgil/.claude/skills/emil-design-eng/SKILL.md` (674 líneas), `/Users/aresdominguezgil/.claude/skills/design-taste-frontend/SKILL.md` (1206 líneas). Resumen aplicado en la sección 4.
- Baseline git: limpio al empezar; este informe añade únicamente `docs/milestones/M2_AUDIT_PLAN.md`.
- Convención de comandos: todos los comandos de app se ejecutan como `npx --yes pnpm@12.8.1 --dir platform <cmd>` (nunca `pnpm install` en la raíz). En esta auditoría no se ejecutó ningún comando de app (ni `install`, ni `build`, ni `test`, ni `ingest`, ni `db:migrate`).
- Restricciones respetadas: READ-ONLY; la base se consultó con `SELECT` dentro de una transacción `BEGIN READ ONLY` (y `SET LOCAL statement_timeout`); `DATABASE_URL` se cargó desde `platform/.env.local` sin imprimirla, copiarla ni registrarla; los scripts efímeros vivieron fuera del repo (en el directorio temporal de la sesión) y se eliminan al cerrar. No se escribió en la base.

---

## 1. AC-2.1 .. AC-2.13: texto literal, interpretación verificable y evidencia

Texto literal de `docs/milestones/M2_REAL_SYLLABUS_UI.md` (líneas 9-21). "Evidencia" es el test/comando/artefacto que demostrará la implementación. Las ambigüedades se detallan después de la tabla.

| AC      | Texto literal                                                      | Interpretación mínima verificable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Evidencia propuesta                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2.1  | `vista Projects.`                                                  | Existe una vista de lista en `/projects` que muestra **todas** las filas de `source_projects` del snapshot activo (84/84 en el snapshot auditado) y ninguna más; cada fila enlaza a su vista Project. No se filtra por idioma, orden ni tipo.                                                                                                                                                                                                                                                                                                  | Test de reconciliación con PGlite (filas insertadas = ítems renderizados) + consulta real `SELECT count(*) FROM source_projects WHERE snapshot_id = $1` → 84 (ver §2). Captura de `/projects`.                                                                                                                                                                                    |
| AC-2.2  | `orden obtenido de content/projects/README.md.`                    | El orden de presentación se deriva del propio README importado (`source_files.path = 'content/projects/README.md'`, blob `972ec8eb730e6ca243da177c08e008977d514e42`), no de ninguna lista en código. Regla concreta en §2.3: posición por primera aparición de un enlace `./<carpeta>` del README; se conservan las secciones literales; los proyectos no listados se muestran aparte como "sin orden declarado".                                                                                                                              | Test unitario `parseProjectOrder` con el fixture verbatim del README (ADR-009) + reconciliación contra la base: 79 unidades con posición, 5 sin mención, 2 enlaces anidados, 3 enlaces a contextos (no son unidades).                                                                                                                                                             |
| AC-2.3  | `vista Project.`                                                   | Ruta `/projects/[slug]` que muestra el documento preferido del proyecto (`preferred_readme_path`, en el corpus auditado 84/84 son `README.es.md`) renderizado fielmente, con selector de idioma, cabecera de procedencia y enlaces resueltos. Sin progreso, notas ni repo personal (H3/H7).                                                                                                                                                                                                                                                    | Test de página/componente con datos reales del fixture; comprobación `getProject(slug)` y `notFound()` para slug inexistente; captura.                                                                                                                                                                                                                                            |
| AC-2.4  | `vista Contexts.`                                                  | `/contexts` lista las 22 filas de `source_contexts` del snapshot activo. No hay orden canónico en la fuente para contextos (el README dice "orden sugerido" y tiene enlaces rotos); se listan en orden de `source_path` (determinista y no educativo).                                                                                                                                                                                                                                                                                         | Test de reconciliación 22/22; captura.                                                                                                                                                                                                                                                                                                                                            |
| AC-2.5  | `vista Context.`                                                   | `/contexts/[slug]` muestra el contexto real. **4/22 no tienen `preferred_readme_path`** (06-telemetry-data-pipelines, 08-agent-engineering, 10-realtime, sales-forecasting: sus `CONTEXT-*.md` están en subdirectorios); la vista lista **todos** los documentos de `metadata.contextDocumentPaths` y renderiza el elegido con `?doc=<path>`. Nunca se elige un "preferido" inventado.                                                                                                                                                         | Test con los 4 casos reales (metadata) + 18 con preferido; `?doc` inválido → 404; captura.                                                                                                                                                                                                                                                                                        |
| AC-2.6  | `vista Lessons.`                                                   | `/lessons` lista las 5 filas de `source_lessons` (no existe README raíz de lecciones; el orden es `source_path`).                                                                                                                                                                                                                                                                                                                                                                                                                              | Reconciliación 5/5; captura.                                                                                                                                                                                                                                                                                                                                                      |
| AC-2.7  | `vista Lesson.`                                                    | `/lessons/[slug]` renderiza `<slug>.es.md` preferido y ofrece el par real (`<slug>.md`, evidencia `en/pair-convention`).                                                                                                                                                                                                                                                                                                                                                                                                                       | Test con fixture real de lección (frontmatter + H1); captura.                                                                                                                                                                                                                                                                                                                     |
| AC-2.8  | `render Markdown fiel.`                                            | Pipeline server-side `react-markdown` + `remark-gfm` + `remark-frontmatter` + `rehype-raw` + `rehype-sanitize` (allowlist). Se renderizan GFM (tablas, task lists), HTML embebido real (`<details>`, `<img>`, `<table>`, `<div>`, `<br>`) y bloques de código; el frontmatter YAML se oculta (no se muestra como texto). No se resume, reescribe ni omite nada.                                                                                                                                                                                | Tests del renderer con fragmentos verbatim de fixtures reales (p. ej. `<details>` de `ai-eng-milestone-data-pipeline-design/README.md`, `<table>` de `simple-dashboard-tailwind-css/README.md`, frontmatter de `4geeks-student-extension.es.md`); test de que el texto plano renderizado contiene todos los enlaces/items del fuente y de que un `<script>` inyectado se elimina. |
| AC-2.9  | `enlaces relativos funcionan.`                                     | Política única de resolución (§3.4): (a) el target existe en el snapshot y tiene vista interna → ruta interna; (b) existe pero no tiene vista interna → URL de GitHub `blob`/`tree` **pinneada al commit**; (c) no existe en el snapshot → se muestra como **roto** (nunca se "arregla" inventando destino); (d) `http(s)`/`mailto` quedan igual. En el corpus hay 670 referencias relativas (enlaces e imágenes inline): 652 resuelven, 17 targets de fichero son rotos y 1 apunta a un directorio inexistente (inventario en el apéndice B). | Test unitario de la función de resolución con los 18 casos rotos reales y con casos existentes; test que recorre los 899 `source_files` y clasifica cada enlace; verificación read-only en QA.                                                                                                                                                                                    |
| AC-2.10 | `assets soportados.`                                               | Alcance H2: las imágenes referenciadas por los documentos (png/jpg) se renderizan inline con la `binary_reference` pinneada del archivo; PDF/CSV/JSON/HTML referenciados se ofrecen como enlace de descarga a esa misma URL; no hay visor de PDF, ni previsualización de CSV, ni galería (eso es H4). Los bytes binarios **no están en el store** (solo la referencia; 118/118 binarios verificados).                                                                                                                                          | Test: 118/118 `binary_reference` con forma `https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/<commit>/<path>`; test del `<img>` con `src` resuelto a esa URL; caso real `./.learn/page-speed-example.png` en `html-css-artist-landing-seo-access/README.md`.                                                                                               |
| AC-2.11 | `source path y commit visibles.`                                   | Cabecera de procedencia visible en cada vista de unidad y documento con: repo `owner/name`, commit completo y corto, `ref`, `source_path`, `blob_sha` del documento, `snapshot_id`, `imported_at` y enlace a GitHub blob@commit.                                                                                                                                                                                                                                                                                                               | Test DOM de `ProvenanceHeader` con datos reales + captura de una vista Project.                                                                                                                                                                                                                                                                                                   |
| AC-2.12 | `selector de idioma cuando exista.`                                | El selector aparece **solo** si el documento mostrado tiene ≥2 variantes reales en el snapshot según ADR-012 (`.es.md`, `.en.md`, `X.md` con `X.es.md`). La inicial es la preferida (español cuando existe). No se traduce nada ni se ofrecen idiomas sin archivo. En contextos multi-documento, las variantes se calculan por documento seleccionado.                                                                                                                                                                                         | Tests con datos reales: 84/84 proyectos tienen par `README.es.md`+`README.md`; 5/5 lecciones par `<slug>.es.md`+`<slug>.md`; 18/22 contextos con par; caso sin par (fixture `.learn/solution/README.md`, blob `49083ff…`) → sin selector.                                                                                                                                         |
| AC-2.13 | `no aparece ningún elemento educativo inexistente en el snapshot.` | Toda fila, título, documento y enlace mostrado proviene de una fila del snapshot activo o de una derivación literal de ella (etiqueta de un enlace del README, primer H1, slug del path). No hay contenido educativo en el código; slugs desconocidos → 404.                                                                                                                                                                                                                                                                                   | Test de reconciliación "UI renderizada == filas del snapshot" con PGlite; guard AC-0.10 verde; test negativo (slug inventado no existe y no se genera nada); revisión de que todo texto educativo renderizado es una subcadena literal del `raw_content` correspondiente.                                                                                                         |

### 1.1 Ambigüedades señaladas

1. **"vista Projects" vs "vista Project" (AC-2.1 vs AC-2.3).** Se interpretan como lista (`/projects`) y detalle (`/projects/[slug]`). No hay ruta `/project` singular.
2. **"orden obtenido de `content/projects/README.md`" (AC-2.2).** El README no es una lista limpia: tiene 84 enlaces `](...)`, de los cuales 81 empiezan por `./` (71 entradas numeradas `0..70`, 1 enlace `./4-devs`, 2 enlaces anidados `./4-devs/<sub>` y 7 en "Other projects") y 3 son `../contexts/...`. Además, 5 carpetas de primer nivel no aparecen en absoluto y la sección "Other projects" declara literalmente _"Not part of the syllabus sequence"_. La interpretación mínima está en §2.3; no se inventa posición para los no listados.
3. **Subproyectos anidados (p. ej. `4-devs`).** `source_projects` indexa solo carpetas de primer nivel; `4-devs` tiene 2 subproyectos reales con `learn.json` (16 archivos bajo `content/projects/4-devs/`). Decidir si H2 los presenta y cómo (pregunta 1, §7).
4. **"selector de idioma cuando exista" (AC-2.12).** Se define como "≥2 variantes reales del documento mostrado según ADR-012". El corpus no tiene traducciones: los pares son archivos reales. Un contexto con 4 empresas y 8–16 documentos no tiene "un idioma"; el selector se calcula por documento.
5. **"assets soportados" (AC-2.10) en H2 vs H4.** `MILESTONES.md` asigna "Contextos, assets y relaciones" a H4. En H2 se soportan las referencias del render (imágenes inline y enlaces), no la gestión/visores de assets. Los bytes no están en el store: `binary_reference` es una URL pinneada y no hay columna de bytes (ver §2.5).
6. **`title` y `canonical_order` nulos.** M1 los dejó `NULL` a propósito (`DATA_MODEL.md:216-222`; consulta real: 0 no nulos). H2 debe derivarlos en lectura sin inventar: etiqueta literal del README > primer H1 del documento preferido > slug del path.
7. **Contextos sin documento preferido.** 4/22 contextos tienen sus `CONTEXT-*.md` en subdirectorios (F-07 de `M1_QA_FIDELITY.md`, diferido a BACKLOG). "Vista Context" debe mostrar todos los documentos reales, no un preferido inventado.

---

## 2. Inventario de los datos disponibles para la UI

Método: consultas `SELECT` reales contra la base de `platform/.env.local` (transacción de solo lectura; la URL nunca se imprimió) y contraste local. Ver §2.1 para las tablas y §2.8 para la verificación de que `content/` local es idéntico al snapshot importado.

### 2.1 Tablas y columnas del store

Esquema real: `platform/src/source/store/schema.ts` (7 tablas, migración `platform/drizzle/0000_puzzling_tenebrous.sql`). Lo relevante para leer la UI:

| Tabla                  | Columnas que usará la UI                                                                                              | Consulta/estado real                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_repositories`  | `owner`, `name`, `canonical_url`, `default_branch`                                                                    | 1 fila: `4GeeksAcademy/ai-engineering-syllabus`, `main`.                                                                                                         |
| `source_snapshots`     | `id`, `ref`, `commit_sha`, `imported_at`, `status`                                                                    | 1 fila: snapshot `1b8fb5cc…`, `complete`, commit `962c1e5…`.                                                                                                     |
| `source_files`         | `path`, `blob_sha`, `media_type`, `language`, `language_evidence`, `raw_content`, `binary_reference`                  | 899 filas: 781 texto (`raw_content`) y 118 binario (`binary_reference`), 0 errores (`source_import_errors`).                                                     |
| `source_projects`      | `source_path`, `canonical_order`, `title`, `preferred_readme_path`, `language`, `language_evidence`, `metadata jsonb` | 84 filas; `canonical_order` y `title` **100% NULL**; `preferred_readme_path` 0 NULL, 84/84 `.es.md`; `metadata.hasLearnJson = true` en 83 (falta solo `4-devs`). |
| `source_contexts`      | ídem sin `canonical_order`                                                                                            | 22 filas; 4 con `preferred_readme_path = NULL`; `metadata.contextDocumentPaths` y `readmePaths` con hechos del árbol.                                            |
| `source_lessons`       | ídem sin `canonical_order`                                                                                            | 5 filas; 5/5 `preferred_readme_path = <slug>.es.md`; `metadata.documentPaths` con el par `.md`/`.es.md`.                                                         |
| `source_import_errors` | —                                                                                                                     | 0 filas para el snapshot activo.                                                                                                                                 |

`source_url`/`source_commit`/`source_hash` del `CONTENT_CONTRACT.md` no son columnas: se derivan de `canonical_url + commit_sha + path` y de `blob_sha`. No hay que inventar ni duplicar.

Consulta base del "snapshot activo" (último terminado; la única fila hoy):

```sql
SELECT s.id, s.ref, s.commit_sha, s.status, s.imported_at,
       r.owner, r.name, r.canonical_url, r.default_branch
FROM source_snapshots s
JOIN source_repositories r ON r.id = s.repository_id
WHERE s.status IN ('complete', 'complete_with_errors')
ORDER BY s.imported_at DESC
LIMIT 1;
```

### 2.2 Distribución real por tipo de archivo e idioma (snapshot activo)

- Tipos (`media_type`, 899): `text/markdown` 666 · `image/png` 101 · `application/json` 87 · `application/pdf` 12 · `text/csv` 9 · `text/html` 8 · `image/jpeg` 4 · `application/sql` 4 · `text/plain` 3 · `text/css` 2 · `application/octet-stream` 1 (el `.DS_Store` versionado) · `application/x-ipynb+json` 1 · `text/javascript` 1.
- Markdown por root: `content/projects` 412 · `content/contexts` 244 · `content/lessons` 10. README raíz de proyectos: 2 (`README.md` + `README.es.md`), también en contextos.
- Idioma (ADR-012, 899): `es`+`suffix` 286 · `en`+`pair-convention` 222 · `en`+`suffix` 64 · `null`+`null` 327.
- Pares: 222 `.md` tienen sibling `.es.md` en el mismo directorio; 94 `.md`/`.en.md` no lo tienen. 4/22 contextos no tienen par directo porque el documento está en subdirectorio.

### 2.3 Cómo se obtiene el orden de `content/projects/README.md`

**No existe ya parseado en el store**: `source_projects.canonical_order` es `NULL` en las 84 filas y ningún código lo calcula. El README sí está importado como texto: `source_files` tiene la fila `content/projects/README.md`, `media_type = text/markdown`, `language = en/pair-convention`, `blob_sha = 972ec8eb730e6ca243da177c08e008977d514e42`. El archivo local `content/projects/README.md` tiene exactamente ese `blob_sha` (`git hash-object` → `972ec8eb…`), por lo que se puede citar como idéntico al snapshot. Formato real (extracto literal):

```markdown
# AI Engineering Projects

...

## Projects (suggested order)

0. **[Is This Snack Healthy? — A Nutrition-Check Automation](./n8n-snackcheck-nutrition)**
   Capstone n8n workflow: barcode webhook → Open Food Facts → traffic-light + Nutri-Score rules → tone-adaptive Groq verdict, with diagram, README, tests, and CHANGELOG.

1. **[Company Project Milestone: Choose Your Company](./ai-eng-milestone-choose-company)**
   `Milestone 0` — Pick your fictional company, capture it in `CONTEXT.md`, and prepare the narrative and data you will reuse in later milestones.

...

68. **[Milestone — Real-Time Systems: Agent Observability (Part 1 of 2)](./ai-eng-milestone-real-time-agent-observability)**
    `Milestone 10` Part 1 — ... CONTEXT: [`10-realtime/agent-observability`](../contexts/10-realtime/agent-observability).

69. **[Milestone — Real-Time Systems: Agent Control (Part 2 of 2)](./ai-eng-milestone-real-time-agent-control)**
    ... CONTEXT: [`10-realtime/agent-control`](../contexts/10-realtime/agent-control).

70. **[Capstone — Final Project Video: 5-Minute AI Pitch](./ai-eng-capstone-project)**
    Capstone — ...

## For Devs course

Separate track under [`./4-devs`](./4-devs). Contexts live in [`../contexts/4-devs`](../contexts/4-devs).

- **[Operations Backoffice – Incident Manager](./4-devs/ai-eng-incident-manager-for-devs)**
  ...
- **[Operations Backoffice – Inventory Manager](./4-devs/ai-eng-inventory-manager-for-devs)**
  ...

## Other projects

Not part of the syllabus sequence. Kept here for reference or optional use.

- **[Platform – Roles and Permissions](./ai-eng-roles-permissions)**
  ...
```

Regla mínima de parseo (pura, testeable): recorrer el Markdown en orden de documento (ignorando bloques de código y frontmatter si los hubiera); capturar enlaces cuyo target empiece por `./`; conservar la sección `##` vigente y la etiqueta literal del enlace; la posición de una unidad de primer nivel es la primera aparición de `./<slug>` o de un descendiente `./<slug>/...` (por eso los 2 subproyectos de `4-devs` refuerzan la posición de `4-devs`); ignorar los `../contexts/...`. Resultado medido sobre el README real:

| Métrica                                                                                                      | Valor                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entradas numeradas de la secuencia (`0..70`)                                                                 | 71                                                                                                                                                                                        |
| Enlace de track `./4-devs` ("For Devs course")                                                               | 1                                                                                                                                                                                         |
| Subproyectos anidados listados (`./4-devs/incident-manager-for-devs`, `./4-devs/inventory-manager-for-devs`) | 2 (no son filas de `source_projects`)                                                                                                                                                     |
| "Other projects" (roles, federated-auth, audit-log, async, security, time-notification, time-communication)  | 7                                                                                                                                                                                         |
| Unidades de primer nivel con posición en el README                                                           | 79 / 84                                                                                                                                                                                   |
| Unidades sin mención en el README (se muestran aparte, ordenadas por `source_path`)                          | 5: `ai-eng-cybersecurity-practices`, `ai-eng-cybersecurity-vulnerabilities`, `ai-eng-evaluating-regression-model`, `ai-eng-sales-forecasting-timeseries`, `vps-ssh-resource-optimization` |
| Enlaces `../contexts/...` dentro del README (relaciones, no unidades)                                        | 3                                                                                                                                                                                         |
| Duplicados de slug en la lista                                                                               | 0                                                                                                                                                                                         |

`content/contexts/README.es.md` (blob `a2dfc4b7…`, también idéntico al local) tiene una "orden sugerido" con 25 targets: 22 primeras-segmentos, 3 carpetas no listadas (`09-agentic-workflows`, `cybersecurity-analysis`, `sales-forecasting`), 2 enlaces rotos (`./04-ai-driven-engineering`, `./09-workflows-automation`), `./06-telemetry-data-pipelines/telemetry` (subdirectorio, no el contexto) y `07-trainning-rag` repetido. No se usará como orden canónico de contextos en H2 (no lo exige el AC): lista por `source_path`.

### 2.4 Estructura de proyectos, contextos y lecciones

- **Proyectos (84).** Cada carpeta de primer nivel tiene `README.md` y `README.es.md` (84/84), y 83 tienen `learn.json` en la raíz (solo `4-devs` no). Hay 86 `learn.json` en total: los 83 raíces + `content/projects/learn.json` (blob `260e32fd…`) + 2 anidados en `4-devs`. El `learn.json` raíz es un archivo real de 2260 B con `slug`, `title {us,es}`, `description {us,es}`, `preview`, `difficulty`, `duration`, `technologies`, etc.; **H2 no lo parsea ni muestra sus campos** (decisión propuesta; ver pregunta 2). El `title`/`description` literal de `learn.json` queda como material auxiliar para H4.
- **Subproyectos anidados.** `content/projects/4-devs/` contiene 16 archivos: `README.md`/`README.es.md` y 2 subcarpetas (`ai-eng-incident-manager-for-devs`, `ai-eng-inventory-manager-for-devs`) con 7 archivos cada una (README par, `learn.json`, `.learn/example/README` par, `.learn/solution/README.md`, `.learn/preview.png`). No tienen fila en `source_projects`.
- **Contextos (22).** 18 con documento preferido directo (`README.es.md` en `4-devs`, `CONTEXT-<empresa>.es.md` en el resto) y 4 sin preferido (documentos en subdirectorio). Ejemplo real de estructura anidada:
  - `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-{brasaland,healthcore,nexova,trackflow}.{es.,}md` (8)
  - `content/contexts/06-telemetry-data-pipelines/telemetry/CONTEXT-{…}.{es.,}md` (8)
  - `content/contexts/08-agent-engineering` (16) y `content/contexts/10-realtime` (16) con el mismo patrón.
  - `content/contexts/4-devs/` tiene `README.md`/`README.es.md` y 2 subcarpetas (`incident-manager-for-devs`, `inventory-manager-for-devs`) con 8 documentos cada una.
- **Lecciones (5).** No hay `README.md`: `content/lessons/<slug>/<slug>.md` + `<slug>.es.md`. Los 10 markdown llevan **frontmatter YAML** (`title`, `description`, `author`, `tags`) y un H1 posterior: ejemplo real `content/lessons/4geeks-student-extension/4geeks-student-extension.es.md`, blob `41313f08…` (local idéntico).

### 2.5 Assets y binarios: qué hay realmente

- 118 binarios (`png` 101, `pdf` 12, `jpg` 4, `application/octet-stream` 1), **todos** con `binary_reference` y `raw_content = NULL`; 0 bytes binarios en la base.
- La referencia es una URL pinneada al commit, siempre con la misma forma. Consulta real: 118/118 coinciden con `https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/962c1e5fc8ebad273abaa348fb3d161568ce8707/<path>`. Ejemplo textual:

  ```text
  content/contexts/09-agentic-workflows/rfp-requests/trackflow/CONTEXT-trackflow-request-3.pdf
  → https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/962c1e5fc8ebad273abaa348fb3d161568ce8707/content/contexts/09-agentic-workflows/rfp-requests/trackflow/CONTEXT-trackflow-request-3.pdf
  ```

- Imágenes dentro de los Markdown: 357 referencias `![...](...)`, de las cuales 348 son absolutas (shields.io y similares) y 9 relativas. Ejemplo relativo real: `content/projects/html-css-artist-landing-seo-access/README.md` usa `<img src="./.learn/page-speed-example.png" alt="Example PageSpeed Insights result" width="260" />`; el archivo existe como binario con su `binary_reference`.
- No hay SVG dentro de `content/`; el repo completo tiene 6 SVG fuera de los tres roots (no importados).

### 2.6 Enlaces relativos, HTML embebido, imágenes y frontmatter reales

- **Referencias relativas** (todos los `[...](target)`/`![...](target)` no absolutos de los 666 markdown): 670; resuelven 652, rotos 17 y 1 directorio inexistente. Por forma: 589 `./`, 79 `../`, 2 absolutos de raíz (`/forgot-password`, que en el fuente son rutas de la app de ejemplo, no paths del repo), 0 anclas. Ejemplos reales:
  - `content/contexts/01-web-fundamentals/CONTEXT-brasaland.es.md → ./CONTEXT-brasaland.en.md` (existe, par de idioma).
  - `content/contexts/07-trainning-rag/CONTEXT-brasaland.es.md → ../00-general-contexts/brasaland/brasaland-loyalty-program.es.md` (existe, corpus de contexto).
  - `content/contexts/09-agentic-workflows/CONTEXT-brasaland.es.md → ./rfp-requests/brasaland/` (directorio existente).
  - `content/projects/ai-eng-milestone-real-time-agent-control/.learn/solution/README.md → ../../../contexts/10-realtime/agent-observability/` (roto en el fuente: resuelve a `content/projects/contexts/...`).
  - `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-brasaland.es.md → ./CONTEXT-brasaland-pipeline.md` (roto: los hermanos reales son `CONTEXT-brasaland.md`/`.es.md`).
  - `content/contexts/README.es.md → ./04-ai-driven-engineering` y `./09-workflows-automation` (rotos: esas carpetas no existen).
- **HTML embebido** (conteo de archivos que lo contienen): `<img` 4, `<details` 4, `<table` 10, `<div` 20, `<br` 6; `<iframe` 0 y `<video` 0. Ejemplos reales: `<details>` en `content/projects/ai-eng-milestone-data-pipeline-design/README.md` y `.../ai-eng-milestone-rag-knowledge-base/README.md`; `<table>` en `content/projects/simple-dashboard-tailwind-css/README.md`; `<div>` en `content/projects/ai-eng-milestone-web-fundamentals/README.md`; `<Table rows={filtered} />` como texto en un README de `.learn/solution/`.
- **Frontmatter**: 10 archivos empiezan por `---` (los 10 markdown de lecciones, 5 pares). Si el renderer no lo trata, aparecería como contenido visible (infiel). Debe ocultarse y, si se quiere, usarse su `title` literal.
- **Imágenes referenciadas en Markdown**: 357 totales; la mayoría escudos absolutos. Assets locales de ejemplo: 9 referencias relativas (`.learn/*.png`).

### 2.7 Reconciliación UI-ready (lo que la vista puede consultar sin escanear el corpus)

Consultas que la capa de lectura usará (todas devuelven lo mínimo; nunca `raw_content` en listas):

- Lista de proyectos: `source_projects` (sin `raw_content`) + lectura del único `source_files/raw_content` del README para ordenar/titular.
- Lista de contextos/lecciones: filas de índice + `metadata` (arrays de paths) y, opcionalmente, el documento preferido para el título H1 (una fila por unidad, cacheable).
- Documento: `SELECT raw_content` de una sola fila (el mayor markdown del corpus son 24.353 B; no se cargan los 12,5 MB).
- Enlaces: el conjunto completo de 899 paths + sus `blob_sha`/`binary_reference` se puede memoizar por snapshot (≈900 filas pequeñas) para resolver enlaces sin N+1.
- `source_import_errors` por snapshot para un aviso neutro si el activo es `complete_with_errors` (hoy 0).

### 2.8 Verificación de que `content/` local == snapshot importado

`git ls-tree -r -z HEAD -- content/` (899 archivos) contra `source_files.path/blob_sha` del snapshot activo: **899/899 presentes en ambos lados, 0 discrepancias de hash**. Por tanto, todas las citas de este informe tomadas de `content/` local (formato del README, frontmatter, HTML, enlaces) son literalmente el contenido importado en la base.

---

## 3. Decisiones de arquitectura propuestas (mínimas)

### 3.1 Capa de lectura `course/` (server-only)

Nueva capa `platform/src/course/` (paralela a `source/`, como prevé `ARCHITECTURE.md` "### course/ — Lee exclusivamente registros SOURCE"). Reglas:

- Solo lectura. Usa el mismo esquema Drizzle y `drizzle-orm/node-postgres`; **no** importa `source/` para escribir ni ejecuta `upsert`.
- **Snapshot activo** = fila de `source_snapshots` con `status IN ('complete','complete_with_errors')` más reciente por `imported_at`. Si no hay ninguno o falta `DATABASE_URL`, todas las funciones devuelven `null`/`[]` y la UI muestra el estado vacío neutro existente; nunca contenido inventado.
- Cliente `pg` perezoso (nunca conecta en el import), `max` pequeño, reutilizado en `globalThis` para sobrevivir al HMR de dev; errores de conexión se registran con `redactSecrets`/`describeError` de `src/lib/redact.ts`.
- Derivaciones en lectura, **sin escribir en la base**: `canonicalOrder`, `title` y variantes de idioma se calculan con funciones puras desde `raw_content`/paths. No se reingesta, no se muta el snapshot (se respeta la inmutabilidad y la idempotencia de M1). Persistirlos sería una mejora de ingesta para H9, no de H2.
- La concentración de SQL en `course/` mantiene la UI tonta y testeable con PGlite.

**ADR-013 propuesto** — _Capa `course/` de lectura server-only sobre el snapshot activo, con orden/título/idioma derivados en lectura (no persistidos), sin escrituras ni reingesta en H2._

### 3.2 Rutas App Router (propuesta concreta de URLs)

Next 16: `params` y `searchParams` son `Promise` (hay que `await`; `platform/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` y `page.md`). Propuesta:

| URL                           | Vista (AC)  | Contenido                                                                        |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `/`                           | redirección | `redirect('/projects')` (placeholder hasta el dashboard de H3).                  |
| `/projects`                   | AC-2.1      | Lista ordenada por README, agrupada por secciones literales.                     |
| `/projects/[slug]`            | AC-2.3      | Documento preferido del proyecto; `?lang={es,en}`.                               |
| `/contexts`                   | AC-2.4      | Lista de 22 contextos (orden `source_path`).                                     |
| `/contexts/[slug]`            | AC-2.5      | Documento seleccionado; `?doc=<source_path>` y `?lang={es,en}`.                  |
| `/lessons`                    | AC-2.6      | Lista de 5 lecciones.                                                            |
| `/lessons/[slug]`             | AC-2.7      | `<slug>.es.md`/`<slug>.md`; `?lang={es,en}`.                                     |
| `not-found` / `error` de ruta | robustez    | 404 neutro para slug/doc inexistente; error con reintento, sin datos inventados. |

`slug` = último segmento de `source_path` (todos son `[a-z0-9-]+`, sin espacios ni colisiones dentro de su tipo: verificado). No se usa `generateStaticParams`: las páginas acceden a la base en request time (ver §3.7) y el catálogo depende del snapshot activo.

### 3.3 Render Markdown fiel

**ADR-014 propuesto — pipeline y seguridad.**

- Dependencias (las instala el paquete W0): `react-markdown`, `remark-gfm` (tablas, task lists, autolinks), `remark-frontmatter` (ocultar el YAML de las 10 lecciones), `rehype-raw` (parsear el HTML embebido real) y `rehype-sanitize` (allowlist; obligatorio antes de renderizar HTML crudo de una fuente externa).
- Orden: `rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}`; `remarkPlugins={[remarkGfm, remarkFrontmatter]}`. Render en **Server Component** (react-markdown es compatible con RSC): el Markdown no viaja al cliente y no se paga bundle JS por renderizarlo.
- Esquema de saneado: permitir `p, h1..h6, ul, ol, li, blockquote, pre, code, em, strong, del, a[href|title], img[src|alt|title|width|height], hr, br, table/thead/tbody/tr/th/td, details, summary, input[type=checkbox][checked][disabled], span, div`; protocolos `http`, `https`, `mailto` y relativos; prohibir `script`, `style`, `iframe`, `object/embed`, atributos `on*` y URLs `javascript:`/`data:`. El contenido de un tag no permitido se conserva como texto; nunca se ejecuta.
- Justificación de seguridad: el corpus es de un repo público de terceros y contiene HTML crudo; sin `rehype-raw` el HTML se vería como texto (infiel) y sin `rehype-sanitize` habría XSS almacenado. `skipHtml` no es aceptable porque rompería AC-2.8.
- Fidelidad: no se reescriben palabras, números ni requisitos; el H1 se muestra también en el cuerpo (el título de la cabecera es adicional). No se añade tabla de contenidos ni resaltado de sintaxis en H2 (candidatos a BACKLOG).
- Código: bloques `pre/code` con estilo de tokens existente; sin librería de highlighting (evita dependencia y CSS extra).

### 3.4 Reescritura de enlaces relativos

**ADR-015 propuesto — política de enlaces** (implementada como función pura + resolvedor por snapshot; ver interfaz §6.3):

1. **Tiene vista interna**: path igual al documento preferido/variante de una unidad (o documento de contexto) → ruta interna (`/projects/[slug]?lang=…`, `/contexts/[slug]?doc=…&lang=…`, `/lessons/[slug]?lang=…`).
2. **Existe en el snapshot pero sin vista**: fichero de texto → `https://github.com/<owner>/<name>/blob/<commit>/<path>`; directorio → `https://github.com/<owner>/<name>/tree/<commit>/<path>`; binario → su `binary_reference` pinneada (raw). Son enlaces reales al commit exacto, no a `main`.
3. **No existe en el snapshot** (los 18 casos del apéndice B, incluidos los 2 `/forgot-password`): se renderiza como **roto** (texto con estilo de error y `aria-disabled`, sin `href`), nunca se "arregla" ni se redirige a un destino inventado.
4. **Externo** (`http(s)://`, `mailto:`): intacto, con `target="_blank"` y `rel="noopener noreferrer"`.
5. Anclas (`#…`): no hay ninguna en el corpus; se mantienen tal cual.

El resolvedor se construye una vez por snapshot (mapa de paths → `blob_sha`/`binary_reference` + mapa de rutas internas) y se memoiza; no hay consultas por enlace.

### 3.5 Servido de assets

**ADR-016 propuesto.** Los binarios se sirven con la `binary_reference` que ya está en el store (URL `raw.githubusercontent.com` pinneada al commit, 118/118 verificada). No se añade route handler ni proxy en H2:

- Los bytes no están en el store (solo la URL), así que un proxy solo reenviaría la descarga de GitHub, añadiendo latencia, punto de fallo y consumo de red del servidor.
- La URL es inmutable (commit, no rama) y GitHub ya aplica caché (`cache-control` observado en la auditoría de M1).
- `next/image` queda descartado en H2: su optimizer implicaría fetch remoto en servidor y `remotePatterns`; se usa `<img>` con `loading="lazy"`, `decoding="async"` y `referrerPolicy="no-referrer"`. Si H4 quiere servido propio, se añadirá `/api/source-asset/[...path]` con verificación de pertenencia al snapshot y ETag; queda como BACKLOG.

### 3.6 Selector de idioma (ADR-012) y cabecera de procedencia

- **Idioma**: para el path mostrado `P`, las variantes reales son, comprobando existencia por sufijo: si `P` termina en `.es.md` → `[P, P.en.md?, P.md?]`; si termina en `.en.md` → `[P, P.es.md?, P.md?]`; si termina en `.md` → `[P, P.es.md?, P.en.md?]`. Solo se muestran las que existen. La inicial sin parámetro es `preferred_readme_path` (español cuando existe). El selector solo se renderiza con ≥2 variantes. No se traduce ni se marca ninguna variante como "traducción" porque todas son originales del repo.
- **Procedencia** (AC-2.11): componente visible en cada vista con repo, commit corto y completo, `ref`, `source_path`, `blob_sha` del documento, `snapshot_id`, fecha de importación y enlace "Ver en GitHub" a blob@commit. No se muestra `DATABASE_URL` ni nada interno.

### 3.7 Next 16: build/SSG vs base de datos

- `next.config.ts` no tiene `cacheComponents`; las páginas intentan prerenderizarse en build. Cualquier query a la base durante el prerender haría fallar `next build` sin `DATABASE_URL` (hoy el CI compila sin base: `M1_QA_TECHNICAL.md` §1).
- Regla: cada página/layout que lea la base llama `await connection()` de `next/server` antes de la primera query (`platform/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`), de modo que el prerender se detiene y la query corre en request time. No se usa `export const dynamic = 'force-dynamic'` (evita perder el shell estático). `params`/`searchParams` se `await`ean.
- Route handlers (si H4 los añade) no están cacheados por defecto en Next 16; no hay ninguno en H2.
- El pool se crea perezosamente; el import de `course/db.ts` no conecta, así que el build no necesita `DATABASE_URL`. Se propone añadir `server-only` (paquete pequeño de Vercel) para que el bundler impida importar `course/` desde componentes cliente.

### 3.8 Resumen de ADRs propuestos

| ADR     | Decisión                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------ |
| ADR-013 | Capa `course/` server-only, lectura del snapshot activo, derivaciones en lectura sin persistir.  |
| ADR-014 | Render fiel server-side con react-markdown + remark-gfm/frontmatter + rehype-raw/sanitize.       |
| ADR-015 | Política de enlaces: interno / GitHub blob@commit / roto visible; nunca inventar destino.        |
| ADR-016 | Assets H2 vía `binary_reference` pinneada, sin proxy ni `next/image`; visores en H4.             |
| ADR-017 | Orden y títulos literales: README (etiqueta y secciones) > primer H1 > slug; contextos por path. |

---

## 4. Requisitos de diseño UI (skills `impeccable`, `emil-design-eng`, `design-taste-frontend`)

Modo de la superficie: **Read** (`impeccable` SKILL.md:31-36: "the visitor understands something. Docs, articles, guides"; estructura para comprensión). Dials aplicables de `design-taste-frontend` §1.A para "minimalist/clean/editorial": VARIANCE 5-6, MOTION 3-4, DENSITY 2-3. Reglas concretas, sin que el pulido introduzca contenido educativo (todo el texto educativo sigue viniendo del store):

### 4.1 Tipografía de prosa larga y medida

- Cuerpo `text-base`, `leading-relaxed`, ancho de medida `max-w-[65ch]` (`design-taste-frontend` §4.1); en desktop el contenido no supera ~65-75 caracteres por línea; el contenedor del shell (`max-w-5xl`) es para la app, pero el README se limita a una columna de lectura.
- Jerarquía por peso/tamaño sin H1 gigante: `design-taste-frontend` §9.B prohíbe H1 desproporcionado; el título de unidad va en `text-2xl`/`text-3xl` y el H1 del documento mantiene su nivel semántico.
- Sans-serif (la app ya usa el stack del sistema en `globals.css`); `design-taste-frontend` §4.1 desaconseja serif por defecto. Nada de fuentes decorativas en H2.
- Código con `font-mono` (token ya definido) y scroll horizontal propio; no romper el layout.
- Sin comillas decorativas ni "slop" (em-dash, gradientes de texto: §9.A/§9.G).

### 4.2 Jerarquía, navegación y layout

- `impeccable` modo Read: estructura antes que expresión; el índice de la izquierda o superior es navegación, no contenido nuevo. Las listas de Projects/Contexts/Lessons usan filas/tablas simples con separadores (`divide-y`/`border-t`) en lugar de tarjetas anidadas (`design-taste-frontend` §4.4: tarjetas solo si la elevación comunica jerarquía).
- Navegación en una sola línea en desktop y ≤80px de alto (`design-taste-frontend` §4.7). El `AppShell` actual ya cumple: se habilitan los enlaces reales "Proyectos/Contextos/Lecciones" y se mantienen "Buscar/Tutor/Progreso" deshabilitados (H3+), conservando `aria-current` para la sección activa.
- Los grupos del catálogo usan encabezados de sección reales (misma etiqueta `##` del README); no se añaden "eyebrows" decorativos.
- Estado de documento preferido/seleccionado explícito (no solo color): fondo sutil + `aria-current="true"` en la lista de documentos del contexto.

### 4.3 Estados vacíos, error y enlaces rotos

- Sin snapshot o sin `DATABASE_URL`: reutilizar el estado vacío neutro existente ("Contenido todavía no sincronizado") con el mismo tono; nunca un catálogo demo.
- Slug/doc inexistente: `notFound()` con un 404 neutro y enlace a la lista.
- Error de base de datos: `error.tsx` con mensaje neutro y "Reintentar" (sin trazas ni secretos).
- Enlace roto del fuente: estilo visible (texto tachado/subrayado punteado + icono textual "enlace roto en el origen") y `title` explicando que el enlace no existe en el commit; **no** se oculta ni se reescribe.
- Selección de idioma sin variante: no se muestra el control (nada de placeholders "próximamente" dentro de contenido educativo).
- Assets: `alt` real del Markdown; si el binario referenciado no está en el snapshot, mismo tratamiento de roto.

### 4.4 Accesibilidad

- `emil-design-eng` Accessibility: `prefers-reduced-motion` (menos y más suaves, no cero: se conservan transiciones de opacidad/color); hover solo bajo `@media (hover: hover) and (pointer: fine)`.
- Contraste WCAG AA (AAA en cuerpo si se puede) en ambos temas; foco visible con el ring del tema; navegación completa por teclado; `aria-current` en navegación y documento activo.
- Enlaces externos: `target="_blank"` + `rel="noopener noreferrer"`; aviso accesible de que salen del sitio (texto o `aria-label`).
- HTML del documento: los headings del README se renderizan con su nivel real (sin saltos artificiales); `<details>/<summary>` conservan su comportamiento nativo (teclado incluido).

### 4.5 Motion mínima

- `emil-design-eng` Animation Decision Framework: la navegación de catálogo es de uso frecuente → **sin animación** de entrada/salida de páginas; nada de animar acciones iniciadas por teclado.
- Permitido: feedback de pulsación en controles (`:active { transform: scale(0.97) }`, 100-160 ms, `ease-out`), hover de filas gated por puntero fino, y transiciones de color ≤200 ms. Nunca animar `width/height/top/left` (§ Performance Rules: solo `transform`/`opacity`).
- `design-taste-frontend` §5.D/§6.B: nada de scroll-reveal, parallax, loops infinitos ni stagger en el contenido de lectura; todo el motion opcional se apaga con `prefers-reduced-motion`.
- Cero animación sobre el texto renderizado (evita mareo y CLS).

### 4.6 Tema y color

- Un solo acento y paleta neutra ya definida en `globals.css`; sin gradientes ni glows (`design-taste-frontend` §4.2/§9.A). No se prescribe color nuevo en H2.
- Los tokens shadcn existentes cubren claro/oscuro (`.dark`); H2 no añade selector de tema (BACKLOG "temas visuales"), pero el layout no debe romper en ninguno de los dos modos y el contraste se comprueba en ambos.
- El color nunca comunica contenido educativo: los estados (roto/seleccionado) se acompañan de texto/aria.

### 4.7 Frontera de contenido

Ninguna regla de diseño puede introducir texto educativo: títulos, descripciones, nombres de sección y labels de enlaces provienen del store (o son copys neutros de interfaz: "Proyectos", "Contextos", "Lecciones", "Ver en GitHub", "Idioma", "Volver al catálogo").

---

## 5. Riesgos y gaps

1. **Conexión a base en build/SSG.** Si una página consulta sin `await connection()`, `next build` intenta el prerender y falla sin `DATABASE_URL` (el CI compila sin base). Mitigación: regla §3.7, pool perezoso y un test/CI que ejecute `build` sin `DATABASE_URL`.
2. **Tamaño de payload.** El corpus son 12,5 MB de texto; el documento mayor son 24.353 B. Riesgo de cargar `raw_content` en listas o de renderizar todo el contexto (16 documentos). Mitigación: consultas de lista sin `raw_content`, un documento por request, imágenes remotas lazy. Los 438 KB del PNG mayor no pasan por el servidor (los sirve GitHub).
3. **Contextos con documento en subdirectorio (4/22).** Sin `preferred_readme_path`; si la vista solo usara el preferido, quedaría vacía o habría que inventar uno. Mitigación: listar `metadata.contextDocumentPaths` y seleccionar con `?doc=`.
4. **Subproyectos anidados (`4-devs`).** No tienen fila en `source_projects`; sus enlaces `./4-devs/<sub>` resolverían hoy a GitHub. Decisión pendiente (pregunta 1). Riesgo de duplicar unidades si se sintetizan mal; el orden debe venir del README anidado.
5. **Archivos sin par de idioma.** 94 markdown sin `.es.md` y 327 archivos `null/null`; 4 contextos sin par. La UI no debe insinuar que existe traducción: sin variante, sin selector.
6. **Enlaces rotos en la fuente.** 18 referencias del apéndice B no existen en el snapshot: 17 targets de fichero (incluidas las 2 rutas de app `/forgot-password`) y 1 directorio; 2 enlaces del README de contextos apuntan a carpetas inexistentes (4 ocurrencias contando `.md`/`.es.md`) y 3 del README de proyectos apuntan a `../contexts/...` (existen). Deben mostrarse como rotos, jamás "arreglarse" (Apéndice B).
7. **HTML embebido y XSS.** Sin saneado, el HTML crudo es una inyección almacenada; con `skipHtml` se pierde fidelidad. Mitigación: `rehype-raw` + allowlist `rehype-sanitize` y test de inyección.
8. **Frontmatter visible.** 10 archivos de lección empezarían con `---`/`title:` como texto. Mitigación: `remark-frontmatter` (y usar su `title` solo si se decide, como texto literal).
9. **Guard AC-0.10.** El código nuevo no puede contener nombres del catálogo; los copys de UI deben ser neutros y los datos venir de la base. Los títulos de sección del README se muestran en runtime desde `raw_content`, nunca como literales en código. El nuevo fixture del README de proyectos debe declararse en el manifiesto (ADR-009) para seguir verde.
10. **Múltiples snapshots / estados.** Con varios snapshots, elegir el último terminado; si está `complete_with_errors`, mostrar un aviso neutro con el número de archivos no importados (consulta a `source_import_errors`). Nunca mezclar filas de dos snapshots.
11. **Sin snapshot activo o base caída.** La UI debe degradar al estado vacío/errores neutros; nada de cachés con contenido viejo presentado como actual sin indicar el commit.
12. **RLS/credenciales.** `DATABASE_URL` es el owner que bypassa RLS; solo puede usarse en servidor. Prohibido importar `course/` desde componentes cliente (`server-only`), prohibido `NEXT_PUBLIC_*` y prohibido registrar la URL.
13. **`next/image` y remotos.** Descartado en H2 (necesitaría `remotePatterns` y fetch server-side); si algún día se activa, revisar el BACKLOG de `sharp`.
14. **Slug/URLs.** Sin colisiones ni espacios verificados; aun así, slug desconocido → 404 (no fallback silencioso) y `?doc=` validado contra la lista real del contexto.
15. **Alcance.** SPECS Project View incluye progreso, notas y repo personal (H3/H7): no se implementan en H2, ni siquiera como placeholders dentro del contenido. `learn.json` no se muestra en H2 (pregunta 2).
16. **`content/contexts/README*.md` no es una unidad.** Está en `source_files` pero no en `source_contexts`; si se quiere mostrar como índice, requiere una vista de documento suelta (H4). En H2 queda como enlace de procedencia.

---

## 6. Plan de implementación en paquetes paralelos

Premisas: 5 workers máximo, ownership de archivos **disjunto**; W0 es "wave 0" (dependencias) y es el **único** dueño de `platform/package.json`, `platform/pnpm-lock.yaml` y `platform/pnpm-workspace.yaml`; ningún otro worker edita esos archivos ni ejecuta `pnpm install`. Las interfaces de §6.3 se congelan antes de empezar para que todos programen en paralelo; solo el renderer (W0) necesita dependencias nuevas, así que los demás no esperan a la instalación para su lógica/tests. Cada worker entrega tests propios; W4 hace la QA independiente al final.

### 6.1 Paquetes

| Paquete | Nombre                           | Archivos que posee (exclusivos)                                                                                                                                                                                                                                                                                                    | Depende de                                                        | AC que cubre                                                                           | Tests que añade                                                                                                                                                                                                                                                                                                              |
| ------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0      | Dependencias + renderer Markdown | `platform/package.json`, `platform/pnpm-lock.yaml`, `platform/pnpm-workspace.yaml`, `platform/src/lib/markdown/**`, `platform/src/components/source-markdown.tsx`, `platform/src/components/source-markdown.test.tsx`                                                                                                              | — (wave 0)                                                        | AC-2.8, AC-2.9 (render), AC-2.10 (inline)                                              | `source-markdown.test.tsx`: GFM, frontmatter oculto, `<details>/<table>/<img>` reales, `<script>`/`onerror`/`javascript:` saneados, enlaces resueltos por `resolveUrl` (incluido `broken`)                                                                                                                                   |
| W1      | Capa `course/` + fixtures        | `platform/src/course/**`, `platform/fixtures/source/962c1e5…/content/projects/README.md`, `platform/fixtures/source/manifest.json`                                                                                                                                                                                                 | W0: solo `import type` de `lib/markdown/types` (wave 0 inmediato) | AC-2.2, 2.4-2.7 (datos), 2.9 (política), 2.11 (datos), 2.12 (variantes), 2.13 (fuente) | `order.test.ts` (71 numeradas, 2 anidadas, 3 contextos, 5 sin listar), `title.test.ts` (label > H1 > slug), `language.test.ts` (pares reales y caso sin par), `links.test.ts` (los 18 rotos reales + dirs + binarios), `reader.test.ts` (PGlite + migraciones: snapshot activo, 84/22/5, orden, sin `raw_content` en listas) |
| W2      | Rutas y vistas del catálogo      | `platform/src/app/page.tsx`, `platform/src/app/projects/**`, `platform/src/app/contexts/**`, `platform/src/app/lessons/**`, `platform/src/app/not-found.tsx`, `platform/src/app/error.tsx`, `platform/src/components/catalog/**`                                                                                                   | Interfaces W0/W1/W3                                               | AC-2.1, 2.3-2.7, 2.9 (wiring), 2.11 (ubicación), 2.12 (wiring), 2.13 (render)          | `catalog/components.test.tsx` (grupos y etiquetas literales, estado seleccionado), `project-page.test.tsx` (props del fixture; slug desconocido → `notFound`), `context-page.test.tsx` (`?doc` válido/ inválido)                                                                                                             |
| W3      | Shell, procedencia e idioma      | `platform/src/app/layout.tsx`, `platform/src/components/app-shell.tsx`, `platform/src/components/app-shell.test.tsx`, `platform/src/components/provenance-header.tsx`, `platform/src/components/provenance-header.test.tsx`, `platform/src/components/language-selector.tsx`, `platform/src/components/language-selector.test.tsx` | Tipos W1 (`import type`)                                          | AC-2.11, AC-2.12                                                                       | `provenance-header.test.tsx` (commit/path/blob/enlace GitHub visibles, sin secretos), `language-selector.test.tsx` (2/3 variantes, no se renderiza con 1, `buildHref` preserva `?doc`)                                                                                                                                       |
| W4      | QA independiente y guard         | `platform/src/test/**`, `docs/milestones/M2_QA_TECHNICAL.md` (y `M2_QA_FIDELITY.md` si aplica)                                                                                                                                                                                                                                     | W0-W3 integrados                                                  | AC-2.13 + evidencia de todos                                                           | `src/test/m2-acceptance.test.ts` (reconciliación catálogo == filas del snapshot con PGlite; no hardcode; guard AC-0.10 sigue verde); QA de build sin `DATABASE_URL`, verificación read-only contra Supabase y capturas                                                                                                       |

Regla de cierre de cada worker: `npx --yes pnpm@12.8.1 --dir platform lint && ... typecheck && ... test`, y `npx --yes prettier@3.8.3 --check .` en `platform/` (W0 además `install --frozen-lockfile` tras su cambio de lockfile). W4 ejecuta el gate completo desde limpio como en `M1_QA_TECHNICAL.md` §1.

### 6.2 Grafo de dependencias y olas

```text
Ola 0:  W0 (deps + tipos/renderer)   W1 (puede empezar con los tipos de W0)
Ola 1:  W1 termina  ─┬─> W2 (rutas)
                     └─> W3 (shell/procedencia/idioma)
Ola 2:  W4 (QA, gate completo y verificación real)
```

W0 y W1 arrancan en paralelo. W2/W3 solo necesitan los contratos de §6.3 (no código terminado) y pueden desarrollar con datos de ejemplo inline; su integración final requiere W1 mergeado. Ningún paquete toca archivos de otro.

### 6.3 Interfaces congeladas entre paquetes

```ts
// platform/src/lib/markdown/types.ts — dueño W0; lo importan W0, W1 (type-only) y W2
export type MarkdownUrl =
  | { kind: "internal"; href: string; targetPath: string }
  | { kind: "external"; href: string }
  | {
      kind: "source";
      href: string;
      targetPath: string;
      targetKind: "blob" | "tree" | "raw";
    }
  | { kind: "broken"; href: null; rawHref: string };

// platform/src/components/source-markdown.tsx — dueño W0
export function SourceMarkdown(props: {
  markdown: string;
  resolveUrl: (rawHref: string) => MarkdownUrl;
}): React.ReactElement;
```

```ts
// platform/src/course/types.ts — dueño W1
export type CourseLanguage = "es" | "en";
export type CourseLanguageEvidence = "suffix" | "pair-convention";

export type CourseSnapshot = {
  snapshotId: string;
  owner: string;
  name: string;
  canonicalUrl: string;
  ref: string;
  commitSha: string;
  importedAt: string;
  status: "complete" | "complete_with_errors";
  errorCount: number;
};

export type CourseUnitKind = "project" | "context" | "lesson";
export type CourseUnit = {
  kind: CourseUnitKind;
  sourcePath: string;
  slug: string;
  title: string;
  titleOrigin: "readme-label" | "document-h1" | "source-path";
  order: number | null; // solo proyectos
  orderSection: string | null; // p. ej. "Projects (suggested order)"
  preferredDocumentPath: string | null;
  language: CourseLanguage | null;
  languageEvidence: CourseLanguageEvidence | null;
  metadata: Readonly<Record<string, unknown>>;
};

export type CourseDocument =
  | {
      kind: "text";
      path: string;
      blobSha: string;
      mediaType: string;
      language: CourseLanguage | null;
      languageEvidence: CourseLanguageEvidence | null;
      rawContent: string;
    }
  | {
      kind: "binary";
      path: string;
      blobSha: string;
      mediaType: string;
      binaryReference: string;
    };

export type LanguageVariant = {
  language: CourseLanguage;
  evidence: CourseLanguageEvidence;
  path: string;
  isPreferred: boolean;
};
```

```ts
// platform/src/course/*.ts — dueño W1 (funciones async; todas devuelven null/[] sin snapshot)
export function getActiveSnapshot(): Promise<CourseSnapshot | null>;
export function listProjects(): Promise<CourseUnit[]>; // orden README; no listados al final
export function getProject(slug: string): Promise<CourseUnit | null>;
export function listContexts(): Promise<CourseUnit[]>;
export function getContext(slug: string): Promise<CourseUnit | null>;
export function listLessons(): Promise<CourseUnit[]>;
export function getLesson(slug: string): Promise<CourseUnit | null>;
export function getDocument(path: string): Promise<CourseDocument | null>;
export function listContextDocuments(unit: CourseUnit): Promise<string[]>;
export function listLanguageVariants(path: string): Promise<LanguageVariant[]>;
export function createMarkdownUrlResolver(
  fromPath: string,
): Promise<(rawHref: string) => MarkdownUrl>;
export function githubBlobUrl(snapshot: CourseSnapshot, path: string): string;
export function githubTreeUrl(snapshot: CourseSnapshot, path: string): string;
export function shortSha(sha: string): string;

// puras, sin base — dueño W1, testables con fixtures
export function parseProjectOrder(readmeMarkdown: string): {
  entries: ReadonlyArray<{
    sourcePath: string;
    position: number;
    label: string;
    section: string;
    isNested: boolean;
    isContextLink: boolean;
  }>;
  unlistedHint: true; // los no listados se derivan fuera
};
export function extractDocumentTitle(markdown: string): string | null; // primer H1, sin frontmatter
```

```ts
// platform/src/components/provenance-header.tsx — dueño W3
export function ProvenanceHeader(props: {
  snapshot: CourseSnapshot;
  sourcePath: string;
  documentPath: string;
  blobSha: string;
}): React.ReactElement;

// platform/src/components/language-selector.tsx — dueño W3
export function LanguageSelector(props: {
  variants: readonly LanguageVariant[];
  currentPath: string;
  buildHref: (path: string) => string;
}): React.ReactElement | null; // null si variants.length < 2
```

W2 consume todo lo anterior: en cada página hace `await connection()`, `const snapshot = await getActiveSnapshot()`, llama a la función de lectura y pasa props a W0/W3. W3 no conoce rutas: recibe `buildHref`.

### 6.4 Contratos de datos y tests de integración

- Los tests de W1 usan `@electric-sql/pglite` con las migraciones reales de `platform/drizzle/` y siembran filas mínimas (patrón de `platform/src/source/store/postgres-store.test.ts`); los tests puros usan el fixture verbatim del README de proyectos que añade W1 (ADR-009: copia + `blob_sha` + manifiesto).
- W4 no inventa fixtures: reutiliza los existentes y, si necesita más, aplica ADR-009 con verificación contra el commit pinneado.
- Ningún test conecta a Supabase (regla de ADR-010); la verificación real la hace W4 con un script de solo lectura fuera del repo.

---

## 7. Preguntas para el usuario (máximo 3)

1. **Subproyectos anidados de `4-devs` en H2.** `source_projects` no tiene fila para los 2 subproyectos (`content/projects/4-devs/ai-eng-incident-manager-for-devs`, `.../ai-eng-inventory-manager-for-devs`), aunque el README de proyectos los lista en "For Devs course" y tienen `learn.json`. Opciones: (a) **recomendada**: en la vista de `4-devs`, derivar en lectura los subproyectos desde `source_files` + el README anidado, sin escribirlos en la base ni reingestar; (b) aplazarlo a H4 (indexado formal, como dice BACKLOG pero sin tocar la ingesta en H2); (c) no mostrarlos en H2 (peor: el enlace del README quedaría fuera de la app). ¿Cuál?
2. **Metadatos de `learn.json`.** Los 83 `learn.json` reales contienen `title`, `description`, `difficulty`, `duration`, `technologies`, `preview`, etc. H2 puede (a) **recomendada** no parsearlos y mostrar solo el README (coherente con "derivar el título del cuerpo es H2" y evita niveles/duraciones sin decisión explícita), o (b) parsearlos y mostrar esos campos literales en la ficha (requiere definir qué campos y persistirlos o parsearlos en lectura). ¿Se quedan para H4?
3. **Servido de assets.** (a) **recomendada**: usar directamente la `binary_reference` pinneada de `raw.githubusercontent.com` que ya está en el store (0 código servidor, URL inmutable, 118/118 verificada); (b) añadir un route handler propio que reenvíe los bytes (mismo-origen, pero más latencia, punto de fallo y consumo de red del servidor, y GitHub puede limitar). ¿Confirmas (a) para H2 y dejamos el proxy como candidato de H4/BACKLOG?

---

## Apéndice A — Comandos y consultas de la auditoría (reproducibles, sin secretos)

- `git status --porcelain`, `git ls-tree -r -z HEAD -- content/` y `git hash-object <archivo>` (local).
- Comparación `content/` vs snapshot: 899 archivos locales vs 899 filas `source_files`; 0 faltantes por lado, 0 discrepancias de `blob_sha`.
- Scripts efímeros fuera del repo (`node` con `platform/node_modules/pg` y `--env-file-if-exists=platform/.env.local`), todos en `BEGIN READ ONLY` con `SET LOCAL statement_timeout`, y borrados al cerrar. Consultas principales:
  - snapshot activo (`source_snapshots` + `source_repositories`);
  - conteos por tabla y por `media_type`/idioma;
  - `source_projects` (84), `source_contexts` (22, 4 con preferido NULL y sus `metadata.contextDocumentPaths`), `source_lessons` (5);
  - `source_files` de `content/projects/README.md` y `README.es.md` (`blob_sha`, longitud, cabecera);
  - 118 `binary_reference` contra el patrón pinneado (118/118);
  - extracción de referencias `](...)`/`![...](...)` con `regexp_matches` y resolución en Node sobre los 899 paths (670 relativas: 652 resueltas, 17 targets de fichero rotos, 1 directorio);
  - frontmatter (`raw_content LIKE '---%'`), HTML embebido y `learn.json`.
- Documentación Next 16 consultada: `01-getting-started/06-fetching-data.md`, `08-caching.md`, `15-route-handlers.md`, `03-api-reference/03-file-conventions/dynamic-routes.md`, `03-api-reference/04-functions/connection.md`.
- No se ejecutaron `pnpm install`, `pnpm build`, `pnpm test`, `pnpm ingest` ni `pnpm db:migrate`; no se escribió en la base; `DATABASE_URL` nunca se imprimió.

## Apéndice B — Inventario de enlaces rotos en la fuente (no "arreglar")

| #   | Documento de origen                                                                         | Target literal                                                             | Resolución real (inexistente)                                                   |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-brasaland.es.md`       | `./CONTEXT-brasaland-pipeline.md`                                          | falta `CONTEXT-brasaland-pipeline.md`                                           |
| 2   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-brasaland.md`          | `./CONTEXT-brasaland-pipeline.es.md`                                       | falta `CONTEXT-brasaland-pipeline.es.md`                                        |
| 3   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-healthcore.es.md`      | `./CONTEXT-healthcore-pipeline.md`                                         | falta                                                                           |
| 4   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-healthcore.md`         | `./CONTEXT-healthcore-pipeline.es.md`                                      | falta                                                                           |
| 5   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-nexova.es.md`          | `./CONTEXT-nexova-pipeline.md`                                             | falta                                                                           |
| 6   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-nexova.md`             | `./CONTEXT-nexova-pipeline.es.md`                                          | falta                                                                           |
| 7   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-trackflow.es.md`       | `./CONTEXT-trackflow-pipeline.md`                                          | falta                                                                           |
| 8   | `content/contexts/06-telemetry-data-pipelines/data-pipelines/CONTEXT-trackflow.md`          | `./CONTEXT-trackflow-pipeline.es.md`                                       | falta                                                                           |
| 9   | `content/contexts/README.es.md`                                                             | `./04-ai-driven-engineering`                                               | el directorio no existe                                                         |
| 10  | `content/contexts/README.es.md`                                                             | `./09-workflows-automation`                                                | el directorio no existe (el real es `09-agentic-workflows`)                     |
| 11  | `content/contexts/README.md`                                                                | `./04-ai-driven-engineering`                                               | ídem                                                                            |
| 12  | `content/contexts/README.md`                                                                | `./09-workflows-automation`                                                | ídem                                                                            |
| 13  | `content/projects/ai-eng-milestone-real-time-agent-observability/.learn/solution/README.md` | `../../ai-eng-milestone-real-time-agent-control/.learn/solution/README.md` | resuelve dentro de la propia carpeta del proyecto (falta un `../`)              |
| 14  | `content/projects/ai-eng-user-authentication-restore/.learn/example/README.es.md`           | `/forgot-password`                                                         | ruta de la app de ejemplo, no path del repo                                     |
| 15  | `content/projects/ai-eng-user-authentication-restore/.learn/example/README.md`              | `/forgot-password`                                                         | ídem                                                                            |
| 16  | `content/projects/company-financial-dashboard-specs-project/.learn/solution/README.md`      | `../README.md`                                                             | resuelve a `.learn/README.md` (no existe; el real está en la raíz del proyecto) |
| 17  | `content/projects/company-financial-dashboard-specs-project/.learn/solution/README.md`      | `../README.md`                                                             | ídem (segunda ocurrencia)                                                       |
| 18  | `content/projects/ai-eng-milestone-real-time-agent-control/.learn/solution/README.md`       | `../../../contexts/10-realtime/agent-observability/`                       | directorio inexistente en esa resolución (falta un `../`)                       |

Además, el README de proyectos contiene 3 enlaces a contextos que **sí existen** (`../contexts/10-realtime/agent-observability`, `../contexts/10-realtime/agent-control`, `../contexts/4-devs`) y que se resolverán como GitHub tree@commit (no hay vista interna de esos directorios en H2). Se contabilizan como resueltos.

---

## Decisiones del usuario (2026-10-02)

1. **Subproyectos anidados de `4-devs`:** opción (a) — se derivan en lectura desde `source_files` (carpeta hija directa de un proyecto de primer nivel que contiene `learn.json`) y se muestran en la vista del proyecto padre y en una ruta propia, sin escribir en la base ni reingestar. Orden: primera aparición en `content/projects/README.md`; los no listados, por `source_path`.
2. **`learn.json`:** opción (a) — no se parsea ni se muestra en H2; queda como material auxiliar para H4.
3. **Assets:** opción (a) — se usa directamente la `binary_reference` pinneada (`raw.githubusercontent.com/<owner>/<name>/<commit>/<path>`); sin route handler ni proxy. El proxy propio queda como candidato de BACKLOG/H4.

Ajustes del coordinador al plan §6 (para maximizar paralelismo sin solapar archivos): W1 también posee el esquema de URLs (`platform/src/course/routes.ts`) y todos los fixtures nuevos; W3 posee además los componentes de presentación compartidos (`document-view`, `unit-list`) y `globals.css`; W0 posee `DECISIONS.md` (ADR-013..017) y `platform/README.md`; la ola 2 se divide en W2a (proyectos, inicio, 404/error) y W2b (contextos y lecciones); la QA final la hacen dos workers de solo lectura (técnica y fidelidad/alcance/seguridad/diseño).
