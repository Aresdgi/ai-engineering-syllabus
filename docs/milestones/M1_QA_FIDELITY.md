# M1 — QA independiente de fidelidad, alcance, seguridad y coherencia documental

- Hito: **Hito 1 — Ingestión fiel** (rama `m1-ingestion`).
- Tarea: `[M1-Q2]` — QA READ-ONLY. No se ha modificado código, esquema, fixtures ni documentación; el único artefacto escrito es este informe.
- Fecha: 2026-10-02.
- Repo fuente auditado: `4GeeksAcademy/ai-engineering-syllabus`, commit pinneado `962c1e5fc8ebad273abaa348fb3d161568ce8707` (el mismo de `platform/fixtures/source/manifest.json`).
- Baseline git al empezar (sin cambios de Q2): ` M DATA_MODEL.md`, ` M DECISIONS.md`, ` M STATUS.md`, ` M platform/.env.example`, ` M platform/.prettierignore`, ` M platform/package.json`, ` M platform/pnpm-lock.yaml`, ` M platform/pnpm-workspace.yaml`; sin seguimiento: `.mcp.json`, `docs/milestones/M1_AUDIT_PLAN.md`, `platform/drizzle.config.ts`, `platform/drizzle/`, `platform/fixtures/`, `platform/src/source/`.
- Documentos leídos completos: `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `REPO_MAP.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `ORCA.md`, `DECISIONS.md` (ADR-001..012), `STATUS.md`, `docs/milestones/M1_INGESTION.md`, `platform/README.md` y `docs/milestones/M1_AUDIT_PLAN.md`; además el código de `platform/src/source/**`, `platform/src/test/**`, `platform/drizzle/**`, `platform/package.json`, `platform/.env.example` y `platform/pnpm-workspace.yaml`.
- Restricciones respetadas: no se ejecutó `install`, `build`, `start` ni `ingest`; no se tocó Supabase; no se tocaron rutas prohibidas; todos los comandos de app se ejecutaron como `npx --yes pnpm@12.8.1 --dir platform <cmd>`.

Convención de severidad: **bloqueante** = debe corregirse antes de cerrar el hito; **menor** = corregir o registrar antes del cierre; **sugerencia** = mejora opcional/BACKLOG.

## Resumen ejecutivo

| Severidad  | Nº  | IDs                          |
| ---------- | --- | ---------------------------- |
| Bloqueante | 1   | F-01                         |
| Menor      | 4   | F-02, F-03, F-04, F-10       |
| Sugerencia | 5   | F-05, F-06, F-07, F-08, F-09 |
| **Total**  | 10  |                              |

Veredicto por área:

1. **Contenido inventado: sin hallazgos.** El importador copia bytes, no resume ni deriva títulos/orden; guard AC-0.10 verde.
2. **Alcance: sin hallazgos.** No hay UI de catálogo, orden canónico, progreso, relaciones, búsqueda, IA/embeddings ni diff; todo lo prohibido de H2+ está ausente.
3. **Fixtures ADR-009/AC-1.12: correcto.** Los 11 fixtures existen, su `git hash-object` coincide byte a byte con el manifiesto y los 11 SHAs coinciden con el árbol upstream del commit pinneado.
4. **Seguridad: 1 bloqueante (F-01).** RLS/token/.env/dependencias correctos; `db:migrate` puede imprimir `DATABASE_URL` con credenciales ante una URL malformada.
5. **Inmutabilidad: sin hallazgos.** Sin `DELETE` y con un único `UPDATE` (estado del propio snapshot); FKs `RESTRICT`; AC-1.11/1.13 coherentes con `ARCHITECTURE.md`.
6. **Coherencia documental: 2 hallazgos menores (F-02, F-04) y cierre pendiente (F-10).** ADR-010..012 fieles a la implementación; `DATA_MODEL.md` omite `preferred_readme_path` en contextos/lecciones.

---

## 1. Contenido inventado

**Veredicto: no se encontró ningún código que resuma, reescriba, rellene, derive títulos/orden ni cree sustitutos.**

Evidencia:

- `platform/src/source/types.ts:188` (`title: null`), `:196` (`canonicalOrder: null`) y `platform/src/source/classify/indexes.ts:85-86` (`title: null`, `canonicalOrder: null`): los índices no derivan títulos ni orden en M1.
- `platform/src/source/ingest/ingest.ts:327-335` verifica `blob_sha` con `validateBlobContent` antes de persistir; `:340-365` guarda los bytes textuales decodificados (UTF-8 `fatal: true`) en `rawContent` y los binarios como `binaryReference` pinneada; `:350-365` ante bytes no UTF-8 **registra error y descarta**, nunca sustituye.
- `platform/src/source/validate/snapshot.ts:40-59`: `file-hash-mismatch` registra la discrepancia; no se inserta contenido alternativo.
- No hay parser de Markdown, resumen, traducción ni generación: búsqueda de `# `, `summar`, `translate`, `openai`, `anthropic`, `embedding` sin resultados en `platform/src/source/**`.
- Nombres del catálogo hardcodeados: el guard AC-0.10 pasa en verde (`platform/src/test/no-hardcoded-catalog.test.ts:53-77`, fail-closed en `:66-70`). Escaneo manual adicional de los directorios nuevos no cubiertos por extensión (`.sql`, `.yaml`, `.example`) contra 9 nombres reales del corpus: **0 hits**. Los únicos literales de identidad son del repositorio, no del catálogo (`types.ts:22-28`), y están permitidos por AC-1.1.
- Los únicos recortes de texto son de mensajes de error de la API (`platform/src/source/github/reader.ts:72` y `:175`), nunca de contenido educativo.

## 2. Alcance (nada de Hito 2+)

**Veredicto: sin hallazgos.** Grep sobre `platform/src/**` de `canonical_order|canonicalOrder|progress|user_progress|user_notes|user_bookmarks|linked_project|source_relations|ai_threads|ai_messages|embedding|pgvector|tsvector|content/projects/README`:

- `canonicalOrder` solo aparece como tipo `null` (`types.ts:196`), como columna del esquema (`store/schema.ts:170`) y en aserciones de test de que es `null` (`postgres-store.test.ts:648-703`).
- No existen `source_relations`, `user_*`, `linked_project_repositories`, `ai_threads` ni `ai_messages` en el esquema ni en el código.
- La app (H2) no cambió: `git status` no muestra `platform/src/app/**` ni `platform/src/components/**` modificados; el shell sigue siendo el de M0 (`src/app/page.tsx:1`, `src/app/layout.tsx:3`).
- `platform/src/source/**` no importa `course/`, `user/` ni `ai/` (no existen) y la app no importa `source/`.
- El alcance real del esquema (7 tablas) coincide con lo que `docs/milestones/M1_AUDIT_PLAN.md:224` declara fuera de M1.
- **Observación no bloqueante:** `content/projects/README.md` no se lee en ninguna parte (correcto para M1); el único uso de la convención `README` es para elegir el documento preferido de la unidad (`classify/paths.ts:64-84`).

