# M1 — QA técnica independiente (Hito 1: ingestión fiel)

- **Fecha:** 2026-10-02.
- **Rama:** `m1-ingestion`; `HEAD` = `3f98e4dcfb44fe70a68e715e88c373a09bfb2d0e` (la implementación W1a–W4 es
  working tree sin commitear).
- **Fuente auditada:** `4GeeksAcademy/ai-engineering-syllabus`, commit pinneado
  `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- **Entorno:** macOS (darwin), Node `v26.10.0`, pnpm `12.8.1`, Prettier `3.8.3`,
  PGlite `@electric-sql/pglite` `0.5.8`.
- **Convención:** todos los comandos de app se ejecutan como
  `npx --yes pnpm@12.8.1 --dir platform <cmd>`; nunca `pnpm install` en la raíz.
- **Carácter de la QA:** READ-ONLY sobre el código. El único archivo escrito es este
  informe. No se ejecutó `db:migrate`, ni ingesta sin `--dry-run`, ni conexión a
  Supabase. Los scripts temporales de verificación vivieron fuera del repo
  (`/tmp/m1qa/`) y se borraron al cerrar la QA.
- **Baseline del working tree al empezar** (implementación M1 y documentos, no
  introducidos por esta QA):

  ```text
   M DATA_MODEL.md
   M DECISIONS.md
   M STATUS.md
   M platform/.env.example
   M platform/.prettierignore
   M platform/package.json
   M platform/pnpm-lock.yaml
   M platform/pnpm-workspace.yaml
  ?? .mcp.json
  ?? docs/milestones/M1_AUDIT_PLAN.md
  ?? platform/drizzle.config.ts
  ?? platform/drizzle/
  ?? platform/fixtures/
  ?? platform/src/source/
  ```

## 1. Gate desde limpio

Se borraron `platform/.next`, `platform/node_modules`, `platform/next-env.d.ts` y
`platform/tsconfig.tsbuildinfo` antes de empezar. Cada paso es un comando real y su
código de salida literal.

| #   | Comando                                                                          | Exit | Extracto literal                                                                                    |
| --- | -------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| 1   | `rm -rf platform/.next platform/node_modules next-env.d.ts tsconfig.tsbuildinfo` | 0    | directorios ausentes tras el borrado                                                                |
| 2   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile`                 | 0    | `Done in 1.4s using pnpm v12.8.1`                                                                   |
| 3   | `npx --yes pnpm@12.8.1 --dir platform lint`                                      | 0    | sin salida (ESLint OK; log de 11 bytes: `$ eslint .`)                                               |
| 4   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                                 | 0    | `$ next typegen && tsc --noEmit` → `Generating route types...` `✓ Types generated successfully`     |
| 5   | `npx --yes pnpm@12.8.1 --dir platform test`                                      | 0    | `Test Files 18 passed \| 1 skipped (19)` · `Tests 187 passed \| 1 skipped (188)` · `Duration 1.64s` |
| 6   | `npx --yes pnpm@12.8.1 --dir platform build`                                     | 0    | `✓ Compiled successfully in 2.1s`; `Route (app)`: `/` y `/_not-found` (estáticas)                   |
| 7   | `cd platform && npx --yes prettier@3.8.3 --check .`                              | 0    | `Checking formatting...` `All matched files use Prettier code style!`                               |

El único test omitido es el smoke real contra GitHub, gated por variable de
entorno (`platform/src/source/github/smoke.test.ts:28`: `const smoke = smokeEnabled ? describe : describe.skip`).
No es un fallo: es el comportamiento previsto.

## 2. Veredicto por AC (AC-1.1 .. AC-1.13)

Resumen: **13 PASS, 0 FAIL, 0 PARTIAL**.

