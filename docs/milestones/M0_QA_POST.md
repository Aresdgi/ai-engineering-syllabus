# M0-QA-POST — QA independiente de P0-CI y P0-FX

- Fecha: 2026-10-02
- Repo: `/Users/aresdominguezgil/orca/ai-engineering-syllabus` (branch local `m0-foundation`)
- HEAD auditado: `116f4381170c3c6e3118aa5b097a044cd448fc27` (Hito 0)
- Alcance: P0-CI (`.github/workflows/platform-ci.yml`, `.prettierignore` raíz) y P0-FX (fixtures fuente en `platform/src/test/*`, ADR-009, sección de fixtures de `platform/README.md`)
- Modo: READ-ONLY. El único archivo creado es este informe. No se corrigió ningún hallazgo.
- Entorno: macOS (darwin), Node `v26.10.0` (y `v24.21.0` vía `npx node@24`), npm `11.19.1`, pnpm `12.8.1` vía `npx --yes pnpm@12.8.1`.
- Restricción de contenido: el informe redacta con `<...>` cualquier nombre de entidad del syllabus (proyectos, contextos, empresas, lecciones) para no reproducir contenido educativo.

## Resumen ejecutivo

| Área                                             | Veredicto                             |
| ------------------------------------------------ | ------------------------------------- |
| 1. Gate completo desde limpio en `platform/`     | PASS (6/6 comandos en 0)              |
| 2. Workflow CI (YAML, acciones, permisos, paths) | PASS                                  |
| 3. Prettier raíz (`prettier --check .`)          | FAIL preexistente (235 archivos)      |
| 4. Política de fixtures (4 casos + blob SHA)     | PASS (reproducida independientemente) |
| 5. ADR-009, README y ownership                   | PASS con 2 matices documentales       |

**Bloqueantes: 0.** Hallazgos: 2 menores y 4 sugerencias/informativos (sección 6).

---

## 1. Gate completo desde limpio en `platform/`

Estado de partida: se eliminaron `platform/node_modules`, `platform/.next` y `platform/tsconfig.tsbuildinfo` (`CLEANED`). Todos los comandos desde la raíz salvo donde se indique.

```sh
npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile
npx --yes pnpm@12.8.1 --dir platform lint
npx --yes pnpm@12.8.1 --dir platform typecheck
npx --yes pnpm@12.8.1 --dir platform test
npx --yes pnpm@12.8.1 --dir platform build
cd platform && npx --yes prettier@3.8.3 --check .
```

| #   | Comando                                 | Exit | Extracto literal                                                |
| --- | --------------------------------------- | ---- | --------------------------------------------------------------- |
| 1   | `install --frozen-lockfile`             | 0    | `Lockfile is up to date, resolution step is skipped`            |
| 2   | `lint`                                  | 0    | `$ eslint .` (sin errores)                                      |
| 3   | `typecheck`                             | 0    | `✓ Types generated successfully`                                |
| 4   | `test`                                  | 0    | `Test Files 4 passed (4)` · `Tests 35 passed (35)`              |
| 5   | `build`                                 | 0    | `✓ Compiled successfully in 1331ms` · rutas `/` y `/_not-found` |
| 6   | `prettier --check .` (desde `platform`) | 0    | `All matched files use Prettier code style!`                    |

Extractos:

```text
# 1 install
✓ Lockfile passes supply-chain policies (verified 2h ago)
Lockfile is up to date, resolution step is skipped
Progress: resolved 511, reused 511, downloaded 0, added 496
Packages: +716
Done in 1.3s using pnpm v12.8.1

# 4 test
Test Files  4 passed (4)
     Tests  35 passed (35)

# 5 build
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully in 1331ms
Route (app)
┌ ○ /
└ ○ /_not-found
```

Los 35 tests incluyen los nuevos de fixtures (nombres literales de tests del reporter verbose, sin tokens del catálogo):

