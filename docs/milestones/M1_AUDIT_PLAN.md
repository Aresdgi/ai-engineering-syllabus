# M1 — Auditoría y Plan Mínimo (Ingestión fiel)

- Hito: **Hito 1 — Ingestión fiel** (`docs/milestones/M1_INGESTION.md`).
- Estado: auditoría **READ-ONLY** + propuesta. No se ha creado ni modificado código ni datos; el único artefacto es este informe.
- Fecha de la auditoría: 2026-10-02.
- Repo fuente auditado: `4GeeksAcademy/ai-engineering-syllabus` (público, no fork, no archivado).
- Commit fuente auditado (HEAD de `main` remoto a fecha de hoy): `962c1e5fc8ebad273abaa348fb3d161568ce8707` (commit date `2026-09-29T10:48:26Z`).
- Documentos leídos completos: `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `REPO_MAP.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `ORCA.md`, `DECISIONS.md` (ADR-001..009), `STATUS.md`, `docs/milestones/M1_INGESTION.md`, `platform/README.md`; además `MILESTONES.md`, `BACKLOG.md`, `platform/src/test/catalog-denylist.ts`, `platform/src/test/source-fixtures.ts`, `platform/src/test/source-fixtures.test.ts`, `platform/src/test/no-hardcoded-catalog.test.ts`, `platform/vitest.config.mts`, `platform/package.json`, `platform/pnpm-workspace.yaml`, `platform/.env.example` y `.github/workflows/platform-ci.yml`.
- Baseline git observado antes de esta auditoría: ` M STATUS.md` (cambio del coordinador); este informe añade únicamente `docs/milestones/M1_AUDIT_PLAN.md`.

Convención de comandos: todos los comandos de app se ejecutan como `npx --yes pnpm@12.8.1 --dir platform <cmd>` (nunca `pnpm install` en la raíz).

---

## 1. AC-1.1 .. AC-1.13: texto literal e interpretación verificable

Texto literal de `docs/milestones/M1_INGESTION.md` (líneas 9-21) e interpretación mínima verificable. "Evidencia" indica el test/comando/artefacto que lo demuestra al implementar M1; entre corchetes, el estado de la medición en esta auditoría.

| AC      | Texto literal                                            | Interpretación verificable                                                                                                                                                                                                                                                                                                                                | Evidencia propuesta                                                                                                                                                                                                                                                                                                                      |
| ------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1.1  | `Configurar repo 4GeeksAcademy/ai-engineering-syllabus.` | Existe configuración única y explícita del repo fuente (owner/name y URL canónica) en `platform/`; no hay rutas alternativas hardcodeadas. `GITHUB_REPO` documentado en `.env.example`.                                                                                                                                                                   | Test unitario: `createSourceConfig({ repo: "4GeeksAcademy/ai-engineering-syllabus" })` valida `owner/name`; `platform/.env.example` documenta `GITHUB_REPO`. [Medido: el repo existe y es público; `platform/.env.example` ya prevé `GITHUB_TOKEN`/`GITHUB_REPO` comentados.]                                                            |
| AC-1.2  | `Resolver default branch/ref.`                           | El reader resuelve el branch por defecto del repo cuando no se pasa `--ref`, y lo registra en el snapshot (`ref`). Fallback explícito a `main` solo si se configura.                                                                                                                                                                                      | Test del reader con `fetch` mockeado: `GET /repos/{owner}/{repo}` → `default_branch`; snapshot guarda `ref`. [Medido: `default_branch = "main"` (`gh api repos/...`).]                                                                                                                                                                   |
| AC-1.3  | `Resolver commit SHA del snapshot.`                      | El snapshot fija un commit SHA inmutable (no un branch móvil). Si se pasa `--ref main`, se resuelve el SHA de `main` en ese momento y se persiste.                                                                                                                                                                                                        | Test: `resolveCommit("main")` devuelve 40 hex; snapshot guarda `commit_sha`; dos resoluciones del mismo commit son iguales. [Medido: `git ls-remote ... refs/heads/main` → `962c1e5fc8ebad273abaa348fb3d161568ce8707`. Método alternativo API: `GET /repos/{owner}/{repo}/commits/main`. Ambos disponibles sin clonar.]                  |
| AC-1.4  | `Leer árbol recursivo.`                                  | Se obtiene el árbol completo del commit con `git/trees/{sha}?recursive=1`, se comprueba `truncated === false` y, si está truncado, la importación falla con error registrado (nunca importa un árbol parcial en silencio).                                                                                                                                | Test: respuesta con `truncated: true` → error tipado `TreeTruncatedError`; importación abortada y registrada. [Medido: `1355` entradas, `truncated=false`, respuesta de `389.777` bytes.]                                                                                                                                                |
| AC-1.5  | `Importar content/projects.`                             | Todo blob bajo `content/projects/` queda representado en `source_files` (texto y binarios), incluidos subdirectorios ocultos `.learn/`. Se registran además índices mínimos en `source_projects` (un registro por carpeta de proyecto), sin calcular orden.                                                                                               | Test con fixture reader: todos los paths del árbol bajo `content/projects/` presentes; conteo reconciliado. [Medido: `625` blobs, `329` directorios, `954` entradas; `84` carpetas de proyecto + `README.md` + `README.es.md` + `learn.json` en la raíz.]                                                                                |
| AC-1.6  | `Importar content/contexts.`                             | Todo blob bajo `content/contexts/` en `source_files`; índices mínimos en `source_contexts` (por contexto y/o carpeta de contexto). Reconocer `CONTEXT-*.md` y su variante `.es.md`.                                                                                                                                                                       | Igual que AC-1.5 sobre `content/contexts/`. [Medido: `264` blobs, `43` directorios, `307` entradas; `208` archivos `CONTEXT-*.md` = `104` pares es/en.]                                                                                                                                                                                  |
| AC-1.7  | `Importar content/lessons.`                              | Todo blob bajo `content/lessons/` en `source_files`; índices mínimos en `source_lessons`. Ojo: las lecciones NO usan `README.md`, usan `<slug>.md` y `<slug>.es.md`.                                                                                                                                                                                      | Igual que AC-1.5 sobre `content/lessons/`. [Medido: `5` carpetas, `10` blobs = `5` pares `.md`/`.es.md`.]                                                                                                                                                                                                                                |
| AC-1.8  | `Guardar path + blob/hash.`                              | Cada `source_files` guarda `path` relativo posix y `blob_sha` SHA-1 git. El `blob_sha` viene del árbol de GitHub y se verifica contra los bytes descargados (`sha1("blob <n>\0"+content)`, ya implementado en `platform/src/test/source-fixtures.ts:59`).                                                                                                 | Test: SHA calculado del contenido == `blob_sha` del árbol; discrepancia → error registrado y snapshot con error. [Medido y validado a tres bandas para un archivo real: `git hash-object` local del tarball == `contents API .sha` == `tree API .sha` == `66fb7d976a012b49d234174d48b2611ada4f5bbc`.]                                    |
| AC-1.9  | `Guardar raw content.`                                   | El texto se guarda íntegro en `raw_content` (UTF-8, sin normalizar, sin resumir). Los binarios van a `binary_reference` con `raw_content = NULL`. Un test de fidelidad re-importa y compara byte a byte contra el fixture.                                                                                                                                | Test: `raw_content` del fixture == bytes del archivo; reingesta no altera. [Medido: `781` archivos textuales (`md/json/csv/html/sql/css/txt/ts/py/js/ipynb`) y `118` binarios (`png/jpg/pdf/.DS_Store`) bajo los tres roots.]                                                                                                            |
| AC-1.10 | `reconocer README.es.md/README.md.`                      | Para cada unidad se prefiere la variante española cuando existe: `README.es.md` sobre `README.md`; `CONTEXT-*.es.md` sobre `CONTEXT-*.md`; `<slug>.es.md` sobre `<slug>.md`. Si solo hay versión original, se usa esa; jamás se traduce ni se rellena. `language` se deriva solo del sufijo `.es.md` (evidencia de path); nunca se infiere del contenido. | Test: selección de `preferred_readme_path` en par completo (prefiere `.es`) y en caso solo-original (usa `.md`, `language` desconocido); sin llamadas de traducción. [Medido: `84/84` proyectos tienen `README.md` y `README.es.md`; `286` archivos `*.es.md` bajo `content/`; no existe ningún proyecto ni contexto raíz sin `.es.md`.] |
| AC-1.11 | `importación idempotente.`                               | Reimportar el mismo commit no duplica ni altera: `snapshots` único por `(repository_id, commit_sha)`; `source_files` único por `(snapshot_id, path)` con upsert. Un commit nuevo crea otro snapshot y no toca el anterior (inmutabilidad de `ARCHITECTURE.md:87-91`).                                                                                     | Test 1: dos ingestas del mismo commit → mismo snapshot, mismos conteos y hashes. Test 2: commit B → nuevo snapshot; filas del snapshot A intactas (comparar `updated_at`/contenido). [El commit auditado es el pin de referencia.]                                                                                                       |
| AC-1.12 | `fixtures de tests obtenidos del repo real.`             | Los fixtures son copias verbatim del upstream en `platform/fixtures/source/<commit>/<path>` + `manifest.json` con `repository`, `commit`, `path`, `blob_sha` (ADR-009). El guard AC-0.10 sigue verde. El alta contrasta `commit`/`path`/`blob_sha` contra upstream.                                                                                       | `pnpm --dir platform test` en verde; `verifySourceFixtures` sin violaciones; `git hash-object` de cada fixture == `blob_sha` del manifiesto == SHA upstream. Candidatos concretos en la sección 8. [No se copia ningún fixture en esta tarea.]                                                                                           |
| AC-1.13 | `registrar errores sin inventar sustitutos.`             | Todo fallo de lectura/decodificación/verificación se registra (`source_import_errors` propuesta: snapshot, path, tipo, mensaje, detalle) y la importación continúa con el resto. Nunca se rellena, resume o sustituye contenido. Estado del snapshot refleja si hubo errores.                                                                             | Test: reader que falla en 1 archivo → 1 fila de error con su path, resto importado, snapshot `complete_with_errors`; ningún archivo sintético en `source_files`.                                                                                                                                                                         |