| AC      | Veredicto | Evidencia principal                                                                                                                           |
| ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1.1  | PASS      | `platform/src/source/types.ts:22-28`; `reader.ts:848-857`; `ingest.ts:201-222`; `reader.test.ts:42-95`; `ingest.test.ts:529-540`              |
| AC-1.2  | PASS      | `reader.ts:495-519`; `ingest.ts:196-199,423`; `reader.test.ts:156-217`; snapshot real con `ref = "main"`                                      |
| AC-1.3  | PASS      | `reader.ts:521-551`; `ingest.ts:424-430`; `reader.test.ts:219-289`; commit pinneado persistido en la ingesta real                             |
| AC-1.4  | PASS      | `reader.ts:680-722` (incl. `truncated`); `validate/snapshot.ts:14-28`; `reader.test.ts:291-438`; árbol real: 1355 entradas, `truncated=false` |
| AC-1.5  | PASS      | `classify/paths.ts:23-30`; `ingest.ts:307-310`; `classify/indexes.ts:63-97`; ingesta real: 625 blobs y 84 proyectos                           |
| AC-1.6  | PASS      | `classify/indexes.ts:104-150`; ingesta real: 264 blobs y 22 contextos                                                                         |
| AC-1.7  | PASS      | `classify/paths.ts:73-84`; `classify/indexes.ts:157-188`; ingesta real: 10 blobs y 5 lecciones                                                |
| AC-1.8  | PASS      | `validate/snapshot.ts:40-59`; `store/schema.ts:133-160`; 899/899 `blob_sha` idénticos a `ls-tree` y `rev-parse` (0 discrepancias)             |
| AC-1.9  | PASS      | `ingest.ts:337-365`; 781/781 textos byte-idénticos a `git show` (0 discrepancias); 118 binarios con referencia pinneada                       |
| AC-1.10 | PASS      | `classify/paths.ts:44-61,64-84,124-137`; ADR-012; 899/899 idiomas correctos; `validate/fixtures.test.ts:46`                                   |
| AC-1.11 | PASS      | `ingest.ts:432-453`; `postgres-store.ts:214-242`; `store/schema.ts:121-125`; 2ª ingesta real: `noop=true`, mismo snapshot y digest            |
| AC-1.12 | PASS      | `platform/fixtures/source/manifest.json` (11 fixtures); `validate/fixtures.test.ts:19-56`; 11/11 contra `git rev-parse`; guard AC-0.10 verde  |
| AC-1.13 | PASS      | `ingest.ts:244-266,316-411,509-534`; `store/schema.ts:253-275`; `ingest.test.ts:412-489,491-527`                                              |

### AC-1.1 Configurar repo `4GeeksAcademy/ai-engineering-syllabus`

- Constantes únicas en `platform/src/source/types.ts:22-28` (`SOURCE_REPOSITORY_OWNER`,
  `SOURCE_REPOSITORY_NAME`, `SOURCE_DEFAULT_REPOSITORY`) y tres roots en `types.ts:31-35`.
- `createGithubSourceReader` (`reader.ts:848-857`) lee `GITHUB_REPO` del entorno y
  `GithubSourceReader` valida el slug `owner/name` (`reader.ts:111-124`).
- La ingesta rechaza que el reader sirva un repo distinto al pedido (`ingest.ts:201-222`).
- `platform/.env.example` documenta `GITHUB_REPO` y `GITHUB_TOKEN` (ambos opcionales).
- Tests: `reader.test.ts:42-95` (default, prioridad, env, slug inválido) e
  `ingest.test.ts:529-540` (repo distinto → error sin crear snapshot).
- Evidencia real: la ingesta descargó el tarball y el árbol de
  `4GeeksAcademy/ai-engineering-syllabus` (`repository` del snapshot =
  `4GeeksAcademy/ai-engineering-syllabus`).

### AC-1.2 Resolver default branch/ref

- `getRepository` (`reader.ts:495-519`) devuelve `default_branch` y URL canónica.
- `normalizeRef` (`ingest.ts:196-199`) usa la default branch si no se pasa `--ref`;
  el `ref` queda en `source_snapshots.ref` (`store/schema.ts:111`).
- Tests: `reader.test.ts:156-217`.
- Evidencia real: resumen del CLI `"ref": "main"`; snapshot con `ref = main`.

### AC-1.3 Resolver commit SHA del snapshot

- `resolveCommit` (`reader.ts:521-551`) exige SHA-1 de 40 hex y devuelve `committedAt`.
- `ingestSnapshot` usa `options.commit` con prioridad sobre `ref` (`ingest.ts:424-430`).
- `UNIQUE(repository_id, commit_sha)` en `store/schema.ts:122-125`.
- Tests: `reader.test.ts:219-289` (rama, SHA pinneado, ref con barra, fecha, errores).
- Evidencia real: snapshot `commit_sha = 962c1e5fc8ebad273abaa348fb3d161568ce8707`.

### AC-1.4 Leer árbol recursivo