```text
✓ src/test/source-fixtures.test.ts > computeGitBlobSha > coincide con `git hash-object` para un archivo real de content/
✓ src/test/source-fixtures.test.ts > Fixtures fuente verificables (AC-0.10) > un fixture declarado y fiel a su blob_sha queda verificado y excluido del escaneo
✓ src/test/source-fixtures.test.ts > Fixtures fuente verificables (AC-0.10) > un archivo bajo fixtures/source que no figura en el manifiesto falla
✓ src/test/source-fixtures.test.ts > Fixtures fuente verificables (AC-0.10) > un fixture alterado en un byte no coincide con blob_sha y falla
✓ src/test/source-fixtures.test.ts > Fixtures fuente verificables (AC-0.10) > una entrada del manifiesto sin archivo falla
✓ src/test/source-fixtures.test.ts > Fixtures fuente verificables (AC-0.10) > un manifiesto inválido no excluye ningún archivo (fail-closed)
✓ src/test/source-fixtures.test.ts > Fixtures fuente verificables (AC-0.10) > sin directorio de fixtures el guard se comporta como hasta ahora
✓ src/test/no-hardcoded-catalog.test.ts > AC-0.10: no existe catálogo educativo hardcodeado > falla de forma explícita si content/ no existe (fail-closed)
```

Además se re-ejecutaron `lint`, `test`, `typecheck` y `build` bajo Node `v24.21.0` (la versión del workflow) sin reinstalar: `eslint` 0, `vitest` 35/35, `tsc --noEmit` 0 y `next build` 0. Los `engines` de las dependencias cubren Node 24 (`next@16.3.8` `>=20.9.0`, `vitest@5.0.3` `^22.12 || ^24 || >=26`, `pnpm@12.8.1` `>=18`).

## 2. Workflow `.github/workflows/platform-ci.yml`

### 2.1 YAML válido con herramientas reales

```sh
npx --yes js-yaml .github/workflows/platform-ci.yml     # exit 0
# JSON Schema oficial (SchemaStore) con ajv 8 + ajv-formats:
SCHEMA_VALID=true
```

Claves de primer nivel parseadas: `[name, on, permissions, concurrency, jobs]`. El `on` se parsea como clave string (js-yaml 4, YAML 1.2), coherente con GitHub Actions; la validación contra `https://json.schemastore.org/github-workflow.json` pasa completa.

### 2.2 Versiones de actions existentes y sus inputs

`git ls-remote --tags` sobre los repos oficiales devuelve los tags `v4` referenciados:

```text
actions/checkout    refs/tags/v4 -> 11d5960a326750d5838078e36cf38b85af677262
actions/setup-node  refs/tags/v4 -> 49933ea5288caeca8642d1e84afbd3f7d6820020
pnpm/action-setup   refs/tags/v4 -> f40ffcd9367d9f12939873eb1018b921a783ffaa (peeled b906affcce14559ad1aafd4ab0e942779e9f58b1)
```

Inputs usados, verificados contra el `action.yml` real de cada tag:

- `pnpm/action-setup@v4` con `package_json_file: platform/package.json` — el input existe y su descripción exige ruta relativa a `GITHUB_WORKSPACE`; el action leerá `"packageManager": "pnpm@12.8.1"` de `platform/package.json:5`.
- `actions/setup-node@v4` con `cache: pnpm` y `cache-dependency-path: platform/pnpm-lock.yaml` — el input existe en `action.yml`; el orden es correcto (`action-setup` corre antes que `setup-node`).
- `actions/checkout@v4` sin sparse-checkout ni `fetch-depth`, por lo que el workspace contiene el repo completo, incluido `content/`.

### 2.3 Coherencia con `platform/package.json`

Los cuatro `pnpm <script>` del workflow existen y coinciden literalmente (`platform/package.json:6-14`):

| Workflow         | `platform/package.json`                       |
| ---------------- | --------------------------------------------- |
| `pnpm lint`      | `"lint": "eslint ."`                          |
| `pnpm typecheck` | `"typecheck": "next typegen && tsc --noEmit"` |
| `pnpm test`      | `"test": "vitest run"`                        |
| `pnpm build`     | `"build": "next build"`                       |

El paso de formato usa `npx --yes prettier@3.8.3 --check .` con `working-directory: platform`, es decir el mismo comando que el paso 6 del gate (exit 0).

### 2.4 Permisos, disparadores y `content/`

- `permissions: contents: read` a nivel de workflow: mínimo necesario (checkout + cache); no hay escrituras.
- `paths` en `push` y `pull_request`: `platform/**`, `content/**` y el propio workflow. `content/**` es imprescindible: el guard AC-0.10 deriva la denylist de `content/{projects,lessons,contexts}` y es fail-closed (test en verde `falla de forma explícita si content/ no existe`).
- El job no usa checkout selectivo, por lo que obtiene `content/`; los tests de `platform/` lo leen desde `REPO_ROOT` (`platform/src/test/catalog-denylist.ts:11-18`).
- `concurrency` con cancelación por ref: comportamiento estándar, sin efecto sobre la corrección.