---

## 2. Restricciones aplicables

### 2.1 Contenido educativo (invariantes)

- `ORCA.md:9-25`: **NO INVENTAR CONTENIDO EDUCATIVO**; si hacen falta pruebas, fixtures del repo real conservando su source path.
- `SOURCE_OF_TRUTH.md`: única fuente `4GeeksAcademy/ai-engineering-syllabus`; toda entidad oficial responde repo + commit + path + hash + modificación; prohibido crear módulos, lecciones, requisitos, rúbricas, secuencia u objetivos.
- `CONTENT_CONTRACT.md`: categorías SOURCE / USER / AI_RESPONSE separadas; `source_files` conserva `source_path`, `source_url`, `source_commit`, `source_hash`, `language`, `raw_content`; prohibido persistir contenido DERIVED como curso; idioma: puede preferirse `README.es.md`/`CONTEXT-*.es.md`; enlaces relativos conservan semántica; reconocer auxiliares (`learn.json`, assets, CSV, JSON, PDFs, contextos) sin asumir estructura idéntica.
- `DECISIONS.md`: ADR-001 (fuente única), ADR-002 (separación dominios), ADR-003 (trazabilidad commit+path+hash), ADR-004 (ingesta antes que LMS), ADR-005 (la IA no persiste contenido oficial), ADR-006 (`platform/` independiente), ADR-008 (guard AC-0.10 fail-closed), ADR-009 (fixtures verbatim verificables).

### 2.2 Alcance: prohibido adelantar hitos

- H2: nada de orden canónico desde `content/projects/README.md`, ni catálogo/UI, ni extracción de títulos para mostrar. En M1 `canonical_order` queda `NULL` y `title` no se deriva del cuerpo (o queda `NULL`); el parseo de presentación llega en H2.
- H3: nada de `user_progress`/notas/bookmarks. H4: nada de `source_relations` ni render de assets. H5: nada de FTS/búsqueda. H6: nada de embeddings/IA. H7: nada de `linked_project_repositories`. H8: nada de evaluación. H9: nada de diff/sincronización incremental.
- `REPO_MAP.md:82-86`: el código descubre el contenido desde GitHub; este informe y sus mediciones **no** son un catálogo hardcodeado. Los conteos de la sección 3 sirven para reconciliación de tests con `--commit` pinneado, no como lista viva.

### 2.3 Entrega y operación

- `ORCA.md:77-86`: verificar build, typecheck, lint, tests y fidelidad antes de cerrar la implementación.
- `ORCA.md:98-100`: ideas fuera de hito → `BACKLOG.md` (sección 9), no se implementan.
- `platform/README.md:46-48`: **nunca** `pnpm install` en la raíz; solo `npx --yes pnpm@12.8.1 --dir platform <cmd>`.
- Archivos intocables de esta tarea: `package.json`/`pnpm-lock.yaml`/`.gitignore`/`README.md` raíz, `opencode.json`, `content/`, `marketing/`, `assets/`, `.cursor/`, `.github/` (salvo ownership explícito). Este informe solo escribe `docs/milestones/M1_AUDIT_PLAN.md`.
- Fixtures: solo copias verbatim (ADR-009); el guard `platform/src/test/no-hardcoded-catalog.test.ts` debe seguir verde.
- Formato: `npx --yes prettier@3.8.3 --write <archivos>`.

---

## 3. Observación real del repositorio fuente (medido, no supuesto)

Todas las mediciones se hicieron el 2026-10-02 con `gh` autenticado (cuenta `Aresdgi`, scopes `repo`) y herramientas locales; solo lecturas GET. Commit auditado: `962c1e5fc8ebad273abaa348fb3d161568ce8707`.

### 3.1 Cabecera del repo

| Dato                        | Valor medido                                                                                          | Comando usado                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Default branch              | `main`                                                                                                | `gh api repos/4GeeksAcademy/ai-engineering-syllabus --jq .default_branch`                               |
| Commit actual de `main`     | `962c1e5fc8ebad273abaa348fb3d161568ce8707` (`2026-09-29T10:48:26Z`)                                   | `gh api repos/.../commits/main --jq .sha,.commit.committer.date` y `git ls-remote ... refs/heads/main`  |
| Público / fork / archivado  | público, no fork, no archivado; sin licencia declarada                                                | `gh api repos/... --jq '{private,fork,archived,license}'`                                               |
| `pushed_at` / `updated_at`  | `2026-09-29T10:48:26Z` / `2026-10-01T09:01:52Z`                                                       | idem                                                                                                    |
| `size` (API, KiB)           | `12248`                                                                                               | idem                                                                                                    |
| Tamaño real del checkout    | `.git` de clone superficial = `8.5M` (`size-pack 8.24 MiB`); working tree total = `23M`               | `git clone --depth 1 --branch main ... shallow && du -sh shallow shallow/.git && git count-objects -vH` |
| Tarball del commit (tar.gz) | `8.584.359` bytes; `1356` miembros en `tar -tzf`                                                      | `curl -sL https://codeload.github.com/.../tar.gz/<sha> -o source.tar.gz && ls -l && tar -tzf \| wc -l`  |
| Zipball del commit          | existe (`HTTP/2 200`, `content-type: application/zip`); tamaño no medido (no se descargó completo)    | `curl -sI https://codeload.github.com/.../zip/<sha>`                                                    |
| Árbol recursivo             | `1355` entradas; `truncated=false`; respuesta JSON de `389.777` bytes; `948` blobs y `407` trees      | `gh api "repos/.../git/trees/<sha>?recursive=1" > tree.json && jq '{truncated,count:(.tree\|length)}'`  |
| Bytes totales en blobs      | `13.158.670` (~12,5 MiB)                                                                              | `jq '[.tree[]\|select(.type=="blob")\|.size]\|add' tree.json`                                           |
| Submódulos (`mode 160000`)  | `0`                                                                                                   | `jq '[.tree[]\|select(.mode=="160000" or .mode=="120000")]'`                                            |
| Symlinks (`mode 120000`)    | `0`                                                                                                   | idem                                                                                                    |
| LFS / `.gitattributes`      | no hay `.gitattributes` en el árbol (0 ocurrencias); blob máximo `438.499` B (< 100 MiB) → no hay LFS | `jq '.tree[]\|select(.path==".gitattributes")'`; máximo de `.size`                                      |
| Modos de archivo            | `100644` × 946 y `100755` × 2 (los 2 ejecutables están fuera de `content/`)                           | `jq '[.tree[]\|select(.type=="blob")\|.mode]\|group_by(.)'`                                             |