- `fetchTree` (`reader.ts:680-722`) llama a `/git/trees/{sha}?recursive=1` y falla con
  `TreeTruncatedError` si `truncated === true` (`reader.ts:700-702`), nunca importa un
  árbol parcial en silencio; si `truncated` no es `false` explícito, error (`reader.ts:703-710`).
- `validateSourceTree` (`validate/snapshot.ts:14-28`) devuelve el error a registrar.
- Tests: `reader.test.ts:291-438`, `validate/snapshot.test.ts:29-43`,
  `ingest.test.ts:491-527` (truncado → `failed`, sin archivos).
- Evidencia real (segunda corrida): `reader.getTree(PIN)` → `entries: 1355`,
  `truncated: false` (coincide con la medición de `M1_AUDIT_PLAN.md` §3.1).

### AC-1.5 Importar `content/projects`

- `classifySourcePath` (`classify/paths.ts:23-30`) clasifica los tres roots;
  `collectTreeFiles` filtra los blobs de contenido (`ingest.ts:307-310`).
- `buildSourceProjects` (`classify/indexes.ts:63-97`) indexa solo carpetas de primer
  nivel; `title` y `canonicalOrder` en `null`.
- Tests: `classify/indexes.test.ts:41-100`, `ingest.test.ts:223-372`.
- Evidencia real: 625 blobs y 84 filas de `source_projects` (los tres conteos del ACL
  coinciden exactamente con `M1_AUDIT_PLAN.md` §3.2).

### AC-1.6 Importar `content/contexts`

- `buildSourceContexts` (`classify/indexes.ts:104-150`) indexa carpetas de primer nivel,
  prefiere `README*` y, si no, `CONTEXT-*.md` (`classify/paths.ts:124-137`), y guarda
  todos los `CONTEXT-*` como metadata.
- Tests: `classify/indexes.test.ts:103-199`.
- Evidencia real: 264 blobs y 22 contextos.

### AC-1.7 Importar `content/lessons`

- `resolvePreferredLessonDocument` (`classify/paths.ts:73-84`) usa el slug del
  directorio (`<slug>.es.md` → `<slug>.md` → `<slug>.en.md`), no `README.md`.
- `buildSourceLessons` (`classify/indexes.ts:157-188`).
- Tests: `classify/indexes.test.ts:124-218`.
- Evidencia real: 10 blobs y 5 lecciones.

### AC-1.8 Guardar path + blob/hash

- `source_files` guarda `path` (posix relativo), `blob_sha`, `media_type` y
  `UNIQUE(snapshot_id, path)` (`store/schema.ts:133-160`).
- `validateBlobContent` (`validate/snapshot.ts:40-59`) calcula el SHA-1 git de los bytes
  descargados y lo contrasta con el blob del árbol; discrepancia → error registrado.
- Tests: `validate/snapshot.test.ts:45-72`, `tarball.test.ts:104-130`.
- Evidencia real: **899/899** `blob_sha` idénticos a `git ls-tree -r` y a
  `git rev-parse <commit>:<path>` del repo local, y 0 errores de ingesta (el reader
  valida el hash de **cada** blob descargado antes de guardarlo).

### AC-1.9 Guardar raw content

- Texto: `rawContent` íntegro decodificado UTF-8 estricto (`TextDecoder` con
  `fatal: true`, `ingest.ts:304,351-365`); binario: `rawContent = null` y
  `binaryReference` pinneada a `raw.githubusercontent.com/<repo>/<commit>/<path>`
  (`ingest.ts:229-242,341-349`).
- `CHECK` de exclusividad en `store/schema.ts:150-153`.
- Tests: `ingest.test.ts:253-269` (comparación byte a byte con los fixtures),
  `validate/files.test.ts:11-58`.
- Evidencia real: 781/781 textos byte-idénticos a `git show <commit>:<path>`; 118/118
  binarios con `binary_reference` exacta y `raw_content IS NULL`.

### AC-1.10 reconocer `README.es.md`/`README.md`

- `resolveSourceLanguage` (`classify/paths.ts:44-61`): `es`+`suffix` (`.es.md`),
  `en`+`suffix` (`.en.md`), `en`+`pair-convention` (`X.md` con `X.es.md`), resto
  `null/null`; nunca se infiere del contenido (ADR-012).
- Preferencia de documentos: proyecto (`paths.ts:64-70`), lección (`paths.ts:73-84`),
  contexto (`paths.ts:124-137`).