## 3. Prettier raíz

```sh
npx --yes prettier@3.8.3 --check .        # desde la raíz
# exit 1
[warn] Code style issues found in 235 files. Run Prettier with --write to fix.
```

Clasificación de los 235 fallos (ninguno es de `platform/` ni de un archivo tocado por P0):

| Área                                                    | Archivos |
| ------------------------------------------------------- | -------- |
| `content/`                                              | 229      |
| `marketing/`                                            | 3        |
| `.cursor/`                                              | 1        |
| `pnpm-lock.yaml` (raíz, upstream)                       | 1        |
| `docs/milestones/M0_AUDIT_PLAN.md` (local preexistente) | 1        |

Ninguna ruta aparece con prefijo `platform/` y el cruce con `git status --porcelain` (archivos P0) da intersección vacía. Son fallos preexistentes (todos trackeados en `116f438`, sin modificar), no atribuibles a P0-CI ni a P0-FX.

El residual que reportaba M0-R1 (invocación `prettier --check platform` desde la raíz fallaba por `platform/.next/` y `platform/pnpm-lock.yaml`) queda resuelto por el `.prettierignore` raíz nuevo:

```text
$ npx --yes prettier@3.8.3 --check platform     # desde la raíz
Checking formatting...
All matched files use Prettier code style!
exit 0
```

El gate raíz completo (`prettier --check .`, que es lo que ejecuta `package.json` raíz en `format:check`) sigue en rojo por los 235 preexistentes; el workflow no lo ejecuta (corre formato solo dentro de `platform/`), decisión coherente con el alcance de P0-CI.

## 4. Política de fixtures (reproducción independiente)

Método: script temporal en el directorio de trabajo externo, ejecutado con `npx --yes tsx@4`, importando las funciones reales del guard (`platform/src/test/source-fixtures.ts` y `catalog-denylist.ts`). Todos los roots de prueba se crearon en `mkdtempSync(os.tmpdir(), ...)` y se borraron al terminar. No se dejó nada en `platform/` (`platform/fixtures/` no existe al cierre; `git status` sin archivos nuevos).

Fixture real usado: un archivo de `content/` con un token real de la denylist, elegido en runtime (path y token redactados aquí como `<entidad>` por la restricción de no reproducir nombres; el blob SHA no revela el nombre).

### 4.1 `blob_sha == git hash-object`

```json
{
  "computeGitBlobSha": "9028c6a76e5fe5cd67bba4a93bf64f180e8693cc",
  "gitHashObject": "9028c6a76e5fe5cd67bba4a93bf64f180e8693cc",
  "equal": true
}
```

### 4.2 Caso válido (declarado + verbatim): pasa y queda excluido

```json
{
  "verifiedFiles": [
    "fixtures/source/<commit>/content/projects/<entidad>/README.md"
  ],
  "violations": [],
  "scanWithExclusion": [],
  "scanControlDetectsToken": true
}
```

El control (`fixturesRoot` apuntando a un directorio inexistente) vuelve a detectar el token del fixture en el escaneo de nombres: la exclusión es lo único que lo silencia, y solo con blob correcto.

### 4.3 Archivo no declarado: falla

```json
{ "kinds": ["fixture-unlisted"], "strayFlagged": true }
```

### 4.4 Fixture alterado 1 byte: falla

```json
{
  "kinds": ["fixture-modified"],
  "declaredSha": "9028c6a76e5fe5cd67bba4a93bf64f180e8693cc",
  "recomputedSha": "32714bef8a7984b4284393a1a88baeb52405fedb",
  "differ": true,
  "verifiedFiles": 0
}
```

### 4.5 Entrada del manifiesto sin archivo: falla

```json
{ "kinds": ["fixture-missing"] }
```

### 4.6 Manifiesto inválido (`path: "../evil.md"`): falla sin excluir nada

```json
[
  {
    "kind": "manifest-invalid",
    "message": "el manifiesto es inválido: fixtures[0].path contiene segmentos vacíos, '.' o '..'"
  }
]
```