### 3.2 Tamaño del árbol por bucket

| Bucket              | Entradas directas                                              | Blobs (recursivo) | Directorios (recursivo) | Entradas totales | Bytes de blobs   | Blob máximo del bucket                      |
| ------------------- | -------------------------------------------------------------- | ----------------- | ----------------------- | ---------------- | ---------------- | ------------------------------------------- |
| `content/projects`  | `87` = `84` dirs + `README.md` + `README.es.md` + `learn.json` | `625`             | `329`                   | `954`            | `10.783.796`     | `438.499` (`.learn/solution/dashboard.png`) |
| `content/contexts`  | `24` = `22` dirs + `README.md` + `README.es.md`                | `264`             | `43`                    | `307`            | `1.573.119`      | `21.545`                                    |
| `content/lessons`   | `5` dirs                                                       | `10`              | `5`                     | `15`             | `95.693`         | `14.357`                                    |
| **Total contenido** | —                                                              | **`899`**         | **`377`**               | **`1276`**       | **`12.452.608`** | `438.499`                                   |

Comandos: `jq -r '.tree[] | select(.type=="blob") | [.path,.size,.sha]|@tsv' tree.json > blobs.tsv` y agrupaciones con `awk`/`jq` sobre `tree.json`; profundidad máxima observada bajo `content/`: `7` niveles.

### 3.3 Tipos de archivo

**Dentro de `content/` (los tres roots):** `md` 666 · `png` 101 · `json` 87 · `pdf` 12 · `csv` 9 · `html` 8 · `sql` 4 · `jpg` 4 · `css` 2 · `txt`, `ts`, `py`, `js`, `ipynb`, `.DS_Store` 1 cada uno. Total `899`.
Textuales (decodificables como UTF-8): `781`; binarios: `118`.
Tamaños máximos por tipo (dentro de `content/`): `png` 438.499 · `jpg` 410.363 · `json` 89.994 (`content/projects/ai-eng-milestone-frontend-development/.learn/mock-data.json`) · `csv` 89.804 (`content/projects/existing-model-sentiment-analysis-reviews/reviews.csv`) · `ipynb` 51.546 · `md` 24.353 (`content/projects/README.es.md`) · `pdf` 4.051.

**Repo completo (referencia):** `md` 693 · `png` 102 · `json` 88 · `pdf` 12 · `csv` 10 · `html` 9 · `py` 7 · `svg` 6 · `sql` 4 · `jpg` 4 · `mdc` 3 · `css` 2 · `yaml`, `txt`, `ts`, `sh`, `js`, `ipynb`, `.gitignore`, `.DS_Store` 1 cada uno.
Comando: `awk -F'\t' '{ n=split($1,a,"."); ext="noext"; if(n>1) ext=tolower(a[n]); cnt[ext]++; ... }' blobs.tsv`.

Observaciones relevantes para el importador:

- Hay un `.DS_Store` **versionado** en upstream: `content/projects/agent-hub-ui-specs-and-prompts/.learn/solution/.DS_Store` (`8196` B, sha `c7e2b5431f47c0e6a0634bfaed70173c576d79f5`).
- Existen directorios ocultos `.learn/` en `content/`: `85` entradas `/.learn` y `351` blobs dentro (md 234, png 94, html 8, jpg 4, sql 2, css 2, y 1 de `txt/ts/py/json/js/ipynb/.DS_Store`). Un importador que ignore dotfiles perdería contenido real.

### 3.4 READMEs, variantes de idioma y `learn.json`

- Proyectos: `84/84` tienen `README.md` **y** `README.es.md` en la raíz del proyecto. No existe proyecto raíz sin español.
- `content/`: `244` archivos `README.md` y `159` `README.es.md` (incluye anidados); `286` archivos `*.es.md` en total (`291` en todo el repo).
- Contextos: `content/contexts/README.md` y `README.es.md` existen en la raíz. De las `22` carpetas de contexto, solo `content/contexts/4-devs/` tiene `README.es.md` (además de `README.md`); las otras 21 solo tienen `README.md`.
- Archivos `CONTEXT-*.md`: `208` = `104` pares `.md` + `.es.md` (todos bilingües).
- Lecciones: no hay `README.md`; cada una usa `<slug>.md` + `<slug>.es.md` (`10` blobs). La carpeta `content/lessons/` no tiene README raíz.
- `learn.json`: `86` en total bajo `content/` = `83` raíces de proyecto + `content/projects/learn.json` (2260 B, sha `260e32fd8f4f97021b1f6f6a549a2818d90a106b`) + `2` anidados en `content/projects/4-devs/`.
- `4-devs` es especial: es el único directorio de proyecto sin `learn.json` raíz y contiene a su vez 2 subdirectorios con `learn.json`.
- Directorios reales con `README.md` **sin** `README.es.md`: los `.learn/solution/` de muchos proyectos (p. ej. `content/projects/ai-eng-milestone-choose-company/.learn/solution/README.md`, 2359 B). Ese es el caso real de "sin español" disponible como fixture; a nivel de proyecto raíz no existe.

### 3.5 Límites de la API medidos

| Escenario                                     | Límite/observación                                                                                                                    | Comando                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sin token (petición directa)                  | `x-ratelimit-limit: 60`/h; `remaining: 54` tras las lecturas                                                                          | `curl -sI https://api.github.com/repos/... \| grep -i x-ratelimit`                   |
| Con token (`gh` autenticado)                  | `X-Ratelimit-Limit: 5000`/h; `remaining: 4929` tras las lecturas                                                                      | `gh api -i repos/... \| grep -i x-ratelimit`                                         |
| `git ls-remote`                               | resuelve `refs/heads/main` sin consumir rate limit de la API                                                                          | `git ls-remote https://github.com/... refs/heads/main`                               |
| `raw.githubusercontent.com` (commit pinneado) | `HTTP 200`, `content-length` real, `cache-control: max-age=300`, `etag`; no consume el rate limit REST                                | `curl -sI https://raw.githubusercontent.com/.../<sha>/<path>`                        |
| `raw` de un `.es.md` inexistente              | `HTTP 404` (no hay fallback implícito)                                                                                                | `curl -s -o /dev/null -w "%{http_code}" .../NO-EXISTE.es.md`                         |
| Blob API                                      | `encoding: base64`; para 4504 B devuelve payload de 6109 chars (~36 % de sobrecarga)                                                  | `gh api repos/.../git/blobs/<sha> --jq '{encoding,size,payload:(.content\|length)}'` |
| Tarball API vs codeload                       | `GET /repos/{owner}/{repo}/tarball/{ref}` cuenta como llamada API y redirige; `codeload.github.com/.../tar.gz/<sha>` es 1 GET sin API | `gh api repos/.../tarball/<sha> -i`                                                  |

---