## 3. Fixtures ADR-009 / AC-1.12

**Veredicto: correcto y verificado a tres bandas.**

Método: (1) `git hash-object` de cada archivo local; (2) `blob_sha` del manifiesto; (3) `sha` del blob en `gh api repos/4GeeksAcademy/ai-engineering-syllabus/git/trees/962c1e5...?recursive=1` (1355 entradas, `truncated=false`). Resultado: **11/11 OK** en las tres columnas.

| #   | Path                                                                                           | `blob_sha` manifiesto = git = upstream     |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `content/contexts/00-general-contexts/nexova/nexova-hiring-process-sla.en.md`                  | `7cbb71806c7f51f4e1825a601a856633165ab338` |
| 2   | `content/contexts/09-agentic-workflows/rfp-requests/trackflow/CONTEXT-trackflow-request-3.pdf` | `3465abb3d19ac49793b06e806db5c66738feeec3` |
| 3   | `content/contexts/audit-log/CONTEXT-trackflow.es.md`                                           | `110af327664f620914a48c509e7c5102ea7a0c0a` |
| 4   | `content/contexts/audit-log/CONTEXT-trackflow.md`                                              | `eff7fdb7a5d9947666279b55ba72bc9ce983b4aa` |
| 5   | `content/lessons/4geeks-student-extension/4geeks-student-extension.es.md`                      | `41313f085f5f4a7bba5bb2e5803151bdf8137fe4` |
| 6   | `content/lessons/4geeks-student-extension/4geeks-student-extension.md`                         | `e27610ccc3459e8b636af9ff9e905c62e39585dd` |
| 7   | `content/projects/ai-eng-error-handling/.learn/preview.png`                                    | `7645687bcbde8522dc1a10b44380da92bf32ecfd` |
| 8   | `content/projects/ai-eng-milestone-choose-company/.learn/solution/README.md`                   | `49083ff748b6134f970dd635462fc7f57f032a0e` |
| 9   | `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.es.md`                | `3756e6cc5718e385ed7330732a902ec4ee20c8f2` |
| 10  | `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.md`                   | `66fb7d976a012b49d234174d48b2611ada4f5bbc` |
| 11  | `content/projects/data-modeling-and-class-diagrams-digital-wallet/learn.json`                  | `1c008a23ca3fec63b097ea13f0e80671474b433c` |

Evidencia adicional:

- Manifiesto: `platform/fixtures/source/manifest.json:1-60` (11 entradas, `repository` correcto, sin duplicados, paths relativos).
- Guard AC-0.10: `platform/src/test/source-fixtures.ts:243-343` verifica existencia, declaración, forma del manifiesto e integridad byte a byte; solo excluye del escaneo lo verificado (`:228-232` de `catalog-denylist.ts`). Los tests de alteración/no declarado/faltante están en `source-fixtures.test.ts:220-368`.
- El fixture n.º 1 (`.en.md`) y el caso sin español (n.º 8, anidado en `.learn/solution/`) cubren los casos límite de ADR-012. La tabla de candidatos de `M1_AUDIT_PLAN.md:332-343` tenía 10 filas; la implementación añade el `.en.md` (11), lo cual es una ampliación legítima y verificada.
- El directorio `platform/fixtures/source/` está excluido de Prettier (`platform/.prettierignore:6`), por lo que los verbatim no pueden reformatearse por accidente.

## 4. Seguridad

**Veredicto: correcto salvo F-01 (bloqueante).**

- **RLS habilitado en todas las tablas y sin políticas:** esquema `platform/src/source/store/schema.ts:102,131,160,191,221,251,275` (`.enableRLS()`), migración SQL `platform/drizzle/0000_puzzling_tenebrous.sql:14,30,42,56,71,81,93` (`ENABLE ROW LEVEL SECURITY`). No hay ningún `CREATE POLICY`. Verificado por test en `postgres-store.test.ts:240-261` (`relrowsecurity = true` en las 7 tablas y `pg_policies.count = 0`).
- **Token solo hacia `api.github.com`:** `github/reader.ts:624-634` añade `Authorization` únicamente en `apiHeaders()`, usado solo por `request()` contra `apiBaseUrl`; el tarball (`:768-773`) y el fallback raw (`:822-827`) fijan cabeceras propias sin token. Tests: `reader.test.ts:98-136` (solo con token y solo en API) y `tarball.test.ts:180` (`authorization` nulo en codeload).
- **Token nunca en errores:** `github/errors.ts:1-13` documenta la regla y `describeHttpErrorContext`/`httpDetail` (`:94-137`) solo serializan url/status/rateLimit/apiMessage/note, nunca cabeceras. `cli.ts:50-60` redacta ambos secretos en el catch general.
- **`DATABASE_URL` en salida:** el CLI la redacta en errores (`cli.ts:157-159`), pero `store/migrate.ts:48` hace `console.error(error)` sin redactar → **F-01**.
- **`.env.example` sin variables activas:** las 34 líneas son comentarios/blancos; test en `env-example.test.ts:38-52`; sin patrones de secreto (`:54-64`).
- **`.env.local` ignorado:** `git check-ignore -v platform/.env.local` → `platform/.gitignore:27:.env*` (excepción `!.env.example` en `:28`). El archivo existe en el working tree pero está ignorado; Q2 no lo leyó.
- **`esbuild: false` justificado:** `platform/pnpm-workspace.yaml:1-4`; ADR-010 (`DECISIONS.md:126-132`) explica que `drizzle-kit`/`tsx` usan binarios prebuilt vía `optionalDependencies` y `sharp`/`unrs-resolver` siguen denegados. Corroborado indirectamente: `tsx`, `drizzle-kit`, `vitest`, `eslint`, `tsc` y `next` están en `platform/node_modules/.bin`, y lint/typecheck/tests/prettier pasan sin postinstall.
- **Dependencias razonables:** runtime `drizzle-orm`, `pg`, `tar-stream`; desarrollo `drizzle-kit`, `@electric-sql/pglite`, `tsx`, `@types/pg`, `@types/tar-stream` (`platform/package.json:18-51`). No hay librerías duplicadas ni innecesarias (sin zod/lodash/ORM extra). Matiz de F-08.
- **Sin conexión a Supabase en tests:** los tests usan PGlite y no leen `DATABASE_URL` (grep: solo comentarios; `cli.ts` y `migrate.ts` son los únicos puntos que leen `process.env.DATABASE_URL`).

## 5. Inmutabilidad