- Tests: `classify/paths.test.ts:35-188`, `validate/fixtures.test.ts:46-56`.
- Evidencia real: 899/899 archivos con la pareja `language/language_evidence` que exige
  ADR-012, distribución: `es/suffix` 286, `en/suffix` 64, `en/pair-convention` 222,
  `null/null` 327 (0 discrepancias). Los 286 `.es.md` coinciden con la medición de la
  auditoría.

### AC-1.11 importación idempotente

- `ingestSnapshot` consulta `findSnapshotByCommit` y devuelve el snapshot existente como
  no-op si está `complete`/`complete_with_errors` (`ingest.ts:432-453`).
- `createSnapshot` (`postgres-store.ts:214-242`) es no-op por
  `UNIQUE(repository_id, commit_sha)`; `upsertFiles` (`postgres-store.ts:244-266`) usa
  `UNIQUE(snapshot_id, path)` y solo actualiza si el `blob_sha` difiere.
- Tests: `ingest.test.ts:374-410` (no-op y commit nuevo sin tocar el anterior),
  `postgres-store.test.ts:301-315,352-367`.
- Evidencia real: segunda ingesta del mismo commit con **reader nuevo** →
  `status = complete`, `noop = true`, mismo `snapshot_id`, mismo digest SHA-256 de filas
  (`8a8d46e2…abf5c3`) y conteos de las 6 tablas idénticos antes y después
  (snapshots 1, files 899, projects 84, contexts 22, lessons 5, errors 0).

### AC-1.12 fixtures de tests obtenidos del repo real

- `platform/fixtures/source/962c1e5…/<path original>` con 11 copias verbatim y
  `manifest.json` (`repository`, `commit`, `path`, `blob_sha`) conforme a ADR-009.
- Verificación del guard AC-0.10: `platform/src/test/no-hardcoded-catalog.test.ts:53-77`
  (denylist dinámica fail-closed) y `platform/src/test/source-fixtures.test.ts:169-260`
  (blob fiel, no declarado, alterado).
- Tests: `validate/fixtures.test.ts:19-56`.
- Evidencia real: los 11 `blob_sha` del manifiesto coinciden con
  `git rev-parse 962c1e5…:<path>` (`11/11 OK`); suite completa verde (187 tests), que
  incluye el guard AC-0.10.

### AC-1.13 registrar errores sin inventar sustitutos

- Cada fallo por archivo se registra con `errorKind` de la unión cerrada
  (`types.ts:211-221`) y la importación continúa (`ingest.ts:316-411`); el snapshot
  termina `complete_with_errors` (`ingest.ts:529-534`) y nunca se inserta una fila
  sintética. Fallo global (árbol truncado/ilegible o escritura) → `failed` con error
  registrado (`ingest.ts:472-485,509-527`).
- `source_import_errors` con `CHECK` de los 9 tipos (`store/schema.ts:253-275`);
  `DATA_MODEL.md:131-147` y ADR-011.
- Tests: `ingest.test.ts:412-489` (3 fallos: hash, lectura, decode; 3 errores, 8/11
  archivos importados, ninguno de los fallidos en `source_files`), `491-527` (truncado y
  fallo de árbol → `failed`), `postgres-store.test.ts:530-587,589-615`.
- Evidencia real: la ingesta real del corpus terminó `complete` con `errors = 0`
  (ningún archivo del corpus falló), y la ruta de errores está cubierta por los tests
  inyectados.

## 3. Fidelidad byte a byte (ingesta real de solo lectura)

### 3.1 Método

Scripts temporales fuera del repo (`/tmp/m1qa/fidelity.ts` y
`/tmp/m1qa/fidelity-gitshow.ts`, borrados al terminar), ejecutados con `tsx` y resueltos
contra `platform/node_modules`. Ambos usan exactamente:

- `GithubSourceReader` real (tarball de `codeload` + `git/trees?recursive=1` de la API);
- `ingestSnapshot` de `platform/src/source/ingest/ingest.ts`;
- `PostgresSourceStore` sobre `PGlite` en memoria con las migraciones reales de
  `platform/drizzle/` (mismo esquema que Supabase; ningún `DATABASE_URL`).

El commit se pasó pinneado (`--commit`/`commit:`), por lo que la comparación es
determinista. Se usó un token de solo lectura del propio `gh` para el rate limit; el
token nunca se imprimió.