## 4. Estrategia de acceso a GitHub (comparada) y recomendación

### 4.1 Opciones

| Estrategia                                              | Llamadas y tamaño                                                              | Rate limit                                                                          | Trazabilidad                                                                     | Binarios                                                                   | Robustez / coste                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A. REST `git/trees?recursive=1` + `git/blobs/{sha}`** | `1` tree (`389.777` B medidos) + `1` por blob (`899` en contenido; `948` repo) | Sin token imposible (`60/h`); con token `5000/h` (cabe, pero 1 sync ≈ 900 llamadas) | Máxima: `blob_sha`, `mode`, `size` de upstream antes de descargar                | Se puede omitir la descarga de binarios; el blob se descarga si hace falta | Requiere token en la práctica; más puntos de fallo; sobrecarga base64 ~36 % medida                                                 |
| **B. Tarball/zipball por commit SHA (`codeload`)**      | `1` GET, `8.584.359` B medidos (`1356` miembros)                               | No consume API; sin token                                                           | Commit pinneado en la URL; SHA de blob calculable localmente (content-addressed) | Descarga todo, incluidos binarios (118 archivos, 6,9 MB)                   | Muy simple y determinista; sin metadatos por entrada (se calculan local); **validado**: hash local == `contents API` == `tree API` |
| **C. `git clone --depth 1`**                            | `.git` `8.5M` (`size-pack 8.24 MiB`), working tree `23M`                       | No consume API; `git ls-remote` para refs                                           | Excelente: `git ls-tree -r`, `git cat-file`, blob SHAs locales                   | Eficiente (`cat-file`)                                                     | Requiere binario `git` y `child_process` (no garantizado en Vercel/serverless); sync como job local/CI; muy testeable              |
| **D. `raw.githubusercontent.com` por archivo**          | `1` GET por archivo (`899`) + `1` llamada tree para enumerar                   | No consume API; sin token; cache 300 s                                              | Commit + path en URL; blob SHA solo si se calcula local                          | Bytes directos; 404 explícito medido                                       | 899 round-trips y 899 oportunidades de fallo; reanudable; útil como fallback/reintento                                             |

### 4.2 Recomendación

**Estrategia híbrida B + A:**

1. Resolver repo/branch/commit con `git ls-remote` (sin rate limit) o con `GET /repos/{owner}/{repo}` + `GET .../commits/{ref}` (2 llamadas API) si se quiere `pushed_at`/fecha de commit. Token **opcional** para M1 (repo público), recomendado si se usa la vía API o en CI.
2. **Descargar el tarball del commit pinneado** (`https://codeload.github.com/4GeeksAcademy/ai-engineering-syllabus/tar.gz/<commit_sha>`) como fuente de contenido: 1 petición, 8,2 MB, sin token, todo el corpus incluido binarios.
3. **Una llamada a `git/trees/<commit_sha>?recursive=1`** como inventario autoritativo: `path`, `blob_sha`, `size`, `mode` y `truncated`. Sirve para (a) detectar truncamiento y fallar cerrado, (b) clasificar texto/binario antes de decodificar, y (c) **verificar** el `blob_sha` calculado localmente con el `computeGitBlobSha` ya existente (`platform/src/test/source-fixtures.ts:59`).
4. Fallback D (`raw`) solo para reintentos de archivos individuales; `git clone` (C) como herramienta de desarrollo/verificación, no como reader de producción.

Justificación: una sola dependencia de red para el contenido (`8.2 MB`), conteo de llamadas mínimo, `blob_sha` contrastable con upstream aunque el tarball no traiga SHAs (content-addressing), binarios sin sobrecarga base64, y sin `git` en runtime (funciona en cualquier entorno Node con `fetch` + `zlib`/`tar`). La llamada al árbol hace que la verificación no dependa solo del tarball y que un árbol truncado no pase silenciosamente.

### 4.3 Token: necesidad y configuración

- No es imprescindible para M1 con B+A (`ls-remote` + codeload + 1 tree call caben en `60/h` sin token). **Sí es recomendable** si se elige A puro, si la sincronización corre en CI con frecuencia, o si en M9 se añade incrementalidad.
- `platform/.env.example` ya prevé, comentadas, `GITHUB_TOKEN=` y `GITHUB_REPO=4GeeksAcademy/ai-engineering-syllabus` (líneas 8-10). Al implementar: descomentar/documentar como opcionales, cargar solo en servidor/CLI (`process.env.GITHUB_TOKEN`, nunca `NEXT_PUBLIC_*`), y usar `.env.local` (ignorado) para el valor real. El token debe ser de solo lectura (`public_repo` basta; no usar `repo` completo si no es necesario).
- Nunca registrar el token en logs ni en mensajes de error de `source_import_errors`.

---

## 5. Persistencia — comparación y recomendación (DECISIÓN PENDIENTE DE APROBACIÓN DEL USUARIO)

### 5.1 Requisitos medidos en esta máquina (2026-10-02)

| Comprobación                                          | Resultado                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `command -v docker`                                   | **NO instalado**                                            |
| `command -v psql` / `pg_isready`                      | **NO instalados**                                           |
| `command -v sqlite3`                                  | `/usr/bin/sqlite3`, versión `3.51.0` (CLI del sistema)      |
| `brew list --formula` (postgres/docker/colima/libsql) | **ninguno instalado**                                       |
| `brew`                                                | disponible (`/opt/homebrew/bin/brew`)                       |
| Node                                                  | `v26.10.0`                                                  |
| Espacio libre en disco                                | `366Gi`                                                     |
| Vercel / CLI de despliegue                            | no instalado; despliegue previsto por `platform/` (ADR-006) |

### 5.2 Opciones comparadas

| Criterio                   | (a) PostgreSQL gestionado (Supabase)                                                  | (b) PostgreSQL local                                                                                   | (c) SQLite local (`better-sqlite3`/`libsql`)                                                                                                                                               | (d) JSON versionado por snapshot                               |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Requisitos en esta máquina | ninguno local; cuenta/proyecto Supabase + `DATABASE_URL`                              | `brew install postgresql@17` + `brew services start` (hoy: nada instalado; sin Docker no hay otra vía) | paquete npm nativo: `better-sqlite3` (prebuilds en Node 26 **no verificados**) o `@libsql/client`; si exige build, tocar `platform/pnpm-workspace.yaml` (`allowBuilds`, hoy todo denegado) | ninguno; solo `node:fs`                                        |
| Coste                      | free tier (500 MB) suficiente para 12,5 MB de corpus; gestión/red a cargo de Supabase | gratis; mantenimiento local propio                                                                     | gratis                                                                                                                                                                                     | gratis                                                         |
| Despliegue futuro (Vercel) | directo (Postgres remoto); integración Supabase/Vercel                                | exige migrar a gestionado (o túnel)                                                                    | **no viable** en serverless con archivo local; requeriría Turso/libSQL remoto o migrar                                                                                                     | no viable como store servible; podría ser artefacto de lectura |
| Migraciones / ORM          | Drizzle (TS-first, dialecto pg) o Prisma; SQL plano posible                           | idéntico a (a)                                                                                         | Drizzle SQLite o SQL plano; el esquema no es portable 1:1 a pg                                                                                                                             | sin esquema; validación a mano (zod)                           |
| Testabilidad               | tests unitarios con store fake; integración requiere red o CI con servicio            | integración local directa; CI = servicio `postgres` en GitHub Actions                                  | integración local trivial (archivo temporal), **si** el binding nativo funciona                                                                                                            | integración trivial; sin concurrencia ni constraints reales    |
| Encaje con `DATA_MODEL.md` | `jsonb`, unique compuestos, FKs, estados, RLS: encaje total                           | idéntico                                                                                               | `jsonb` → TEXT JSON; unique/FK/transacciones sí; menos tipos                                                                                                                               | no implementa el modelo; habría que simularlo                  |
| Hito 3 (estado usuario)    | auth + RLS/Supabase; escalable                                                        | igual, sin auth gestionada                                                                             | válido en un solo proceso; sin multi-instancia                                                                                                                                             | no apto                                                        |
| Hito 5 (búsqueda)          | `tsvector`/`pg_trgm` nativos                                                          | igual                                                                                                  | FTS5 nativo                                                                                                                                                                                | no apto (habría que construir índice aparte)                   |
| Hito 6 (embeddings/RAG)    | `pgvector` en Supabase/pg                                                             | `pgvector` instalable                                                                                  | `sqlite-vec` (ecosistema más inmaduro); libSQL remote                                                                                                                                      | no apto                                                        |