**Veredicto: sin hallazgos.**

- **Sin `DELETE`:** no existe `.delete(`/`DELETE FROM` en `platform/src/source/**` ni en la migración SQL.
- **Único `UPDATE`:** `store/postgres-store.ts:345-360` (`setSnapshotStatus`) actualiza el estado del propio snapshot; el `upsertRepository` (`:173-194`) refresca metadatos del repositorio, no contenido de snapshots.
- **Upserts acotados al mismo snapshot:** `upsertFiles` (`:244-266`) tiene como target `(snapshot_id, path)` y además `setWhere blob_sha <> excluded.blob_sha`, de modo que un mismo commit no reescribe filas idénticas y nunca toca otro snapshot; ídem proyectos/contextos/lecciones (`:268-333`).
- **FK `RESTRICT`:** `schema.ts:110,139,168,199,229,259` (`onDelete: "restrict"`) y SQL `0000_puzzling_tenebrous.sql:94-99`; test en `postgres-store.test.ts:589-616` (no se borra un snapshot con archivos o errores).
- **AC-1.11:** `UNIQUE(repository_id, commit_sha)` (`schema.ts:122-125`), no-op de reingesta (`ingest.ts:432-453`), commit nuevo → snapshot nuevo sin tocar el anterior (`ingest.test.ts:374-410`; store test `:474-529`).
- **AC-1.13/1.9 coherentes con `ARCHITECTURE.md:87-91`:** los fallos van a `source_import_errors`; el snapshot termina `complete_with_errors`/`failed` (`ingest.ts:509-534`) y `source_files` solo recibe bytes verificados (`ingest.ts:327-381`). Test `ingest.test.ts:412-490` comprueba que no se crea contenido sustituto.

## 6. Coherencia documental

### 6.1 ADR-010..012 vs implementación

- **ADR-010** (`DECISIONS.md:94-132`): PostgreSQL + Drizzle + `pg` (`store/schema.ts`, `store/postgres-store.ts`, `cli.ts:85-94`), PGlite en tests (`postgres-store.test.ts:215-228`) y dry-run (`cli.ts:72-83`), migraciones versionadas (`platform/drizzle/`), RLS sin políticas, `UNIQUE` compuestos, FK `RESTRICT`, deps declaradas y `allowBuilds`. **Fiel.**
- **ADR-011** (`DECISIONS.md:134-148`): tabla `source_import_errors` con FK `RESTRICT`, `error_kind` con `CHECK` de los 9 tipos de `types.ts:211-221`, snapshot `complete_with_errors`/`failed`, nunca contenido sintético. **Fiel** (`schema.ts:253-275`, SQL `:31-42`, `ingest.ts:273-296,509-534`).
- **ADR-012** (`DECISIONS.md:150-167`): `es`+`suffix`, `en`+`suffix`, `en`+`pair-convention`, `null`+`null`, en las 4 tablas y con `CHECK`. **Fiel** (`classify/paths.ts:44-61`, `schema.ts:52-90,154-158,185-189,215-219,245-249`, SQL de los 4 `CHECK`). Test de la matriz completa en `ingest.test.ts:272-291` y de rechazo de combinaciones inválidas en `postgres-store.test.ts:414-459`.

### 6.2 DATA_MODEL.md vs esquema real (columna a columna)

| Tabla                  | Documentado en `DATA_MODEL.md`                                                                                                  | Esquema real (`platform/src/source/store/schema.ts`)                                                                                                 | Resultado                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `source_repositories`  | id, owner, name, canonical_url, default_branch                                                                                  | `:95-99` + `UNIQUE(owner,name)` `:101`                                                                                                               | OK (unique no documentado, inocuo) |
| `source_snapshots`     | id, repository_id, ref, commit_sha, imported_at, status                                                                         | `:106-120` + `UNIQUE`, `CHECK status` `:122-129` (documentado en M1 `DATA_MODEL.md:149-163`)                                                         | OK                                 |
| `source_files`         | id, snapshot_id, path, blob_sha, language, media_type, raw_content nullable, binary_reference nullable + unique (snapshot,path) | `:136-147` + `language_evidence` `:144` + `CHECK` exactamente uno `:150-153` + unique `:149`                                                         | OK                                 |
| `source_projects`      | id, snapshot_id, source_path, canonical_order nullable, title, preferred_readme_path, metadata jsonb                            | `:165-178` + `language`, `language_evidence` (`:173-174`, documentado en `DATA_MODEL.md:165-176`)                                                    | OK                                 |
| `source_contexts`      | id, snapshot_id, source_path, title nullable, language, metadata jsonb                                                          | `:196-208`: añade `preferred_readme_path` `:202` **no documentado**; `language_evidence` documentado                                                 | **F-02**                           |
| `source_lessons`       | id, snapshot_id, source_path, title, language, metadata jsonb                                                                   | `:226-238`: añade `preferred_readme_path` `:232` **no documentado**; `language_evidence` documentado; `title` es nullable aunque no lo marque el doc | **F-02**                           |
| `source_import_errors` | id, snapshot_id, source_path nullable, error_kind, message, detail jsonb nullable, created_at (M1 `:131-147`)                   | `:255-266` + `CHECK error_kind`, índice por snapshot `:268-274`                                                                                      | OK                                 |

No se ha creado ninguna tabla fuera del modelo. Las tablas de `source_relations`, `user_*` y `ai_*` permanecen ausentes (correcto para M1).

### 6.3 M1_AUDIT_PLAN vs implementado

Desviaciones detectadas (todas razonables, pero no registradas → **F-04**):