Contraste local contra el repo real: `git ls-tree -r <commit>`, `git rev-parse <commit>:<path>`,
`git show <commit>:<path>` (segunda corrida) y `git cat-file --batch` (primera corrida).

### 3.2 `blob_sha` (899/899)

| Comprobación                                                              | Comparados | Discrepancias |
| ------------------------------------------------------------------------- | ---------- | ------------- |
| `source_files.blob_sha` vs `git ls-tree -r 962c1e5…` (repo local)         | 899        | **0**         |
| `git ls-tree` vs `git rev-parse 962c1e5…:<path>` (899 revs en un proceso) | 899        | **0**         |
| `source_files.blob_sha` vs `git rev-parse` en la 2ª corrida (binarios)    | 118        | **0**         |

Además, la ingesta real terminó `errors = 0`: el reader calculó el SHA-1 git de los
bytes descargados de **cada** blob y coincidió con el `blob_sha` del árbol de GitHub
(`validateBlobContent`, `validate/snapshot.ts:40-59`). Es decir, la cadena
`árbol GitHub == blob local == bytes descargados == contenido guardado` quedó cerrada.

### 3.3 Texto: `raw_content` vs `git show` (781/781)

Segunda corrida independiente, comparando uno a uno la salida cruda de
`git show <commit>:<path>` con `Buffer.from(raw_content, "utf8")`:

```text
"gitShowText": { "compared": 781, "mismatches": [] }
```

La primera corrida (contra `git cat-file --batch`, la plomería que usa `git show`)
obtuvo el mismo resultado:

```text
"textCompared": 781, "byteDiscrepancies": []
```

Resumen del método con los bytes exactos: 0 discrepancias en 781 archivos de texto
(`md`, `json`, `csv`, `html`, `sql`, `css`, `txt`, `ts`, `py`, `js`, `ipynb`) de los tres
roots, incluidos los `.learn/` ocultos.

### 3.4 Binarios (118/118)

- `raw_content IS NULL` y `binary_reference` exactamente
  `https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/962c1e5…/<path>`:
  118/118, 0 discrepancias.
- `blob_sha` correcto (tabla 3.2) y hash validado sobre los bytes descargados del
  tarball, incluido el `.DS_Store` versionado del upstream.
- No se guarda base64 ni bytes de binarios, conforme a `M1_AUDIT_PLAN.md` §6.2.

### 3.5 Idioma `language`/`language_evidence` contra ADR-012

Calculado para los **899** archivos (no solo una muestra), con la evidencia de path del
propio inventario:

| Combinación              | Archivos | Coincidencias con ADR-012 |
| ------------------------ | -------- | ------------------------- |
| `es` + `suffix`          | 286      | 286                       |
| `en` + `suffix`          | 64       | 64                        |
| `en` + `pair-convention` | 222      | 222                       |
| `null` + `null`          | 327      | 327                       |
| **Discrepancias**        | —        | **0**                     |

Los 286 `.es.md` coinciden con la medición de `M1_AUDIT_PLAN.md` §3.4.

### 3.6 `title` y `canonical_order`

Consulta real sobre el snapshot ingestado:

```text
nullTitles: { projects: 0, contexts: 0, lessons: 0, canonical_orders: 0 }
```

Cero títulos no nulos en `source_projects`/`source_contexts`/`source_lessons` y cero
`canonical_order` no nulos en `source_projects` (Hito 2 no adelantado).

### 3.7 Reconciliación de conteos con la auditoría

| Métrica                                 | `M1_AUDIT_PLAN.md` §3.2 | Ingesta real QA | ¿Coincide? |
| --------------------------------------- | ----------------------- | --------------- | ---------- |
| Blobs totales de contenido              | 899                     | 899             | Sí         |
| `content/projects`                      | 625                     | 625             | Sí         |
| `content/contexts`                      | 264                     | 264             | Sí         |
| `content/lessons`                       | 10                      | 10              | Sí         |
| Textuales                               | 781                     | 781             | Sí         |
| Binarios                                | 118                     | 118             | Sí         |
| Índices de proyecto (`source_projects`) | 84                      | 84              | Sí         |
| Índices de contexto (`source_contexts`) | 22                      | 22              | Sí         |
| Índices de lección (`source_lessons`)   | 5                       | 5               | Sí         |

### 3.8 CLI real `--dry-run --json`