### 5.3 Recomendación (marcada como pendiente de aprobación)

**Recomendación: (a) PostgreSQL gestionado (Supabase) con Drizzle ORM, pendiente de aprobación explícita del usuario.**

Argumentos: es la dirección de `ARCHITECTURE.md:47-56`; encaja sin fricción con `DATA_MODEL.md` (`jsonb`, unique `snapshot_id+path`); es el único camino que cubre a la vez Vercel (H2), estado de usuario (H3), búsqueda (H5) y `pgvector` (H6) sin migración de motor; y no exige instalar nada en esta máquina, que carece de Docker y `psql`. La ausencia de Postgres local se compensa con la instancia gestionada (rama/DB de desarrollo) y con tests de integración en CI mediante el servicio `postgres` de GitHub Actions.

Condiciones y salvaguardas:

- **Gate de decisión**: el worker que implemente `store/` no empieza hasta que el usuario apruebe la opción y quede registrada como ADR. Sin decisión, M1 puede avanzar en dominio/reader/fixtures con un `SourceStore` en memoria.
- Los tests unitarios **no** deben depender de la nube: `SourceStore` como interfaz + implementación en memoria (o SQLite temporal si el usuario prefiere local). La verificación contra Supabase queda como test de integración opcional (`DATABASE_URL` presente) y/o en CI con `postgres:17`.
- Alternativas: (b) si el usuario prioriza offline total, `brew install postgresql@17` y el mismo esquema Drizzle (migrar después a Supabase/Neon es mecánico); (c) si el usuario quiere el bootstrap más rápido para M1 a sabiendas del coste de migración, SQLite con Drizzle, requiriendo añadir `better-sqlite3` a `allowBuilds` y aceptando que no se despliega en Vercel; (d) JSON solo como export/artefacto de verificación, nunca como store primario.
- Coste/plan de Supabase: el free tier es suficiente hoy; si el proyecto crece, el coste escala con la DB y no con el corpus (12,5 MB). No se contrata nada en esta tarea.

---

## 6. Modelo de datos M1

### 6.1 Entidades que entran en M1

| Entidad                                       | Uso M1                                                    | Campos mínimos y reglas                                                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_repositories`                         | 1 fila: `4GeeksAcademy/ai-engineering-syllabus`           | `owner`, `name`, `canonical_url`, `default_branch` (`main`)                                                                                                                                                          |
| `source_snapshots`                            | 1 fila por importación de un commit                       | `repository_id`, `ref`, `commit_sha`, `imported_at`, `status`. **Único `(repository_id, commit_sha)`** (base de AC-1.11). Estados propuestos: `importing` → `complete` / `complete_with_errors` / `failed`           |
| `source_files`                                | Todos los blobs de los tres roots (`899` medidos)         | `snapshot_id`, `path`, `blob_sha`, `language`, `media_type`, `raw_content` (texto) o `binary_reference` (binario). **Único `(snapshot_id, path)`**. `path` posix relativo                                            |
| `source_projects`                             | índice mínimo: `84` carpetas de proyecto de primer nivel  | `snapshot_id`, `source_path`, `preferred_readme_path`, `language`, `metadata jsonb` (`blob_sha` de READMEs, `learn.json` presente, flags). `canonical_order = NULL` (H2). `title = NULL` en M1 (no se deriva cuerpo) |
| `source_contexts`                             | índice mínimo: `22` carpetas de contexto + contextos raíz | `source_path`, `title NULL`, `language`, `metadata jsonb` (`CONTEXT-*` detectados, `README` preferido)                                                                                                               |
| `source_lessons`                              | índice mínimo: `5` carpetas de lección                    | `source_path`, `title NULL`, `language`, `metadata jsonb` (`<slug>.md`/`.es.md` detectados)                                                                                                                          |
| `source_import_errors` **(nueva, propuesta)** | AC-1.13                                                   | `snapshot_id`, `source_path nullable`, `error_kind`, `message`, `detail jsonb`, `created_at`. No existe en `DATA_MODEL.md` → conflicto declarado en la sección 9; requiere ADR                                       |

Qué **no** entra en M1: `source_relations` (H4), `user_progress`/`user_notes`/`user_bookmarks`/`linked_project_repositories` (H3/H7), `ai_threads`/`ai_messages` (H6). Tampoco búsqueda ni embeddings.

### 6.2 Reglas de datos

- **Idempotencia (AC-1.11)**: si al resolver el commit ya existe un snapshot `complete`/`complete_with_errors` para ese `commit_sha`, la ingesta es un no-op (devuelve el snapshot existente). No hay `UPDATE` de filas de otro snapshot ni `DELETE`: commit nuevo → snapshot nuevo; el anterior queda intacto (`ARCHITECTURE.md "Inmutabilidad"`).
- **Unicidad de archivo**: `UNIQUE(snapshot_id, path)`; reimportar el mismo snapshot hace `upsert` solo si el `blob_sha` difiere (no debería en un mismo commit).
- **Binarios vs `raw_content`**: exactamente uno de los dos no nulo (`CHECK`). Textuales → `raw_content` (UTF-8 íntegro); binarios (`png/jpg/pdf` y el `.DS_Store` versionado) → `binary_reference = https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/<commit_sha>/<path>` (URL pinneada, no rama). No se guarda base64.
- **Idioma (AC-1.10) sin inventar**: `language = 'es'` **solo** con evidencia de sufijo `.es.md`; en cualquier otro caso `NULL` (o `'und'`, a decidir por el usuario). Nunca se infiere por contenido ni se traduce. `preferred_readme_path`: `README.es.md` si existe, si no `README.md`; lecciones `<slug>.es.md` si existe, si no `<slug>.md`; contextos análogo con `CONTEXT-*`.
- **Errores (AC-1.13)**: un fallo por archivo no aborta la importación; se inserta fila en `source_import_errors` y el snapshot termina `complete_with_errors`. Un fallo global (árbol truncado, tarball corrupto, commit irresoluble) termina `failed` con error registrado. Nunca se crea contenido sustituto.
- **Trazabilidad**: cada fila SOURCE puede responder repo, commit, path y blob/hash (`SOURCE_OF_TRUTH.md:19-26` y `ORCA.md:44-50`).

---

## 7. Arquitectura de código

### 7.1 Capas (bajo `platform/src/source/`, separadas de `course/`, `user/`, `ai/`)

```text
platform/src/source/
├── types.ts                 # SourceReader, SourceStore, TreeEntry, Snapshot, ImportError…
├── github/
│   ├── reader.ts            # GithubSourceReader (fetch): resolveRepo/commit/tree/tarball/raw
│   └── errors.ts            # TreeTruncatedError, BlobMissingError, HttpErrorPolicy…
├── classify/
│   ├── paths.ts             # bucket (project/context/lesson/aux), preferred README, language por sufijo
│   └── media.ts             # extensión → media_type; texto vs binario (sniff sin reescribir)
├── validate/
│   ├── snapshot.ts          # verifica blob_sha local vs árbol, cobertura de paths, truncated=false
│   └── fixtures.ts          # (reutiliza) verificación ADR-009 en tests
├── store/
│   ├── store.ts             # interfaz SourceStore
│   └── <impl>.ts            # implementación elegida (gate sección 5)
├── ingest/
│   └── ingest.ts            # orquestador: resolve → tree → snapshot → archivos → errores → finalize
└── cli.ts                   # `pnpm ingest [--repo] [--ref] [--commit] [--dry-run] [--json]`
```

Reglas: `source/` no importa `course/`, `user/` ni `ai/` (y viceversa; `course/` solo leerá filas SOURCE en H2). No se añade UI en M1. `ai/` no existe aún.

### 7.2 Disparo de la importación en M1

**Recomendado: script CLI `pnpm ingest`, sin UI.** Se ejecuta con `npx --yes pnpm@12.8.1 --dir platform ingest [flags]`. Motivos: M1 es ingesta, no producto (ADR-004); un CLI es trivial de testear y de correr en local/CI; H2 decidirá cómo exponer el estado en la UI. Flags no interactivos: `--repo`, `--ref main` (default), `--commit <sha>` (pin exacto), `--dry-run` (resuelve y valida sin persistir), `--json` (resumen con conteos para reconciliación). Códigos de salida: `0` completo, `1` completo con errores registrados, `2` fallo global.

Nota de implementación: Next 16 + TypeScript no ejecuta un CLI TS sin ayuda. Opciones: añadir `tsx` como devDependency (recomendado, una sola dependencia, la añade el owner de `package.json`) o usar el type-stripping nativo de Node 26 (`node --experimental-strip-types`), teniendo en cuenta que exige extensiones explícitas en imports y no soporta alias. Decisión menor para el owner de dependencias.

### 7.3 Interfaces inyectables (testabilidad sin red, ADR-009)

```ts
export type TreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
  mode: string;
  sha: string;
  size?: number;
};