Conclusión: los cuatro estados (válido, no declarado, alterado, entrada sin archivo) se comportan como declara ADR-009, y `computeGitBlobSha` coincide bit a bit con `git hash-object`. La política no deja restos temporales al ejecutar los tests (los roots van a `os.tmpdir()` y se limpian en `afterEach`).

## 5. ADR-009, README y ownership

### 5.1 Coherencia ADR-009 ↔ implementación

| Afirmación de ADR-009 (`DECISIONS.md:67-88`)                        | Implementación verificada                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fixtures en `platform/fixtures/source/<commit_sha>/<path original>` | `source-fixtures.ts:324-330` construye exactamente esa ruta y `source-fixtures.test.ts:411-435` fija el caso de commit distinto |
| Manifiesto con `repository`, `commit`, `path`, `blob_sha`           | `parseSourceFixtureManifest` exige los cuatro; `repository` debe ser el repo fuente (`source-fixtures.ts:191-198`)              |
| `blob_sha` = SHA-1 de `git hash-object`                             | `computeGitBlobSha` (`source-fixtures.ts:55-62`); reproducido contra `git hash-object` (4.1)                                    |
| No declarado / alterado / sin archivo → violación                   | Tipos `fixture-unlisted`, `fixture-modified`, `fixture-missing`; reproducidos (4.3-4.5) y cubiertos por tests                   |
| Manifiesto validado y no escaneado                                  | Validación de campos, duplicados y paths (`../`, absolutos, `\`, vacíos); `manifest.json` excluido del name-scan                |
| Solo fixtures verificados quedan excluidos                          | `scanDirectoryForCatalogTokens:227-232` usa `verifiedFiles`; el control positivo sigue detectando sin exclusión                 |

### 5.2 `platform/README.md` sin nombres del syllabus

El guard `scanForHardcodedCatalog` escanea `platform/` completo (incluido `README.md`) y está en verde en las 35/35 pruebas. Comprobación adicional independiente sobre `DECISIONS.md` (fuera del árbol que escanea el guard): 0 violaciones de `catalog-name`. La sección de fixtures usa solo placeholders (`<commit_sha>`, `<path original>`, `<git blob sha1>`).

### 5.3 Ownership (contra `116f438`)

```text
$ git status --porcelain
 M DECISIONS.md
 M platform/README.md
 M platform/src/test/catalog-denylist.ts
?? .github/
?? .prettierignore
?? platform/src/test/source-fixtures.test.ts
?? platform/src/test/source-fixtures.ts

$ git diff --stat HEAD
 DECISIONS.md                          |  23 +++++++
 platform/README.md                    |  43 ++++++++++++
 platform/src/test/catalog-denylist.ts | 121 +++++++++++++++++++++++++++++-----
 3 files changed, 170 insertions(+), 17 deletions(-)
```

Intersección exacta con el ownership declarado (P0-CI: workflow + `.prettierignore`; P0-FX: `platform/src/test/*`, ADR-009, README). `.github/` solo contiene `workflows/platform-ci.yml`. `git diff --cached` vacío. Ningún archivo raíz prohibido (package.json, pnpm-lock.yaml, .gitignore, README, content/, marketing/, assets/, .cursor/, opencode.json) aparece modificado. Este informe (`docs/milestones/M0_QA_POST.md`) es el único archivo añadido por la QA.

### 5.4 Sin restos temporales

`platform/fixtures/` no existe; no hay `fixtures/source` bajo `platform/`; los roots `qa-*` en `os.tmpdir()` fueron eliminados; `find platform -maxdepth 4 (-name '*tmp*' -o -name '*negative*' -o -name '*qa-*')` sin resultados (excluyendo `node_modules`/`.next`, que son ignorados por git).

## 6. Hallazgos numerados

### F-01 — El gate raíz de formato sigue en rojo (preexistente) — MENOR

- `npx --yes prettier@3.8.3 --check .` desde la raíz: exit 1, 235 archivos (229 `content/`, 3 `marketing/`, 1 `.cursor/`, `pnpm-lock.yaml` raíz, `docs/milestones/M0_AUDIT_PLAN.md`).
- No hay ningún archivo de `platform/` ni tocado por P0 en la lista; el `format:check` raíz ya era rojo upstream. El `.prettierignore` nuevo solo excluye artefactos de `platform/` y resuelve el residual concreto de M0-R1 (`prettier --check platform` desde la raíz ahora en 0).
- No bloquea: el workflow valida formato dentro de `platform/`. Recomendación: decidir explícitamente si `format:check` raíz se ignora, se acota con más patrones (`content/`, `marketing/`, `.cursor/`, `pnpm-lock.yaml`) o se arregla en una tarea de formato separada. Candidata a BACKLOG.

### F-02 — README: "si el manifiesto no existe, no es un error" es inexacto — MENOR

- `platform/README.md:159-160`: "Si el directorio o el manifiesto no existen, el guard funciona como antes (no es un error)."
- Implementación real: si el directorio no existe, no hay error; si el directorio existe con archivos pero sin `manifest.json`, cada archivo es `fixture-unlisted` y los tests fallan (comportamiento deliberado, cubierto por el test `si falta el manifiesto, los archivos existentes son no declarados`).
- Recomendación: reescribir como "si el directorio no existe, el guard no verifica fixtures; si existe contenido sin manifiesto, es un error".

### F-03 — ADR-009 llama "autenticidad" a una verificación de consistencia — SUGERENCIA

- `DECISIONS.md:86-88`: "la excepción al guard es a la vez la verificación de autenticidad... ningún archivo se excluye sin demostrar que proviene del repo fuente".
- Lo verificado es que el byte coincide con el `blob_sha` declarado en el manifiesto; el `commit` y el `path` son declarados por quien crea el fixture y no se contrastan contra el upstream (no hay red en el guard).
- No invalida la política para M0 (aún no hay fixtures reales): impide mutaciones silenciosas y archivos inventados accidentales, que es el objetivo del guard. Recomendación para M1: al añadir el primer fixture, contrastar `commit`/`path`/`blob_sha` contra el upstream y dejar constancia. Candidata a BACKLOG.

### F-04 — El paso de formato del CI descarga Prettier ad hoc — SUGERENCIA

- `.github/workflows/platform-ci.yml:52-53` usa `npx --yes prettier@3.8.3 --check .`; `prettier` no está en `platform/package.json`, así que CI depende de la red en cada run (versión fijada, riesgo bajo).
- Alternativa: declarar `prettier` como devDependency de `platform/` y ejecutarlo desde el lockfile (y/o añadir script `format:check`).

### F-05 — El workflow no cubre el gate raíz de formato ni `.prettierignore` raíz — SUGERENCIA

- `paths` no incluye `.prettierignore` (raíz); un cambio en ese archivo no dispara CI. Es coherente con que el workflow solo valida `platform/`, pero conviene documentarlo (comentario en el workflow) para que no se lea como un gate global.

### F-06 — Actions fijadas por tag mayor, no por SHA — SUGERENCIA

- `actions/checkout@v4`, `actions/setup-node@v4` y `pnpm/action-setup@v4` existen y funcionan (verificado contra sus tags), pero el pin por tag mayor acepta actualizaciones implícitas. Para hardening de supply chain, valorar pin por SHA con Dependabot.

## 7. Candidatas a BACKLOG

- Decisión sobre `format:check` raíz (F-01): acotar `.prettierignore` raíz, documentar el rojo preexistente o reformatear `content/`/`marketing/` en una tarea aparte.
- Verificación de procedencia de fixtures contra upstream en M1 (F-03).
- `prettier` como devDependency de `platform/` (F-04).
- Pin de actions por SHA (F-06).
- Añadir `engines.node` a `platform/package.json` (hoy solo lo documenta el README y lo fija el workflow por `node-version: 24`).

## 8. Verificación final de cierre

- Gate `platform/` 6/6 en 0 desde limpio; suite 35/35 (4 archivos) con los tests nuevos de fixtures.
- Workflow válido (js-yaml + SchemaStore/ajv), acciones existentes con inputs correctos, permisos `contents: read`, `paths` con `content/**`, y Node 24 verificado localmente para lint/test/typecheck/build.
- Política de fixtures reproducida de forma independiente (válido excluido, no declarado, alterado 1 byte y entrada sin archivo fallan; `blob_sha == git hash-object`).
- Ownership exacto contra `116f438`; sin restos temporales; único archivo añadido por esta QA: este informe.
- **0 bloqueantes.** Los hallazgos F-01/F-02 son menores y F-03..F-06 sugerencias; ninguno impide aceptar P0-CI y P0-FX.