| Plan (`M1_AUDIT_PLAN.md`)                                        | Implementado                                                                                         | Valoración                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SourceReader.resolveRepository()` / `getTarball()` (`:280-294`) | `getRepository()` / `readFile()` (`types.ts:278-283`)                                                | Renombrado coherente con tarball+raw; sin impacto                                               |
| `validate/fixtures.ts` dedicado (`:252`)                         | Verificación en `src/test/source-fixtures.ts` (reutilizada también por producción → F-03)            | Desviación de capas                                                                             |
| `store/<impl>.ts` + `InMemorySourceStore` (`:255,324`)           | `store/postgres-store.ts`; tests con PGlite real                                                     | Mejor cobertura que un fake en memoria                                                          |
| `--dry-run` «sin persistir» (`:265`)                             | Ingesta completa contra PGlite en memoria (`cli.ts:72-83,130-133`)                                   | Más fiel (prueba migraciones/Escrituras reales sin tocar la nube); documentado en el propio CLI |
| `source_contexts` «22 carpetas + contextos raíz» (`:220`)        | Solo directorios de primer nivel; `content/contexts/README*.md` queda como `source_files` auxiliar   | Índice mínimo aceptable en M1; ver F-07                                                         |
| Reconciliación de conteos como test opcional (`:428`)            | No hay test de conteos contra upstream en CI; sí smoke opt-in (`smoke.test.ts`, skipped por defecto) | Aceptable; ver BACKLOG                                                                          |

Reconciliación independiente del corpus real con el **código real** (comando `tsx` de solo lectura sobre el árbol upstream pinneado, sin red adicional):

- Blobs por root: `content/projects=625`, `content/contexts=264`, `content/lessons=10` (total 899), idéntico a `M1_AUDIT_PLAN.md:88-93`.
- Índices: `buildSourceProjects=84`, `buildSourceContexts=22`, `buildSourceLessons=5`, todos con `title=null` y `canonicalOrder=null`, idéntico a `M1_AUDIT_PLAN.md:216-221`.
- Árbol completo: 1355 entradas, 948 blobs, 407 trees, `truncated=false`, sin symlinks ni submódulos (modos `100644` ×946 y `100755` ×2), idéntico a `M1_AUDIT_PLAN.md:79-84`.
- 4 de 22 contextos no tienen documento preferido directo (ver F-07), consistente con su estructura anidada real (no es una invención del código).

## 7. Hallazgos

### F-01 — `DATABASE_URL` puede imprimirse en `db:migrate` (bloqueante, seguridad)

- **Ubicación:** `platform/src/source/store/migrate.ts:43-49`.
- **Descripción:** el `catch` final usa `console.error(error)`. Si `DATABASE_URL` no es una URL válida, `pg-connection-string` lanza `TypeError [ERR_INVALID_URL]`, cuyo objeto `input` contiene la cadena completa (incluida la contraseña) y `console.error` la muestra.
- **Reproducción:** `node -e 'try{new URL("postgresql://user:supersecret@")}catch(e){console.error(e)}'` imprime `input: 'postgresql://user:supersecret@'`. En el flujo real: `platform/.env.local` con una `DATABASE_URL` malformada → `npx --yes pnpm@12.8.1 --dir platform db:migrate`.
- **Corrección propuesta:** extraer `redactSecrets`/`describeError` de `cli.ts:46-60` a un módulo compartido (`src/lib/`) y aplicarlo en `migrate.ts` (`console.error(redactSecrets(describeError(error), process.env))`). Como defensa en profundidad, aplicar la misma redacción a la salida de `printSummary` (`cli.ts:96-104,155`), que hoy imprime los mensajes de `source_import_errors` sin redactar.

### F-02 — `DATA_MODEL.md` desalineado con el esquema en contextos/lecciones (menor, documental)

- **Ubicación:** `DATA_MODEL.md:47-63` vs `platform/src/source/store/schema.ts:202,232`.
- **Descripción:** `preferred_readme_path` existe en `source_contexts` y `source_lessons` (y en la migración SQL `:42,48`) pero no está documentado. Además `title` se muestra nullable en contextos pero no en proyectos/lecciones, aunque el esquema lo permite y M1 escribe `null` (sancionado por `M1_AUDIT_PLAN.md:219-221`).
- **Reproducción:** `git diff DATA_MODEL.md` + comparación de columnas de la tabla 6.2.
- **Corrección propuesta:** añadir `preferred_readme_path` a contextos/lecciones y marcar `title` como nullable en las cuatro entidades (o documentar explícitamente el `null` de M1). La columna `UNIQUE(owner,name)` de `source_repositories` también puede documentarse.

### F-03 — Código de producción importa utilidades de `src/test/` (menor, diseño)

- **Ubicación:** `platform/src/source/validate/snapshot.ts:1` y `platform/src/source/fixture-reader.ts:23` importan `../../test/source-fixtures` / `../test/source-fixtures`.
- **Descripción:** `computeGitBlobSha` y el parser/verificador del manifiesto viven bajo `src/test/` y son dependencias de ejecución del importador (`validateBlobContent`) y del reader de fixtures. Mezcla capas productivas y de test; `M1_AUDIT_PLAN.md:252` preveía `validate/fixtures.ts`.
- **Reproducción:** grep de imports desde `platform/src/source/**` hacia `test/`.
- **Corrección propuesta:** mover `computeGitBlobSha` y el parseo del manifiesto a un módulo no-test (p. ej. `platform/src/source/fixtures/`) y reexportarlos desde `src/test/source-fixtures.ts` para no romper tests.

### F-04 — Desviaciones del plan no registradas (menor, coherencia)

- **Ubicación:** tabla 6.3; plan en `docs/milestones/M1_AUDIT_PLAN.md:241-267,404-420`.
- **Descripción:** renombres de interfaz, sustitución de `InMemorySourceStore` por PGlite, ausencia de `validate/fixtures.ts` y semántica real de `--dry-run` no quedan documentadas en ningún artefacto de cierre.
- **Corrección propuesta:** registrar las desviaciones en el informe de cierre o en una nota al plan; no requiere cambios de código.

### F-05 — Reintentar un snapshot `failed` duplica errores (sugerencia, idempotencia)

- **Ubicación:** `platform/src/source/ingest/ingest.ts:455-460` (reutiliza el snapshot `failed` y lo pasa a `importing`) y `:529-531` (`insertImportErrors` sin deduplicación); tabla sin unique (`store/schema.ts:253-275`).
- **Descripción:** dos intentos fallidos del mismo commit sobre el mismo snapshot insertan dos veces las mismas filas de error. Los `complete`/`complete_with_errors` sí son no-op, así que AC-1.11 no se incumple, pero los conteos de errores dejan de ser idempotentes.
- **Corrección propuesta:** al reintentar, borrar los errores previos del propio snapshot o usar una clave única (p. ej. `snapshot_id + source_path + error_kind + message`) con `ON CONFLICT DO NOTHING`; o documentar el comportamiento.

### F-06 — El guard AC-0.10 no escanea `.yaml/.yml/.sql/.example` (sugerencia, cobertura)

- **Ubicación:** `platform/src/test/catalog-denylist.ts:26-36` (`SCANNED_EXTENSIONS`).
- **Descripción:** un nombre del catálogo en `platform/pnpm-workspace.yaml`, en `platform/drizzle/*.sql` o en `.env.example` no sería detectado. Hoy no hay ninguno (verificación manual: 0 hits), pero el fail-closed depende de esta allowlist.
- **Corrección propuesta:** añadir `.yaml`, `.yml` y `.sql` a `SCANNED_EXTENSIONS`.

### F-07 — 4/22 contextos sin documento preferido directo (sugerencia, H2)

- **Ubicación:** `platform/src/source/classify/paths.ts:124-138` (solo hijos directos) y `platform/src/source/classify/indexes.ts:104-150`.
- **Descripción:** `content/contexts/06-telemetry-data-pipelines`, `08-agent-engineering`, `10-realtime` y `sales-forecasting` tienen sus `CONTEXT-*.md` en subdirectorios, por lo que `preferredReadmePath` y `language` del contexto quedan `null` aunque `metadata.contextDocumentPaths` los inventaría (los `source_files` sí llevan su idioma correcto). No incumple AC-1.6/1.10, pero H2 necesitará una preferencia recursiva.
- **Corrección propuesta:** aceptar como comportamiento de M1 y anotarlo como entrada de H2; opcionalmente elegir el primer documento recursivo en `metadata`.

### F-08 — `cli.ts` importa `@electric-sql/pglite` (devDependency) siempre (sugerencia, dependencias)

- **Ubicación:** `platform/src/source/cli.ts:20` (import estático) y `platform/package.json:32` (devDependency).
- **Descripción:** aunque `--dry-run` sea una utilidad de desarrollo, el import estático hace que el modo real exija devDependencies instaladas.
- **Corrección propuesta:** `await import("@electric-sql/pglite")` dentro de `createDryRunStore()` (y `drizzle-orm/pglite`) para que el modo real no cargue PGlite.

### F-09 — `GITHUB_REPO` sin validación de caracteres (sugerencia, hardening)

- **Ubicación:** `platform/src/source/github/reader.ts:111-124,640`.
- **Descripción:** `owner`/`name` se interpolan en la URL de la API sin validar el charset; es entrada de operador (`.env`), no de usuario, por lo que el riesgo es bajo.
- **Corrección propuesta:** validar `^[A-Za-z0-9._-]+$` en `parseRepositorySlug`.

### F-10 — Cierre documental pendiente del Hito 1 (menor, cierre)

- **Ubicación:** `STATUS.md:7-21` («IN_PROGRESS — auditoría y plan»), `docs/milestones/M1_INGESTION.md:9-21` (13 AC sin marcar), `platform/README.md:29-39,94-107` (solo comandos y alcance de M0; no documenta `ingest`, `db:migrate`, `--dry-run` ni `--json`).
- **Descripción:** es coherente con que el cierre de hito esté fuera del alcance de los workers (`M1_AUDIT_PLAN.md:402` y `ORCA.md:88-96`), pero el hito no puede declararse cerrado sin actualizar estos tres documentos.
- **Corrección propuesta:** al cierre: marcar AC con su evidencia, actualizar `STATUS.md` y añadir los comandos de M1 a `platform/README.md`.

---

## 8. Verificación de AC-1.1..AC-1.13

| AC      | Evidencia principal                                                                                                                           | Estado |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-1.1  | `types.ts:22-28`; `reader.ts:461-488`; `ingest.ts:201-222` (repo pedido ≠ servido falla); test `ingest.test.ts:529-541`; `.env.example:13-15` | OK     |
| AC-1.2  | `reader.ts:495-519` (`default_branch`); `ingest.ts:423`; snapshot guarda `ref` (`schema.ts:111`)                                              | OK     |
| AC-1.3  | `reader.ts:521-551` (SHA-1 40 hex); `ingest.ts:424-430`; tests `reader.test.ts`                                                               | OK     |
| AC-1.4  | `reader.ts:700-710` (`truncated=true` → `TreeTruncatedError`); `validate/snapshot.ts:14-28`; test `ingest.test.ts:491-511`                    | OK     |
| AC-1.5  | `ingest.ts:307-310`; `indexes.ts:38-97`; corpus real: 625 blobs / 84 índices                                                                  | OK     |
| AC-1.6  | `ingest.ts:307-310`; `indexes.ts:104-150`; corpus real: 264 blobs / 22 índices                                                                | OK     |
| AC-1.7  | `ingest.ts:307-310`; `indexes.ts:157-189`; corpus real: 10 blobs / 5 índices                                                                  | OK     |
| AC-1.8  | `validate/snapshot.ts:40-59`; `ingest.ts:327-335`; `git hash-object` de los 11 fixtures == manifiesto == upstream                             | OK     |
| AC-1.9  | `ingest.ts:340-365`; test byte-idéntico `ingest.test.ts:258-269`; binarios con `binaryReference` pinneada (`ingest.ts:229-242`)               | OK     |
| AC-1.10 | `classify/paths.ts:44-84`; matriz de idioma `ingest.test.ts:272-291`; `CHECK` en BD (`schema.ts:74-90`)                                       | OK     |
| AC-1.11 | `ingest.ts:432-453`; `UNIQUE` (`schema.ts:122-125,149`); tests `ingest.test.ts:374-410` y `postgres-store.test.ts:301-316,474-529`            | OK     |
| AC-1.12 | Manifiesto + 11/11 verificados (sección 3); guard AC-0.10 verde                                                                               | OK     |
| AC-1.13 | `ingest.ts:316-335,350-365,394-408,509-534`; ADR-011; tests `ingest.test.ts:412-490`                                                          | OK     |

## 9. Comandos ejecutados (evidencia reproducible)

| Comando                                                                             | Resultado                                                                   |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npx --yes pnpm@12.8.1 --dir platform test`                                         | 18 archivos pasados, 1 skipped (smoke opt-in); 187 tests pasados, 1 skipped |
| `npx --yes pnpm@12.8.1 --dir platform lint`                                         | Sin errores                                                                 |
| `npx --yes pnpm@12.8.1 --dir platform typecheck`                                    | Sin errores (`next typegen` + `tsc --noEmit`)                               |
| `npx --yes prettier@3.8.3 --check .` en `platform/`                                 | «All matched files use Prettier code style!»                                |
| `git hash-object <fixture>` × 11 + manifiesto                                       | 11/11 coincidencias exactas                                                 |
| `gh api .../git/trees/962c1e5...?recursive=1`                                       | `truncated=false`, 1355 entradas, 948 blobs, 407 trees                      |
| `tsx` (solo lectura) con `buildSourceProjects/Contexts/Lessons` sobre el árbol real | 84/22/5, `title=null`, `canonicalOrder=null`                                |
| Conteo de blobs por root sobre el árbol real                                        | 625/264/10 = 899                                                            |
| Escaneo manual de nombres del catálogo en `.sql/.yaml/.example` y dirs nuevos       | 0 hits                                                                      |

## 10. Candidatas a BACKLOG (no implementadas)

- Alta automática de fixtures con contraste upstream (protocolo manual de ADR-009 automatizable).
- Semántica de reintento de snapshots `failed` y deduplicación de `source_import_errors` (F-05).
- Preferencia recursiva de documento para contextos anidados en H2 (F-07).
- Ampliación de `SCANNED_EXTENSIONS` del guard (F-06) y dynamic import de PGlite (F-08).
- Test de reconciliación de conteos contra commit pinneado en CI (hoy smoke manual opt-in).
- Validación de charset de `GITHUB_REPO` (F-09).

---

## Re-QA tras correcciones (M1-RQ)

- **Fecha:** 2026-10-02. Tarea `[M1-RQ]`, QA independiente posterior a M1-FX-SEC, M1-FX-ARCH y M1-FX-DOC. READ-ONLY: el único artefacto escrito es esta sección.
- **Rama y HEAD:** `m1-ingestion`; HEAD `3f98e4dcfb44fe70a68e715e88c373a09bfb2d0e` (las correcciones viven en el working tree).
- **Fuente:** `4GeeksAcademy/ai-engineering-syllabus`; `main` sigue en `962c1e5fc8ebad273abaa348fb3d161568ce8707` (`git ls-remote ... refs/heads/main`), el mismo commit pinneado en `platform/fixtures/source/manifest.json`.
- **Restricciones respetadas:** sin conexión a Supabase; `db:migrate` solo con una `DATABASE_URL` falsa malformada; `ingest` solo con `--dry-run`; sin restos temporales en el repo (el directorio temporal de verificación se eliminó al cerrar).
- **Baseline git al empezar:** ` M BACKLOG.md`, ` M DATA_MODEL.md`, ` M DECISIONS.md`, ` M STATUS.md`, ` M platform/.env.example`, ` M platform/.prettierignore`, ` M platform/README.md`, ` M platform/package.json`, ` M platform/pnpm-lock.yaml`, ` M platform/pnpm-workspace.yaml`, ` M platform/src/test/catalog-denylist.ts`, ` M platform/src/test/no-hardcoded-catalog.test.ts`, ` M platform/src/test/source-fixtures.ts`; sin seguimiento: `.mcp.json`, `docs/milestones/M1_AUDIT_PLAN.md`, `docs/milestones/M1_QA_FIDELITY.md`, `docs/milestones/M1_QA_TECHNICAL.md`, `platform/drizzle.config.ts`, `platform/drizzle/`, `platform/fixtures/`, `platform/src/lib/cli-redaction.test.ts`, `platform/src/lib/redact.test.ts`, `platform/src/lib/redact.ts`, `platform/src/source/`.
- **Veredicto:** **0 bloqueantes, 0 menores nuevos y 2 sugerencias nuevas**; las 13 correcciones verificables (F-01..F-10, H-1..H-3) están resueltas o diferidas a `BACKLOG.md` con línea, y el gate + la regresión funcional siguen verdes.

### 1. Gate desde limpio

Se borraron los artefactos ignorados (`platform/.next`, `platform/node_modules`, `platform/next-env.d.ts`, `platform/tsconfig.tsbuildinfo`) antes de empezar. Cada paso es un comando real, con su código de salida literal.

| #   | Comando                                                                                            | Exit | Extracto literal                                                                                    |
| --- | -------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| 1   | `rm -rf platform/.next platform/node_modules platform/next-env.d.ts platform/tsconfig.tsbuildinfo` | 0    | `artifacts removed`                                                                                 |
| 2   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile`                                   | 0    | `Packages: +759` ... `Done in 1.3s using pnpm v12.8.1`                                              |
| 3   | `npx --yes pnpm@12.8.1 --dir platform lint`                                                        | 0    | `$ eslint .` (sin diagnósticos)                                                                     |
| 4   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                                                   | 0    | `$ next typegen && tsc --noEmit` → `Generating route types...` `✓ Types generated successfully`     |
| 5   | `npx --yes pnpm@12.8.1 --dir platform test`                                                        | 0    | `Test Files 20 passed \| 1 skipped (21)` · `Tests 210 passed \| 1 skipped (211)` · `Duration 1.55s` |
| 6   | `npx --yes pnpm@12.8.1 --dir platform build`                                                       | 0    | `✓ Compiled successfully in 1128ms`; `Route (app)`: `/` y `/_not-found` estáticas                   |
| 7   | `cd platform && npx --yes prettier@3.8.3 --check .`                                                | 0    | `Checking formatting...` `All matched files use Prettier code style!`                               |

La suite creció de 18 archivos/187 tests (QA original) a 20 archivos/210 tests por las correcciones
(`platform/src/lib/redact.test.ts` y `platform/src/lib/cli-redaction.test.ts`). El único test omitido
sigue siendo el smoke real opt-in (`platform/src/source/github/smoke.test.ts:27-28`:
`SOURCE_READER_SMOKE === "1"`), comportamiento previsto.

### 2. F-01 reproducido — `DATABASE_URL` falsa malformada

**Método de aislamiento:** `platform/.env.local` existe (98 B, ignorado por
`platform/.gitignore:27:.env*`) y no se leyó su contenido. Node da prioridad a las variables del
proceso sobre `--env-file-if-exists`; comprobado con el archivo real presente y ejecutando desde
`platform/`:

```sh
DATABASE_URL='postgresql://u:FAKE_pw_999@' npx --yes pnpm@12.8.1 exec tsx \
  --env-file-if-exists=.env.local -e 'process.stdout.write(String(process.env.DATABASE_URL === "postgresql://u:FAKE_pw_999@"))'
# salida: fake-is-effective-with-real-envlocal=true
```

(Nota de método: `pnpm --dir platform exec` no cambia el cwd, pero `pnpm --dir platform <script>` sí
ejecuta el script con cwd `platform/`; por eso en la prueba anterior se invocó desde `platform/`.)

**Vector original (sigue siendo real si se imprime el error crudo):**

```sh
node -e 'try{new URL("postgresql://u:FAKE_pw_999@")}catch(e){console.error(e)}'
# TypeError: Invalid URL ... { code: 'ERR_INVALID_URL', input: 'postgresql://u:FAKE_pw_999@' }
```

**Flujo real, sin conectar a Supabase** (la URL malformada falla al parsearse antes de cualquier
socket; el `Pool` de `pg` solo parsea al conectar):

```sh
DATABASE_URL='postgresql://u:FAKE_pw_999@' npx --yes pnpm@12.8.1 --dir platform db:migrate
# exit 1
```

Extracto literal de la salida (stdout+stderr), con la contraseña ya enmascarada:

```text
Error: Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"
...
cause=TypeError: Invalid URL
...
code=ERR_INVALID_URL
input=*****REDACTED*****
base=postgres://base
[ELIFECYCLE] Command failed with exit code 1.
```

- `grep -c 'FAKE_pw_999'` sobre stdout+stderr → **0 hits**.
- Matiz de defensa en profundidad: `pg-connection-string@2.14.1` (`platform/pnpm-lock.yaml:4341`) ya
  sustituye `err.input` por `*****REDACTED*****` al re-lanzar; la garantía de la aplicación es
  `describeError`/`redactSecrets` (`platform/src/lib/redact.ts:31-47`), aplicada en
  `platform/src/source/store/migrate.ts:24,54` y en `platform/src/source/cli.ts:25,95,150,170`, y
  verificada de forma independiente del comportamiento de la librería por
  `platform/src/lib/redact.test.ts:50-58` (constructo del `TypeError` crudo), `:60-70` (`cause`) y
  `:82-91` (stack).
- `ingest --dry-run --json` (salida completa en §4) no contiene credenciales; los errores del CLI
  (`--repo 'bad/extra/slug'`, `--commit zzz`, `--bogus-flag`) terminan con exit 2 e imprimen solo
  repo/URL/estado, sin secretos. Los casos con secretos en `source_import_errors` y en el `catch`
  están cubiertos por `platform/src/lib/cli-redaction.test.ts:128-154,156-172,174-191`.

### 3. Estado de F-01..F-10 (M1_QA_FIDELITY) y H-1..H-3 (M1_QA_TECHNICAL)

| ID   | Sev. (original) | Estado                 | Evidencia                                                                                                                                                                                                                                                            |
| ---- | --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | bloqueante      | **Resuelto**           | §2; `platform/src/lib/redact.ts:31-47`; `store/migrate.ts:24,54`; `cli.ts:25,95,150,170`; tests `redact.test.ts:50-91` y `cli-redaction.test.ts:128-191`.                                                                                                            |
| F-02 | menor           | **Resuelto**           | `DATA_MODEL.md:13,21-26,35-46,56-64,71-79,86-94,162-238`; comparación columna a columna en §5 sin diferencias.                                                                                                                                                       |
| F-03 | menor           | **Resuelto**           | Implementación en `platform/src/source/fixtures/` (`git-blob.ts:7`, `manifest.ts:164,235`, `index.ts:1-14`); producción importa `validate/snapshot.ts:1` (`../fixtures`) y `fixture-reader.ts:20-23` (`./fixtures`); `src/test/source-fixtures.ts:1-19` es reexport. |
| F-04 | menor           | **Resuelto**           | `docs/milestones/M1_AUDIT_PLAN.md:434-474` (§11: 11 desviaciones y correcciones de QA registradas).                                                                                                                                                                  |
| F-05 | sugerencia      | **Diferido a BACKLOG** | `BACKLOG.md:52-54`; sin cambios en código (`ingest.ts:511,530` inserta errores; `store/schema.ts:253-275` sin `UNIQUE`).                                                                                                                                             |
| F-06 | sugerencia      | **Resuelto**           | `platform/src/test/catalog-denylist.ts:26-40` escanea ya `.yaml`, `.yml`, `.sql` y `.example`; guard AC-0.10 verde en la suite (210 tests).                                                                                                                          |
| F-07 | sugerencia      | **Diferido a BACKLOG** | `BACKLOG.md:59-61` (preferencia recursiva de contexto, H2).                                                                                                                                                                                                          |
| F-08 | sugerencia      | **Resuelto**           | `platform/src/source/cli.ts:56-72` (`import()` dinámico dentro de `createDryRunStore`); `cli-redaction.test.ts:151-153` (modo real no carga PGlite) y `:193-206` (`--dry-run` sí).                                                                                   |
| F-09 | sugerencia      | **Resuelto**           | `platform/src/source/github/reader.ts:111-121,137-145` (`^[A-Za-z0-9._-]+$`, rechaza `.`/`..`); tests `reader.test.ts:87-121`.                                                                                                                                       |
| F-10 | menor           | **Parcial**            | `platform/README.md:92-125` documenta `db:migrate`, `ingest`, `--dry-run` y `--json`; `STATUS.md:7-9` sigue `IN_PROGRESS` y `M1_INGESTION.md:9-21` tiene los 13 AC sin marcar: es el cierre de hito, fuera de workers (`ORCA.md:88-96`).                             |
| H-1  | sugerencia      | **Resuelto**           | Igual que F-03.                                                                                                                                                                                                                                                      |
| H-2  | sugerencia      | **Diferido a BACKLOG** | `BACKLOG.md:65-66` (previsualización/`--dry-run` de `db:migrate`).                                                                                                                                                                                                   |
| H-3  | sugerencia      | **Diferido a BACKLOG** | `BACKLOG.md:67-69`; el smoke sigue gated en `platform/src/source/github/smoke.test.ts:27-28` y la suite reporta 1 skipped.                                                                                                                                           |

**Grep de capas (F-03/H-1):** `grep -rn "test/" platform/src/source --include="*.ts"` excluyendo
`*.test.ts` y `*.test-helper.ts` → **sin resultados**. El único archivo no-test que importa de
`src/test/` es `platform/src/source/classify/fixture-tree.test-helper.ts:9`
(`../../test/source-fixtures`), y es legítimo: es un helper de desarrollo (sufijo `*.test-helper.ts`)
que solo consumen archivos de test (`indexes.test.ts`, `media.test.ts`, `ingest.test.ts`,
`validate/fixtures.test.ts`) y ningún módulo de producción lo importa. También `platform/src/lib`,
`platform/src/app` y `platform/src/components` carecen de imports desde `test/`.

### 4. Regresión funcional (`ingest --dry-run --json` contra GitHub)

`main` sigue en `962c1e5...`, por lo que la comparación es determinista:

```sh
npx --yes pnpm@12.8.1 --dir platform ingest --dry-run --json
# exit 0
```

Salida literal (resumida a las claves de reconciliación):

```json
{
  "dryRun": true,
  "repository": "4GeeksAcademy/ai-engineering-syllabus",
  "ref": "main",
  "commit": "962c1e5fc8ebad273abaa348fb3d161568ce8707",
  "snapshotId": "ad554d41-c380-4d0a-9224-4474036b4380",
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

| Métrica                               | QA original (M1_QA_TECHNICAL §3.7) | Re-QA M1-RQ          | ¿Coincide? |
| ------------------------------------- | ---------------------------------- | -------------------- | ---------- |
| Blobs de contenido                    | 899                                | 899                  | Sí         |
| `content/projects`                    | 625                                | 625                  | Sí         |
| `content/contexts`                    | 264                                | 264                  | Sí         |
| `content/lessons`                     | 10                                 | 10                   | Sí         |
| Textuales / binarios                  | 781 / 118                          | 781 / 118            | Sí         |
| Índices proyectos/contextos/lecciones | 84 / 22 / 5                        | 84 / 22 / 5          | Sí         |
| Errores registrados                   | 0                                  | 0                    | Sí         |
| `status` / `noop`                     | `complete` / `false`               | `complete` / `false` | Sí         |

Los 11 fixtures se re-verificaron además con `git hash-object` contra
`platform/fixtures/source/manifest.json`: **11/11 OK** (mismos `blob_sha` que la tabla de §3), por
lo que AC-1.12 y el guard AC-0.10 siguen intactos.

### 5. `DATA_MODEL.md` vs `schema.ts` vs migración SQL (columna a columna)

Comparación literal de los tres artefactos. No hay ninguna columna, `UNIQUE`, `CHECK`, default,
índice o FK en el esquema real que no esté documentada, ni al revés.

| Tabla                  | `DATA_MODEL.md`                                                                                                                                                                                                                                                    | `schema.ts`                                                  | Migración `0000_*.sql`     | Resultado       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------- | --------------- |
| `source_repositories`  | id, owner, name, canonical_url, default_branch; `UNIQUE(owner,name)` (`:3-13`)                                                                                                                                                                                     | `:92-102`                                                    | `:72-81`                   | Sin diferencias |
| `source_snapshots`     | id, repository_id, ref, commit_sha, imported_at `NOT NULL DEFAULT now()`, status `NOT NULL DEFAULT 'importing'`; `UNIQUE(repository_id,commit_sha)`; `CHECK` 4 estados (`:15-26,181-195`)                                                                          | `:104-131`                                                   | `:82-93`                   | Sin diferencias |
| `source_files`         | id, snapshot_id, path, blob_sha, media_type, language nullable, language_evidence nullable, raw_content nullable, binary_reference nullable; `UNIQUE(snapshot_id,path)`; `CHECK` exactamente uno; `CHECK` idioma (`:28-46,197-208`)                                | `:133-160`                                                   | `:15-30`                   | Sin diferencias |
| `source_projects`      | id, snapshot_id, source_path, canonical_order nullable, title nullable, preferred_readme_path nullable, language nullable, language_evidence nullable, metadata `jsonb NOT NULL DEFAULT '{}'::jsonb`; `UNIQUE(snapshot_id,source_path)`; `CHECK` idioma (`:48-64`) | `:162-191`                                                   | `:57-71`                   | Sin diferencias |
| `source_contexts`      | id, snapshot_id, source_path, title nullable, preferred_readme_path nullable, language nullable, language_evidence nullable, metadata ...; `UNIQUE(snapshot_id,source_path)`; `CHECK` idioma (`:66-79`)                                                            | `:193-221`                                                   | `:1-14`                    | Sin diferencias |
| `source_lessons`       | id, snapshot_id, source_path, title nullable, preferred_readme_path nullable, language nullable, language_evidence nullable, metadata ...; `UNIQUE(snapshot_id,source_path)`; `CHECK` idioma (`:81-94`)                                                            | `:223-251`                                                   | `:43-56`                   | Sin diferencias |
| `source_import_errors` | id, snapshot_id, source_path nullable, error_kind, message, detail jsonb nullable, created_at; `CHECK` 9 tipos; índice por snapshot (`:162-179`)                                                                                                                   | `:253-275`                                                   | `:31-42,96,100`            | Sin diferencias |
| Transversal            | FK `RESTRICT`, RLS en las 7 tablas, títulos siempre `NULL` en M1, `language_evidence` de ADR-012, ausencia de `source_relations`/`user_*`/`ai_*` (`:210-241`)                                                                                                      | `:39-56,102,110,131,139,160,168,191,199,221,229,251,259,275` | `:14,30,42,56,71,81,93-99` | Sin diferencias |

La migración sigue siendo exactamente el SQL generado por `drizzle-kit` a partir de `schema.ts`
(mismos tipos, orden de columnas y nombres de constraints); el `CHECK` de idioma se genera desde
`SOURCE_LANGUAGE_ASSIGNMENTS` (`schema.ts:52-90`) y el de `error_kind` desde `SOURCE_IMPORT_ERROR_KINDS`
(`types.ts`), sin literales duplicados.

### 6. Hallazgos nuevos

**Bloqueantes: 0. Menores: 0. Sugerencias: 2.**

#### N-01 (sugerencia) — La redacción de `migrate.ts` no tiene test propio

- **Ubicación:** `platform/src/source/store/migrate.ts:49-56`.
- **Descripción:** `describeError` está cubierto a fondo y el `runIngestCli` tiene tests de
  redacción, pero ningún test importa ni ejecuta el migrador: una futura edición del `catch` podría
  reintroducir `console.error(error)` sin que la suite lo detecte. La reproducción manual de §2 sí lo
  cubre hoy.
- **Evidencia:** `grep -rn "store/migrate" platform/src --include="*.test.ts"` → sin resultados.
- **Corrección propuesta:** extraer el cuerpo del `main()`/`catch` a una función exportada y
  testearla con un error que contenga la `DATABASE_URL` (o un test estático equivalente).

#### N-02 (sugerencia) — La máscara de URIs no cubre contraseñas con `/`

- **Ubicación:** `platform/src/lib/redact.ts:28` (`URI_CREDENTIALS`, `[^/\s]+` como contraseña).
- **Descripción:** si el secreto no es el valor exacto de `DATABASE_URL`/`GITHUB_TOKEN` (p. ej. otra
  URI con credenciales embebida en un mensaje), una contraseña con `/` sin percent-encode no se
  enmascara:
  `redactSecrets("fallo: postgresql://u:pa/ss@host/db", {})` → `fallo: postgresql://u:pa/ss@host/db`
  (la variante `p%2Fss` sí queda como `***`).
- **Impacto:** bajo: el caso principal (`DATABASE_URL`) se cubre por sustitución exacta del valor de
  entorno, y las URIs reales codifican `/` como `%2F`. Es una brecha de defensa en profundidad, no
  un leak del flujo verificado.
- **Corrección propuesta:** percent-decodificar candidatos antes de aplicar la máscara, o ampliar
  `URI_CREDENTIALS` para aceptar `/` en la contraseña hasta la última `@` del `authority`.

### 7. Conclusión del Re-QA

El gate completo desde limpio (install frozen, lint, typecheck, 210 tests, build, prettier) pasa, la
regresión contra GitHub reproduce los conteos exactos de la QA original (899/625/264/10;
781/118; 84/22/5; 0 errores) y la fila de F-01 queda cerrada con evidencia literal: con una
`DATABASE_URL` falsa malformada, `FAKE_pw_999` no aparece en stdout ni stderr de `db:migrate`.
`DATA_MODEL.md` coincide columna a columna con `schema.ts` y la migración SQL. De F-01..F-10 y
H-1..H-3, 8 están resueltos, 4 diferidos a `BACKLOG.md` (con línea) y F-10 queda parcialmente
pendiente del cierre de hito. **Sin bloqueantes nuevos ni menores nuevos**; las dos sugerencias
N-01/N-02 son mejoras de robustez de la redacción y candidatas a `BACKLOG.md`.