```sh
GITHUB_TOKEN="$(gh auth token)" npx --yes pnpm@12.8.1 --dir platform \
  ingest --commit 962c1e5fc8ebad273abaa348fb3d161568ce8707 --dry-run --json
# exit 0
```

Extracto literal de la salida:

```json
{
  "dryRun": true,
  "repository": "4GeeksAcademy/ai-engineering-syllabus",
  "ref": "main",
  "commit": "962c1e5fc8ebad273abaa348fb3d161568ce8707",
  "status": "complete",
  "noop": false,
  "files": {
    "total": 899,
    "text": 781,
    "binary": 118,
    "byRoot": { "projects": 625, "contexts": 264, "lessons": 10 }
  },
  "indexes": { "projects": 84, "contexts": 22, "lessons": 5 },
  "errorCount": 0,
  "errors": [],
  "durationMs": 4520
}
```

Nota de uso: `pnpm --dir platform ingest -- --commit …` **falla** (`opción desconocida "--"`,
exit 2) porque `--` se reenvía al script; la invocación correcta es sin `--`
(`pnpm --dir platform ingest --commit …`). Es comportamiento estándar de pnpm, no un
defecto de M1.

## 4. Idempotencia real

1. Primera ingesta (reader A) → `complete`, snapshot `43115a09-…`, 899 archivos.
2. Segunda ingesta del **mismo commit con un reader nuevo** (reader B) →
   `complete`, `noop = true`, mismo `snapshot_id`, `counts = null`, `errors = 0`.
3. Digest SHA-256 de todas las filas de `source_files` (path, blob_sha, media_type,
   idioma, contenido/referencia y orden por path) idéntico antes y después:
   `8a8d46e2af3c31e42e93a4646c9c2861437f443986dfa4850f2f872a49abf5c3`.
4. Conteos por tabla idénticos antes/después:

   | Tabla                  | Antes | Después |
   | ---------------------- | ----- | ------- |
   | `source_snapshots`     | 1     | 1       |
   | `source_files`         | 899   | 899     |
   | `source_projects`      | 84    | 84      |
   | `source_contexts`      | 22    | 22      |
   | `source_lessons`       | 5     | 5       |
   | `source_import_errors` | 0     | 0       |

No hubo `UPDATE` ni `DELETE`; el snapshot no se modificó (mismo id y digest). El caso
"commit nuevo no toca el anterior" está además cubierto por
`ingest.test.ts:391-410` y `postgres-store.test.ts:474-528`.

## 5. Migración verificada en PGlite (`platform/drizzle/*.sql`)

Se aplicó `platform/drizzle/0000_puzzling_tenebrous.sql` (vía el migrador de Drizzle
sobre PGlite) y se consultó `information_schema`, `pg_class`, `pg_constraint` y
`pg_policies`. La carpeta no se tocó.

- **7 tablas** creadas (`select table_name from information_schema.tables where
table_schema='public' and table_type='BASE TABLE'`):
  `source_contexts`, `source_files`, `source_import_errors`, `source_lessons`,
  `source_projects`, `source_repositories`, `source_snapshots`.
- **RLS en todas**: `relrowsecurity = true` en las 7
  (`pg_class where relnamespace='public'::regnamespace and relkind='r'`); **0 políticas**
  (`pg_policies`), conforme a ADR-010.
- **UNIQUE** (6, `pg_constraint.contype='u'`):
  - `source_repositories_owner_name_unique` → `UNIQUE (owner, name)`
  - `source_snapshots_repository_commit_unique` → `UNIQUE (repository_id, commit_sha)`
  - `source_files_snapshot_path_unique` → `UNIQUE (snapshot_id, path)`
  - y los tres `UNIQUE (snapshot_id, source_path)` de projects/contexts/lessons.
- **CHECK** (7, `contype='c'`): estado de snapshot (`in (4 valores)`), contenido
  exactamente uno, idioma/evidencia en las 4 tablas afectadas, y `error_kind` en los 9
  tipos.
- **FK RESTRICT** (6, `contype='f'`): `confdeltype = 'r'` en las 6
  (5 `snapshot_id → source_snapshots` + 1 `repository_id → source_repositories`);
  ninguna cascada.
- Índice `source_import_errors_snapshot_id_idx` presente.

Los mismos invariantes están cubiertos por tests: `postgres-store.test.ts:230-261`
(tablas/RLS), `369-458` (UNIQUE/CHECK), `589-615` (FK RESTRICT).

## 6. Fixtures (AC-1.12) — contraste contra el upstream local