export interface SourceReader {
  resolveRepository(): Promise<{
    owner: string;
    name: string;
    canonicalUrl: string;
    defaultBranch: string;
  }>;
  resolveCommit(ref: string): Promise<{ sha: string; committedAt?: string }>;
  getTree(
    commitSha: string,
  ): Promise<{ truncated: boolean; entries: TreeEntry[] }>;
  getTarball(
    commitSha: string,
  ): Promise<AsyncIterable<{ path: string; bytes: Uint8Array }>>;
}

export interface SourceStore {
  upsertRepository(repo: {
    owner: string;
    name: string;
    canonicalUrl: string;
    defaultBranch: string;
  }): Promise<string>;
  findSnapshot(
    repositoryId: string,
    commitSha: string,
  ): Promise<{ id: string; status: string } | null>;
  createSnapshot(
    repositoryId: string,
    ref: string,
    commitSha: string,
  ): Promise<string>;
  upsertFiles(
    snapshotId: string,
    files: SourceFileRecord[],
  ): Promise<{ inserted: number; updated: number }>;
  recordImportError(
    snapshotId: string,
    error: ImportErrorRecord,
  ): Promise<void>;
  finalizeSnapshot(snapshotId: string, status: SnapshotStatus): Promise<void>;
}
```

Tests: `FixtureSourceReader` lee `platform/fixtures/source/<commit>/...` + manifiesto (mismo shape que el reader real) y `InMemorySourceStore` permite probar orquestación, idempotencia y AC-1.13 sin red ni DB.

---

## 8. Fixtures (AC-1.12)

Candidatos reales, todos del commit `962c1e5fc8ebad273abaa348fb3d161568ce8707` (medidos con `tree.json`; el `sha` del árbol es el `blob_sha` git). **No se copian en esta tarea**; el worker de fixtures los descarga verbatim y los declara en `manifest.json`.

| Rol en los tests                  | Path en el repo fuente                                                                         | Tamaño | `blob_sha`                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| README de proyecto (inglés)       | `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.md`                   | 4504   | `66fb7d976a012b49d234174d48b2611ada4f5bbc` |
| README de proyecto (español, par) | `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.es.md`                | 4753   | `3756e6cc5718e385ed7330732a902ec4ee20c8f2` |
| `learn.json` de proyecto          | `content/projects/data-modeling-and-class-diagrams-digital-wallet/learn.json`                  | 1362   | `1c008a23ca3fec63b097ea13f0e80671474b433c` |
| `CONTEXT-*` (inglés)              | `content/contexts/audit-log/CONTEXT-trackflow.md`                                              | 1524   | `eff7fdb7a5d9947666279b55ba72bc9ce983b4aa` |
| `CONTEXT-*` (español, par)        | `content/contexts/audit-log/CONTEXT-trackflow.es.md`                                           | 1710   | `110af327664f620914a48c509e7c5102ea7a0c0a` |
| Lección (inglés)                  | `content/lessons/4geeks-student-extension/4geeks-student-extension.md`                         | 6221   | `e27610ccc3459e8b636af9ff9e905c62e39585dd` |
| Lección (español, par)            | `content/lessons/4geeks-student-extension/4geeks-student-extension.es.md`                      | 6652   | `41313f085f5f4a7bba5bb2e5803151bdf8137fe4` |
| Binario pequeño (PDF)             | `content/contexts/09-agentic-workflows/rfp-requests/trackflow/CONTEXT-trackflow-request-3.pdf` | 1924   | `3465abb3d19ac49793b06e806db5c66738feeec3` |
| Binario pequeño (PNG)             | `content/projects/ai-eng-error-handling/.learn/preview.png`                                    | 20501  | `7645687bcbde8522dc1a10b44380da92bf32ecfd` |
| Caso real sin `README.es.md`      | `content/projects/ai-eng-milestone-choose-company/.learn/solution/README.md`                   | 2359   | `49083ff748b6134f970dd635462fc7f57f032a0e` |

Notas:

- No existe ningún proyecto/contexto raíz sin `.es.md` (medido), así que el caso "sin español" debe ser el path anidado de `.learn/solution/` o un fixture de lector simulado, nunca un archivo inventado.
- El caso `4-devs` (proyecto sin `learn.json` raíz + subproyectos anidados) es un buen fixture estructural; puede representarse con un lector simulado que apunte a esos paths reales.
- Para AC-1.11 "commit nuevo", los tests deben usar el **lector simulado** (mismo contenido real bajo un commit ficticio) o dos commits reales históricos, nunca duplicar contenido bajo un commit inventado en `fixtures/source/` (ADR-009 exige que `commit` corresponda al upstream al dar de alta).
- Contraste al dar de alta cada fixture (protocolo obligatorio; hoy es backlog ADR-009):

```sh
# 1) SHA del árbol (inventario autoritativo)
gh api "repos/4GeeksAcademy/ai-engineering-syllabus/git/trees/962c1e5fc8ebad273abaa348fb3d161568ce8707?recursive=1" \
  --jq '.tree[] | select(.path=="<PATH>") | {path, sha, size}'