`jq '.fixtures|length' platform/fixtures/source/manifest.json` → **11**;
`repository = 4GeeksAcademy/ai-engineering-syllabus`.

Contraste individual de cada fixture declarado:

```sh
git rev-parse 962c1e5fc8ebad273abaa348fb3d161568ce8707:<path>  # == manifest.blob_sha
```

Resultado: **11/11 OK**, incluidos README inglés/español, `learn.json`, `CONTEXT-*`,
lección, PDF, PNG y el caso real sin `README.es.md` (`.learn/solution/README.md`). El
guard AC-0.10 sigue verde (`no-hardcoded-catalog.test.ts:53-77` y
`source-fixtures.test.ts:169-260`, dentro de los 187 tests que pasan).

## 7. Hallazgos

**Bloqueantes: 0. Menores: 0. Sugerencias: 3.**

### H-1 (sugerencia) — Código de producción depende de `src/test/`

- **Reproducción:**

  ```sh
  grep -rn 'from "../test\|from "../../test"' platform/src/source --include="*.ts" | grep -v ".test.ts"
  # platform/src/source/fixture-reader.ts:23   → ../test/source-fixtures
  # platform/src/source/validate/snapshot.ts:1 → ../../test/source-fixtures
  ```

  `validate/snapshot.ts` es código de producción: `ingest.ts:42` lo importa y
  `validateBlobContent` usa `computeGitBlobSha` (`platform/src/test/source-fixtures.ts:59`).

- **Impacto:** acoplamiento de capas (`source/` → `test/`); funciona porque la función es
  pura, pero dificulta empaquetar la ingesta sin el andamiaje de tests.
- **Corrección propuesta:** mover `computeGitBlobSha` a `platform/src/source/hash.ts`
  (o `validate/git-blob.ts`) y `parseSourceFixtureManifest`/`verifySourceFixtures` a
  `source/validate/`, dejando `src/test/source-fixtures.ts` como reexport para no romper
  guard/tests. No urgente.

### H-2 (sugerencia) — `db:migrate` aplica sin previsualización

- **Reproducción:** `platform/package.json` (`db:migrate` → `store/migrate.ts`) y
  `platform/src/source/store/migrate.ts:24-41`: con `DATABASE_URL` definida aplica las
  migraciones directamente, sin modo `--dry-run`/`--check`.
- **Impacto:** un `DATABASE_URL` equivocado en `.env.local` muta una base real sin
  confirmación. No afecta a M1 (nada se aplicó en esta QA) pero es un riesgo operativo.
- **Corrección propuesta:** flag `--dry-run` que liste el SQL pendiente (o `--check`)
  antes de aplicar; documentarlo en `platform/README.md`. Candidato a BACKLOG.

### H-3 (sugerencia) — El único E2E real contra GitHub está gated y no corre en CI

- **Reproducción:** `platform/src/source/github/smoke.test.ts:28`
  (`smokeEnabled ? describe : describe.skip`); la suite reporta `1 skipped` sin la
  variable de entorno. El workflow de `platform/` no lo activa.
- **Impacto:** la fidelidad contra el upstream real (lo verificado en esta QA) no queda
  protegida de regresiones en CI; solo se cubre con mocks/fixtures.
- **Corrección propuesta:** job programado opcional con `--commit` pinneado y
  `--dry-run --json`, comparando los conteos de §3.7 (barato: ~3 llamadas API + 1
  codeload). Candidato a BACKLOG.

## 8. Conclusión

Los 13 AC de `docs/milestones/M1_INGESTION.md` quedan **PASS** con evidencia real: gate
completo desde limpio (install frozen, lint, typecheck, 187 tests, build, prettier), una
ingesta real de solo lectura contra GitHub con **899/899 blob_sha**, **781/781 textos
byte-idénticos** a `git show`, **118/118 binarios** con referencia pinneada, idioma
ADR-012 sin discrepancias en 899 archivos, `title`/`canonical_order` en `NULL`,
idempotencia real (no-op con mismos conteos y digest) y migración con las 7 tablas,
UNIQUE/CHECK/FK RESTRICT y RLS en todas. Sin bloqueantes ni hallazgos menores; tres
sugerencias de limpieza/robustez (H-1..H-3). No se adelantó alcance de H2–H9 y no se
inventó contenido: los únicos datos usados son del repositorio fuente en el commit
pinneado.