# 2) SHA vía contents API (mismo commit)
gh api "repos/4GeeksAcademy/ai-engineering-syllabus/contents/<PATH>?ref=962c1e5fc8ebad273abaa348fb3d161568ce8707" --jq .sha
# 3) SHA del fixture copiado (debe coincidir con 1 y 2)
git hash-object "platform/fixtures/source/962c1e5fc8ebad273abaa348fb3d161568ce8707/<PATH>"
```

Automatizar 1-3 (script de alta del backlog) elimina el único punto de confianza manual de ADR-009.

---

## 9. Riesgos, conflictos y ambigüedades

| #   | Riesgo / conflicto / ambigüedad                                                                                                                                           | Propuesta de resolución                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `DATA_MODEL.md` no define una tabla de errores de importación, necesaria para AC-1.13.                                                                                    | Añadir `source_import_errors` (sección 6.1) vía ADR al implementar; no editar `DATA_MODEL.md` en esta tarea.                                                                     |
| 2   | `DATA_MODEL.md` define `language` para `source_files/contexts/lessons` sin semántica de "desconocido".                                                                    | `'es'` solo con sufijo `.es.md`; resto `NULL` (o `'und'`, a decidir por el usuario). Prohibido inferir del contenido.                                                            |
| 3   | AC-1.11 no dice si reimportar el mismo commit crea un snapshot nuevo.                                                                                                     | No-op: devolver el snapshot existente; `UNIQUE(repository_id, commit_sha)`. Documentarlo en el código y en el ADR de persistencia.                                               |
| 4   | `source_projects.canonical_order` y `title` podrían tentar a parsear `content/projects/README.md` en M1 (H2 prohibido).                                                   | M1 guarda `canonical_order = NULL` y `title = NULL`; el orden y los títulos son H2.                                                                                              |
| 5   | `4-devs` contiene subdirectorios que parecen proyectos y no tiene `learn.json` raíz; `content/projects/learn.json` es un archivo raíz que no pertenece a ningún proyecto. | `source_projects` en M1 indexa solo carpetas de primer nivel (`84`); los anidados quedan en `source_files`; `content/projects/learn.json` se trata como auxiliar. Revisar en H2. |
| 6   | `.learn/` (oculto) contiene soluciones y binarios; ignorar dotfiles perdería contenido (`351` blobs).                                                                     | El reader no filtra dotfiles: todo blob bajo los tres roots entra. La política de visibilidad (¿mostrar soluciones?) es H2.                                                      |
| 7   | `.DS_Store` versionado en upstream (`agent-hub-ui-specs-and-prompts/.learn/solution/.DS_Store`).                                                                          | Importarlo como binario con su `blob_sha`; no borrarlo ni "limpiarlo" (fidelidad). Clasificarlo como auxiliar, no como contenido de proyecto.                                    |
| 8   | El tarball no expone `blob_sha` por archivo; solo el árbol lo da.                                                                                                         | Usar siempre el árbol como inventario autoritativo y verificar el hash local; el tarball es el transporte. Si se quiere aún más robustez, modo `--via=blobs` (A) opcional.       |
| 9   | Árbol truncado en repos grandes (límite documentado: 100.000 entradas / 7 MB con `recursive=1`).                                                                          | Comprobar `truncated`; si es `true`, fallar y registrar (o recorrer subárboles no recursivos). Hoy medido `false` con 1355 entradas.                                             |
| 10  | Sin token, la vía API pura es inviable (60/h).                                                                                                                            | Recomendación B+A sin token; si se usa API intensiva, `GITHUB_TOKEN` solo en servidor/CI. Ver sección 4.                                                                         |
| 11  | `platform/pnpm-workspace.yaml` deniega todos los build scripts (`allowBuilds: sharp:false, unrs-resolver:false`).                                                         | Si el usuario elige SQLite nativo (`better-sqlite3`), hay que añadir su allowlist → cambio sensible que solo toca el worker dueño de dependencias, tras aprobación.              |
| 12  | Node 26 y bindings nativos (`better-sqlite3`) sin prebuilds verificados.                                                                                                  | No elegir esa vía sin probar; por eso la recomendación es Postgres gestionado (sección 5).                                                                                       |
| 13  | Deriva upstream: el commit auditado cambió después (el repo se actualizó el 2026-10-01).                                                                                  | Fijar `962c1e5…` para fixtures y reconciliación; H9 tratará la sincronización. En CI de M1, fijar `--ref`/`--commit` para determinismo.                                          |
| 14  | `CONTENT_CONTRACT.md` manda reconocer assets/PDF/CSV, pero renderizarlos es H4.                                                                                           | M1 importa metadatos+contenido de todos los archivos de los tres roots; el render y `source_relations` son H4.                                                                   |
| 15  | Lecciones no usan `README.md`, usan `<slug>.md` (los tests no deben asumir README universal, como advierte `CONTENT_CONTRACT.md:101`).                                    | El clasificador de `preferred_readme_path` cubre ambos convenios y lo testea.                                                                                                    |

Candidatas a `BACKLOG.md` (no se edita en esta tarea): ADR de `source_import_errors`; script de alta automática de fixtures con contraste upstream; semántica de `language`; caché ETag/conditional requests para syncs; decisión de store como ADR; política de visibilidad de `.learn/` (H2); almacenar bytes de binarios vs solo referencia (H4); `tsx` vs type-stripping nativo; zipball como alternativa al tarball; reconciliación de conteos como test de contrato con commit pinneado.

---

## 10. Plan de implementación, partición en workers y QA

### 10.1 Pasos

1. **Gate de decisión (usuario)**: aprobar persistencia (sección 5) y semántica de `language`. Sin esto, solo avanza la Fase 1.
2. **Fase 1 — cimientos sin red ni DB** (paralelo):
   - tipos y utilidades puras (`types.ts`, `classify/`, `validate/`);
   - `GithubSourceReader` con `fetch` (tarball + árbol) y tests con `fetch` mockeado;
   - fixtures reales de la sección 8 + `manifest.json` + contraste de SHAs.
3. **Fase 2 — store** (tras el gate): implementación del `SourceStore` elegido, migraciones y una integración mínima; el resto de tests usan `InMemorySourceStore`.
4. **Fase 3 — orquestador + CLI**: `pnpm ingest` con `--dry-run`/`--json`, errores AC-1.13, idempotencia AC-1.11.
5. **Fase 4 — QA**: tests AC por AC (sección 1), reconciliación de conteos contra el commit pinneado, gate completo (prettier, lint, typecheck, test, build) y smoke real opcional.
6. **Cierre de hito** (fuera de esta tarea): marcar AC en `M1_INGESTION.md`, actualizar `STATUS.md`, `DECISIONS.md` (ADRs) y `BACKLOG.md` según `ORCA.md:88-96`.

### 10.2 Partición en workers (ownership disjunto, máximo paralelismo)

| Worker                        | Archivos que posee (exclusivo)                                                                                                                                                                                             | Depende de                             | Puede empezar                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| **W1 — dominio + fixtures**   | `platform/src/source/types.ts`, `classify/**`, `validate/**`, `platform/fixtures/**`, tests `platform/src/source/{classify,validate}*.test.ts`                                                                             | nada                                   | ya (inmediato)                            |
| **W2 — reader GitHub**        | `platform/src/source/github/**`, tests `platform/src/source/github/*.test.ts`                                                                                                                                              | tipos congelados de W1                 | tras el commit de `types.ts` de W1        |
| **W3 — store + dependencias** | `platform/src/source/store/**`, migraciones, **único dueño de** `platform/package.json`, `platform/pnpm-lock.yaml`, `platform/pnpm-workspace.yaml`, `platform/.env.example`, y del bloque de env en docs de implementación | decisión del usuario (gate) + tipos W1 | tras el gate; el resto de W1/W2 no espera |
| **W4 — ingesta + CLI**        | `platform/src/source/ingest/**`, `platform/src/source/cli.ts`, test de integración `platform/src/test/m1-ingest*.test.ts`                                                                                                  | W1 + W2 + W3                           | Fase 3                                    |
| **W5 — QA (verificador)**     | no escribe código de producción; puede poseer `docs/milestones/M1_QA_*.md` (tarea futura)                                                                                                                                  | todo lo anterior                       | Fase 4                                    |

Reglas de convivencia:

- **Un solo escritor de `package.json`/lockfile/`pnpm-workspace.yaml`/`.env.example`: W3.** W1/W2 usan solo `node:fs`, `fetch`, `zlib`/`tar` o `node:stream` (sin dependencias nuevas) para no tocar el lockfile. W4 pide a W3 el script `"ingest"` en `package.json`.
- `platform/src/test/catalog-denylist.ts` y `source-fixtures.ts` son compartidos pero estables: si un worker necesita cambiarlos, lo hace W1 (dueño de `validate/` y fixtures) y avisa.
- El guard AC-0.10 se mantiene verde en cada PR: los fixtures nuevos se declaran en el manifiesto con `blob_sha` verificado.
- DAG real: `W1(tipos)` → `W2`; `W1+gateUsuario` → `W3`; `W1+W2+W3` → `W4`; `W4` → `W5`. W1 (fixtures) es independiente y no bloquea a nadie.
- Formato obligatorio antes de cada entrega: `npx --yes prettier@3.8.3 --write <archivos del worker>`.

### 10.3 Plan de QA

1. **Unitarios puros (node, sin red)**: clasificación de buckets (project/context/lesson/aux), `preferred_readme_path` (par es/en, solo original, lección `<slug>.md`, `CONTEXT-*`), `language` por sufijo, `media_type` texto/binario, `computeGitBlobSha` vs `git hash-object` de fixtures.
2. **Reader con `fetch` mockeado**: resolución de repo/commit, `truncated=true` → error, 404 de raw → error registrado, tarball con entradas corruptas.
3. **Integración con fixtures (sin red)**: `FixtureSourceReader` + `InMemorySourceStore` → snapshot, `source_files` con `blob_sha` correcto, índices mínimos, idempotencia (dos ejecuciones → mismos conteos), commit nuevo → snapshot nuevo sin tocar el anterior, AC-1.13 con un fallo inyectado.
4. **Integración de store (una vez decidido)**: mismo test 3 contra el store real (SQLite temporal o `postgres:17` en CI); opcional contra Supabase con `DATABASE_URL`.
5. **Smoke real (manual/opcional, no en CI por defecto)**: `pnpm ingest --commit 962c1e5… --dry-run --json` y comparar conteos con la sección 3 (`625/264/10` blobs, `899` total, `781` textuales, `118` binarios). En CI, commit pinneado para evitar fragilidad.
6. **Gate de cierre**: `pnpm --dir platform lint && typecheck && test && build` + `npx --yes prettier@3.8.3 --check` + guard AC-0.10 verde + `git status --porcelain` acotado a los archivos del worker.
7. **Definition of Done de M1**: los 13 AC con evidencia (tabla de la sección 1), cero contenido inventado, cero cambios fuera del scope, `pnpm ingest` reproducible, e informe QA que enlace los comandos ejecutados.

---

## 11. Desviaciones de la implementación respecto al plan

Sección añadida al cierre para corregir F-04 de
`docs/milestones/M1_QA_FIDELITY.md`. Cada fila contrasta las secciones §5-§10
anteriores con el código real de `platform/src/source/**`,
`platform/drizzle/**` y `platform/fixtures/**`. Ninguna desviación altera los
invariantes de M1 (fidelidad, inmutabilidad, idempotencia, alcance sin H2+):
son decisiones de diseño o de herramientas, no cambios de contrato.

| #   | Plan (sección)                                                                   | Implementado (código real)                                                                                                                            | Justificación                                                                                                                                |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SourceReader.resolveRepository()` / `getTarball()` (§7.3)                       | `getRepository()` / `readFile()` (`types.ts`, interfaz `SourceReader`)                                                                                | Nombres más precisos: el lector abstrae tarball y fallback `raw` por archivo; sin impacto funcional.                                         |
| 2   | `SourceStore` con `findSnapshot`, `recordImportError`, `finalizeSnapshot` (§7.3) | `findSnapshotByCommit`, `insertImportErrors` (lote), `setSnapshotStatus` + `upsert{Projects,Contexts,Lessons}` (`types.ts`, interfaz `SourceStore`)   | Un upsert por tabla y errores por lote; el contrato de idempotencia (`UNIQUE` por commit/path) es el mismo.                                  |
| 3   | `InMemorySourceStore` para tests (§7.3, §10.2)                                   | `PostgresSourceStore` sobre PGlite en memoria con las migraciones de `platform/drizzle/` (`postgres-store.test.ts`)                                   | Prueba el SQL real (UNIQUE/CHECK/FK/RLS) sin nube; mejor cobertura que un fake en memoria.                                                   |
| 4   | `validate/fixtures.ts` dedicado (§7.1)                                           | `platform/src/source/fixtures/` (`git-blob.ts`, `manifest.ts`, `index.ts`) como módulo de producción, con `src/test/source-fixtures.ts` como reexport | El hash es dependencia de ejecución de `validateBlobContent`; resuelve F-03/H-1 sin romper el guard AC-0.10.                                 |
| 5   | `--dry-run` = "resuelve y valida sin persistir" (§7.2)                           | Ingesta completa contra PGlite en memoria con migraciones aplicadas; nunca toca la base real (`cli.ts`, `createDryRunStore`)                          | Verifica migraciones, constraints y escrituras reales; más fuerte que un recorrido sin persistir. PGlite se importa solo en ese modo (F-08). |
| 6   | `allowBuilds` solo previsto para `better-sqlite3` (§9, riesgo 11)                | `platform/pnpm-workspace.yaml` declara `esbuild: false` (además de `sharp`/`unrs-resolver`); `drizzle-kit` y `tsx` funcionan con binarios prebuilt    | pnpm 12 exige declarar la política de build scripts; ADR-010 documenta que ninguna dependencia compila código nativo.                        |
| 7   | `source_contexts` = "22 carpetas + contextos raíz" (§6.1)                        | Solo directorios de primer nivel; `content/contexts/README*.md` queda como `source_files` auxiliar                                                    | Índice mínimo aceptable en M1; la preferencia recursiva de documento es H2 (F-07).                                                           |
| 8   | `tsx` vs type-stripping nativo, "decisión menor" (§7.2)                          | `tsx` (devDependency) en los scripts `ingest` y `db:migrate` de `platform/package.json`                                                               | Un único runner para ambos scripts, con `--env-file-if-exists=.env.local`; sin alias ni extensiones explícitas.                              |
| 9   | 10 fixtures candidatos (§8)                                                      | 11 fixtures (se añade `nexova-hiring-process-sla.en.md`)                                                                                              | Cubre la combinación `en`+`suffix` de ADR-012; verificado a tres bandas (git local, manifiesto y upstream).                                  |
| 10  | Reconciliación de conteos como test opcional (§10.3)                             | Solo smoke real opt-in (`smoke.test.ts`, skipped por defecto); sin test de conteos en CI                                                              | Aceptado para M1; candidato a BACKLOG (H-3) con commit pinneado.                                                                             |
| 11  | Persistencia "pendiente de aprobación" (§5.3)                                    | ADR-010 aceptado: Supabase + Drizzle ORM + `pg`; PGlite en tests y `--dry-run`                                                                        | El gate de decisión se resolvió antes de implementar W3; las salvaguardas (tests sin nube, migraciones versionadas) se cumplen.              |

Correcciones de QA aplicadas en la misma rama sobre lo planificado:

- **F-01 (seguridad):** la redacción vive en `platform/src/lib/redact.ts`
  (`redactSecrets`/`describeError`, con enmascarado de contraseñas embebidas en
  URIs) y se aplica en `cli.ts` (errores y resumen) y en `store/migrate.ts`
  (errores); `DATABASE_URL`/`GITHUB_TOKEN` ya no pueden imprimirse aunque la
  URL sea inválida.
- **F-06 (guard):** `SCANNED_EXTENSIONS` escanea también `.yaml`, `.yml` y
  `.sql`, además de las extensiones previas.
- **F-08 (dependencias):** PGlite solo se carga en `--dry-run` (import
  dinámico dentro de `createDryRunStore`), de modo que el modo real no exige
  devDependencies.
- **F-03/H-1 (capas):** `computeGitBlobSha` y el parser/verificador del
  manifiesto dejan de ser dependencias productivas de `src/test/`.

Quedan fuera de M1, registradas en `BACKLOG.md`: F-05 (deduplicación de
errores al reintentar un snapshot `failed`) y F-07 (preferencia recursiva de
documento de contexto en H2).
