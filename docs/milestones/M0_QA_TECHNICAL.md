# M0-C1 — QA Técnico Independiente del Hito 0

- Fecha: 2026-10-02
- Alcance: AC-0.1 .. AC-0.10 de `docs/milestones/M0_FOUNDATION.md` (líneas 9-18), con la interpretación verificable de `docs/milestones/M0_AUDIT_PLAN.md` §1.
- Modo: READ-ONLY. No se ha corregido nada; los hallazgos se listan para despacharse como tarea aparte.
- Repo: `/Users/aresdominguezgil/orca/ai-engineering-syllabus`, branch `main`, HEAD `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- Entorno: macOS (darwin), Node `v26.10.0`, npm `11.19.1`, pnpm `12.8.1` vía `npx --yes pnpm@12.8.1`.
- Estado de partida: artefactos eliminados (`platform/.next`, `platform/node_modules`, `platform/tsconfig.tsbuildinfo`) para verificar el flujo limpio.
- `rg` no está instalado en la máquina; las comprobaciones manuales del plan §6.2 se hicieron con `grep -rniE`.

## Resumen de veredictos

| AC                              | Veredicto |
| ------------------------------- | --------- |
| AC-0.1 Next.js + TypeScript     | PASS      |
| AC-0.2 Tailwind                 | PASS      |
| AC-0.3 shadcn/ui                | PASS      |
| AC-0.4 lint                     | PASS      |
| AC-0.5 typecheck                | PASS      |
| AC-0.6 tests                    | PASS      |
| AC-0.7 `.env.example`           | PASS      |
| AC-0.8 layout base              | PASS      |
| AC-0.9 README de desarrollo     | PASS      |
| AC-0.10 no catálogo hardcodeado | PASS      |

Total: **10/10 PASS**. Hallazgos: **0 bloqueantes, 2 menores, 4 sugerencias** (sección "Hallazgos").

---

## AC-0.1 — Next.js + TypeScript funciona

**Veredicto: PASS**

Comandos:

```sh
npx --yes pnpm@12.8.1 --dir platform build
npx --yes pnpm@12.8.1 --dir platform start -p 3124
curl -s -o /dev/null -w "%{http_code}" http://localhost:3124/
npx --yes pnpm@12.8.1 --dir platform dev -p 3125
curl -s http://localhost:3125/
```

Extracto literal del build (exit 0):

```text
$ next build
▲ Next.js 16.3.8 (Turbopack)
✓ Running next.config.ts took 11ms

  Creating an optimized production build ...
✓ Compiled successfully in 1385ms
  Running TypeScript ...
  Finished TypeScript in 1185ms ...
✓ Generating static pages using 5 workers (4/4) in 182ms

Route (app)
┌ ○ /
└ ○ /_not-found

EXIT_CODE=0
```

Extracto literal de `start` + `curl`:

```text
$ next start -p 3124
▲ Next.js 16.3.8
- Local:         http://localhost:3124
✓ Ready in 48ms
READY after 2s status=200
HTTP_STATUS=HTTP/1.1 200 OK
```

`dev -p 3125` también sirvió `/` con estado 200 en 2 s (`DEV READY after 2s status=200`). El servidor se mató al terminar (`server stopped, port 3124 free` / `dev server stopped`).

Evidencia en archivos: `platform/tsconfig.json:7` (`"strict": true`), `platform/package.json:8-9` (`dev`/`build`), `platform/src/app/page.tsx:1-5`, `platform/src/app/layout.tsx:1-19`.

---

## AC-0.2 — Tailwind funciona

**Veredicto: PASS**

Comandos:

```sh
npx --yes pnpm@12.8.1 --dir platform build
find platform/.next -name "*.css" -not -path "*/cache/*"
grep -qF ".min-h-dvh" platform/.next/static/chunks/3tdkcaymr9d8b.css   # y otras utilidades
grep -oE '\.min-h-dvh\{[^}]*\}|\.max-w-5xl\{[^}]*\}|\.gap-x-4\{[^}]*\}|\.bg-card\{[^}]*\}' <css>
```

Extracto literal (CSS compilado, 27 251 bytes):

```text
FOUND: .min-h-dvh
FOUND: .flex
FOUND: .max-w-5xl
FOUND: .bg-card
FOUND: .text-muted-foreground
FOUND: .border-b
FOUND: .gap-x-4
FOUND: .cursor-not-allowed
FOUND: .text-sm
MISSING: .sm:flex-row
```

`.sm:flex-row` "falta" porque Tailwind v4 lo emite con el selector escapado (`sm\:flex-row`): `grep -c "sm\\:flex-row"` devuelve `1`, y el CSS contiene `@media (min-width:40rem)`. Reglas literales emitidas:

```css
.min-h-dvh {
  min-height: 100dvh;
}
.max-w-5xl {
  max-width: var(--container-5xl);
}
.gap-x-4 {
  column-gap: calc(var(--spacing) * 4);
}
.bg-card {
  background-color: var(--card);
}
```

Evidencia en archivos: `platform/postcss.config.mjs:3` (`@tailwindcss/postcss`), `platform/src/app/globals.css:1` (`@import "tailwindcss"`), utilidades del shell en `platform/src/components/app-shell.tsx:13,15,20,46,50` y `platform/src/components/app-shell.test.tsx:59-66`.

---

## AC-0.3 — shadcn/ui configurado

**Veredicto: PASS**

Comandos: lectura de archivos + `typecheck` + `build` (ambos exit 0) + `curl` de `/`.

Extracto literal de `platform/components.json` (generado por CLI, estilo nuevo `radix-nova`):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Uso real en el shell — HTML servido en `/` (extracto literal):

```html
<div data-slot="card" ...>...</div>
<button
  data-slot="button"
  data-variant="default"
  data-size="default"
  ...
  disabled=""
>
  Sincronizar (próximamente)
</button>
```

Evidencia en archivos: `platform/components.json:1-25`; `platform/src/lib/utils.ts:1` (`export { cn } from "cn"`); componentes vendorizados en `platform/src/components/ui/button.tsx:1-66` y `platform/src/components/ui/card.tsx:1-102` (usan `cva`, `cn` y `radix-ui`); consumo en `platform/src/components/empty-source-state.tsx:1-8,12,24`. El CLI `npx shadcn add` no se re-ejecutó (requiere red y escribiría archivos; la tarea es READ-ONLY): la evidencia es el manifest validado, los paquetes `shadcn@4.21.0`/`radix-ui@1.6.7` instalados y el `@import "shadcn/tailwind.css"` en `globals.css:3`.

---

## AC-0.4 — lint configurado

**Veredicto: PASS**

Comando (dos veces: estado limpio y control negativo):

```sh
npx --yes pnpm@12.8.1 --dir platform lint
```

Extracto literal en estado limpio (exit 0):

```text
$ eslint .
EXIT_CODE=0
```

Control negativo (archivo temporal `platform/src/qa-negative-lint.tmp.tsx`, hook tras return condicional), exit 1:

```text
$ eslint .

/Users/aresdominguezgil/orca/ai-engineering-syllabus/platform/src/qa-negative-lint.tmp.tsx
  7:19  error  React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return?  react-hooks/rules-of-hooks

✖ 1 problem (1 error, 0 warnings)

[ELIFECYCLE] Command failed with exit code 1.
EXIT_CODE=1
```

El archivo temporal se borró y `lint` volvió a 0 (`LINT_EXIT=0`).

Evidencia en archivos: `platform/eslint.config.mjs:1-16` (flat config con `eslint-config-next/core-web-vitals` y `/typescript`), script en `platform/package.json:10` (`"lint": "eslint ."`).

---

## AC-0.5 — typecheck configurado

**Veredicto: PASS**

Comando:

```sh
npx --yes pnpm@12.8.1 --dir platform typecheck
```

Extracto literal en estado limpio (exit 0):

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
EXIT_CODE=0
```

Control negativo (archivo temporal `platform/src/qa-negative-type.tmp.ts` con `"not-a-number"` asignado a `number`), exit 2:

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
src/qa-negative-type.tmp.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
[ELIFECYCLE] Command failed with exit code 2.
EXIT_CODE=2
```

El archivo temporal se borró y `typecheck` volvió a 0 (`TYPECHECK_EXIT=0`).

Evidencia en archivos: `platform/package.json:11` (`"typecheck": "next typegen && tsc --noEmit"`), `platform/tsconfig.json:7` (`"strict": true`), `platform/src/app/layout.tsx:11` usa `LayoutProps<"/">` (tipo generado por `next typegen`, de ahí la desviación, correcta, respecto al `tsc --noEmit` pelado del plan §5.2).

---

## AC-0.6 — tests configurados

**Veredicto: PASS**

Comando:

```sh
npx --yes pnpm@12.8.1 --dir platform test
```

Extracto literal (exit 0):

```text
$ vitest run

 RUN  v5.0.3 /Users/aresdominguezgil/orca/ai-engineering-syllabus/platform

 Test Files  3 passed (3)
      Tests  11 passed (11)
   Duration  634ms
EXIT_CODE=0
```

También se verificó `test:watch` (documentado en README): lanzó Vitest y ejecutó los mismos 11 tests (`WATCH MODE LAUNCHED OK`); el proceso se mató después.

Evidencia en archivos: `platform/package.json:12-13`; `platform/vitest.config.ts:1-15` (jsdom + setup + include `src/**/*.test.{ts,tsx}` + exclusión de `.next`); `platform/vitest.setup.ts:1`; tests en `platform/src/components/app-shell.test.tsx`, `platform/src/test/env-example.test.ts`, `platform/src/test/no-hardcoded-catalog.test.ts`.

Nota: al ejecutar los tests aparece un warning de Vitest (ver Hallazgo 3); no afecta al resultado.

---

## AC-0.7 — `.env.example`

**Veredicto: PASS**

Comandos:

```sh
git check-ignore -v platform/.env.example
git status --porcelain -uall | grep -F "platform/.env.example"
grep -vE '^\s*(#|$)' platform/.env.example
grep -nEi 'sk-|ghp_|github_pat_|eyJ|://[^/ ]+:[^/ ]+@' platform/.env.example
ls -la platform/.env*
```

Extracto literal:

```text
=== git check-ignore -v ===
platform/.gitignore:35:!.env.example	platform/.env.example
verbose_exit=0
=== check-ignore plain (exit 1 = NOT ignored) ===
plain_exit=1
=== status -uall for env.example ===
?? platform/.env.example
=== active env lines (non-comment) ===
no active lines
=== secret-ish patterns ===
no secret-like values
=== platform env files ===
-rw-r--r--@ 1 aresdominguezgil  staff  486 Oct  2 09:58 platform/.env.example
```

No existe ningún `.env`/`.env.local`; `build` y `test` pasaron sin variables de entorno. El contenido de `.env.example` (`platform/.env.example:1-15`) es 100 % comentarios; los placeholders futuros (`GITHUB_TOKEN`, `GITHUB_REPO`, `DATABASE_URL`) están comentados.

Evidencia en archivos: `platform/.env.example:1-15`, `platform/.gitignore:34-35`, test `platform/src/test/env-example.test.ts:29-64`.

---

## AC-0.8 — layout base

**Veredicto: PASS**

Comandos:

```sh
npx --yes pnpm@12.8.1 --dir platform start -p 3124
curl -s -D headers.txt http://localhost:3124/ -o home.html
grep -qF "Contenido todavía no sincronizado" home.html
grep -qF "<header" home.html   # idem nav/main/footer
```

Extracto literal de las comprobaciones sobre el HTML servido (13 426 bytes):

```text
HTTP_STATUS=HTTP/1.1 200 OK
FOUND: Contenido todavía no sincronizado
FOUND: <header
FOUND: <nav
FOUND: <main
FOUND: <footer
FOUND: lang="es"
FOUND: AI Engineering Study Platform
FOUND: Fuente: 4GeeksAcademy/ai-engineering-syllabus
--- template leftovers (expected none) ---
clean: next.svg
clean: vercel.svg
clean: Get started by editing
clean: Deploy now
clean: Read our docs
clean: Powered by Vercel
clean: lorem ipsum
--- aria-disabled sample ---
<span aria-disabled="true" class="cursor-not-allowed text-muted-foreground">Catálogo</span>
<span aria-disabled="true" class="cursor-not-allowed text-muted-foreground">Buscar</span>
<span aria-disabled="true" class="cursor-not-allowed text-muted-foreground">Tutor</span>
<span aria-disabled="true" class="cursor-not-allowed text-muted-foreground">Progreso</span>
--- links on page ---
(vacío)
--- /next.svg status ---
404
```

`platform/public/` está vacío y no hay rutas falsas: el build declara únicamente `/` y `/_not-found`.

Evidencia en archivos: `platform/src/app/layout.tsx:11-18` (`lang="es"`, `AppShell`), `platform/src/components/app-shell.tsx:13,19,46,49` (landmarks y nav), `platform/src/components/empty-source-state.tsx:15,19,24` (estado vacío, texto exacto, `Button disabled`), test `platform/src/components/app-shell.test.tsx:16-74`.

---

## AC-0.9 — README de desarrollo

**Veredicto: PASS**

Comando: lectura de `platform/README.md` + ejecución de cada comando documentado.

Tabla de verificación (todos documentados en `platform/README.md:29-42`):

| Comando documentado           | Resultado observado                                                                         | Exit                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| `pnpm --dir platform install` | instaló 717 paquetes con `--frozen-lockfile`                                                | 0                                      |
| `... dev`                     | sirvió `/` (probado en `-p 3125`)                                                           | 0 (proceso vivo, matado tras curl 200) |
| `... build`                   | `✓ Compiled successfully`                                                                   | 0                                      |
| `... start`                   | sirvió `/` (probado en `-p 3124`)                                                           | 0 (proceso vivo, matado)               |
| `... lint`                    | `$ eslint .` sin errores                                                                    | 0                                      |
| `... typecheck`               | `✓ Types generated successfully` + `tsc` sin errores                                        | 0                                      |
| `... test`                    | `3 passed` / `11 passed`                                                                    | 0                                      |
| `... test:watch`              | Vitest en modo watch ejecutó los tests                                                      | 0 (matado)                             |
| `--check .` (formato)         | `All matched files use Prettier code style!` (ignorando `.next`)                            | 0                                      |
| `--write .` (formato)         | **no ejecutado**: la tarea es READ-ONLY; el árbol ya está limpio, por lo que sería un no-op | —                                      |

Prerequisitos, variables de entorno, estructura, alcance/exclusiones y enlaces: presentes en `platform/README.md:12-106`.

---

## AC-0.10 — no existe catálogo educativo hardcodeado

**Veredicto: PASS**

Comandos:

```sh
npx --yes pnpm@12.8.1 --dir platform test          # incluye no-hardcoded-catalog.test.ts
grep -rniE 'CONTEXT-|content/projects|content/lessons|content/contexts' platform/src
grep -rniE 'next\.svg|vercel\.svg|get started by editing|deploy now|lorem ipsum' platform/src
find platform/src -name '*.md' -o -name '*.csv' -o -name '*.pdf'
```

Extracto literal de la ejecución de tests (exit 0): `Test Files 3 passed (3)` / `Tests 11 passed (11)`, con el guard `AC-0.10: no existe catálogo educativo hardcodeado` entre ellos.

Extracto literal del barrido manual (solo referencias permitidas del infraestructura del propio guard, tal como admite el plan §6.2):

```text
platform/src/test/no-hardcoded-catalog.test.ts:20:      expect(token.startsWith("context-")).toBe(false);
platform/src/test/catalog-denylist.ts:69:    .replace(/^context-/, "")
platform/src/test/catalog-denylist.ts:111:    if (!/^context-.*\.md$/i.test(baseName)) {
```

Cero nombres de entidades del syllabus y cero archivos `.md/.csv/.pdf` copiados bajo `src/`. El guard deriva la denylist en tiempo de ejecución de `content/` y es fail-closed (test `falla de forma explícita si content/ no existe`, en verde).

Evidencia en archivos: `platform/src/test/no-hardcoded-catalog.test.ts:12-36`, `platform/src/test/catalog-denylist.ts:77-118`, `platform/src/test/catalog-denylist.ts:153-193`.

---

## Hallazgos

### 1. `prettier --check platform` falla por artefactos generados en `platform/.next/` — MENOR (no bloqueante)

- Severidad: menor (no bloqueante según la propia tarea; el código fuente sí está formateado).
- Archivo/línea: global; 99 archivos afectados, todos bajo `platform/.next/` (p. ej. `platform/.next/static/chunks/3tdkcaymr9d8b.css`, `platform/.next/build-manifest.json`).
- Cómo reproducir:
  1. `npx --yes pnpm@12.8.1 --dir platform build`
  2. `npx --yes prettier@3.8.3 --check platform`
- Salida: `[warn] Code style issues found in 99 files. Run Prettier with --write to fix.` con `EXIT_CODE=1`.
- Comprobación de que solo afecta a generados: `npx --yes prettier@3.8.3 --check platform --ignore-path platform/.gitignore` → `All matched files use Prettier code style!`, `EXIT_CODE=0`; y filtrando el listado no queda ninguna entrada fuera de `platform/.next/`.
- Causa: Prettier 3 **no** respeta `.gitignore` por defecto (el plan §3.5, riesgo 4, asumía lo contrario) y `platform/` no tiene `.prettierignore`; `platform/.gitignore` sí ignora `/.next/`, pero solo al usarlo con `--ignore-path`.
- Corrección propuesta (tarea aparte): añadir `platform/.prettierignore` con `.next/`, `node_modules/`, `coverage/`, `*.tsbuildinfo` (o un `.prettierignore` raíz), o documentar/automatizar el check con `--ignore-path platform/.gitignore`.

### 2. Permanece el favicon por defecto del template (triángulo de Vercel) — MENOR

- Severidad: menor.
- Archivo/línea: `platform/src/app/favicon.ico` (25 931 bytes, sha256 `2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932`); se sirve en `platform/src/app/layout.tsx` (head generado).
- Cómo reproducir: `curl -s http://localhost:3124/ | grep -o '<link[^>]*icon[^>]*>'` → `<link rel="icon" href="/favicon.ico?favicon.2vob68tjqpejf.ico" sizes="256x256" type="image/x-icon"/>`; convertir y ver el icono (`sips -s format png platform/src/app/favicon.ico --out /tmp/favicon.png`) muestra el triángulo blanco sobre círculo negro, branding por defecto del scaffolding.
- Contexto: el plan §8, paso 16, pide eliminar los assets demo del scaffolding; `public/` sí quedó vacío, pero este icono del template se mantiene y se sirve.
- Corrección propuesta: sustituirlo por un icono neutro propio (o eliminarlo; sin favicon la app sigue funcionando y `/favicon.ico` daría 404).

### 3. Warning de Vitest: `vitest.config.ts` cargado como CommonJS con sintaxis ESM — SUGERENCIA

- Severidad: sugerencia (hoy solo warning; anuncia rotura con una futura major de Vite).
- Archivo/línea: `platform/vitest.config.ts:1`.
- Cómo reproducir: `npx --yes pnpm@12.8.1 --dir platform test` (o `... test:watch`).
- Salida literal: `(!) Your Vite config uses features that are unsupported by configLoader: 'native', ... ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a .mjs extension or set "type": "module" in the closest package.json`.
- Corrección propuesta: renombrar `vitest.config.ts` → `vitest.config.mts` (el `setupFiles: ["./vitest.setup.ts"]` sigue válido) o añadir `"type": "module"` a `platform/package.json`. Verificar de paso que `resolve.tsconfigPaths` sigue funcionando.

### 4. El test del shell vive en `src/components/` y el README documenta `src/test/` — SUGERENCIA

- Severidad: sugerencia (funciona: `vitest.config.ts:12` incluye `src/**/*.test.{ts,tsx}`).
- Archivo/línea: `platform/src/components/app-shell.test.tsx:1` vs `platform/README.md:63` ("`src/test/` # tests (shell, higiene de entorno, guard de catálogo)") y `docs/milestones/M0_AUDIT_PLAN.md` §5.7 (preveía `src/test/app-shell.test.tsx`).
- Cómo reproducir: `ls platform/src/components/app-shell.test.tsx platform/src/test/`.
- Corrección propuesta: moverlo a `platform/src/test/app-shell.test.tsx` (los imports `@/components/...` no cambian) o corregir la estructura documentada en README y plan.

### 5. `platform/AGENTS.md` y `platform/CLAUDE.md` no figuran en el plan — SUGERENCIA

- Severidad: sugerencia.
- Archivo/línea: `platform/AGENTS.md:1-13` (bloque `nextjs-agent-rules`) y `platform/CLAUDE.md:1` (`@AGENTS.md`).
- Contexto: son generados/re-añadidos por `next dev` de Next 16; no son contenido educativo ni código de app, pero, si se commitean, el guard AC-0.10, Prettier y el futuro CI los escanearán (hoy Prettier los considera formateados; el guard no encuentra tokens).
- Corrección propuesta: decidir explícitamente si se versionan o se añaden a `platform/.gitignore`; si se versionan, documentarlo en el README.

### 6. `platform/pnpm-workspace.yaml` existe aunque ADR-006 dice "sin declarar workspaces" — SUGERENCIA

- Severidad: sugerencia.
- Archivo/línea: `platform/pnpm-workspace.yaml:1-3` (`allowBuilds: sharp: false, unrs-resolver: false`).
- Comprobación: no contiene la clave `packages`, por lo que no declara ningún proyecto de workspace; `install` operó solo sobre `platform/` (virtual store `platform/node_modules/.pnpm`) y el lockfile raíz quedó intacto. Es el fichero de configuración que pnpm usa para `allowBuilds` desde pnpm 10+.
- Corrección propuesta: mantenerlo, pero mencionarlo en `platform/README.md` (o en DECISIONS) para que "sin workspace" no se confunda con "sin `pnpm-workspace.yaml`"; valorar si denegar los build scripts de `sharp` afectará a la optimización de imágenes cuando M4 traiga assets (verificar en ese hito).

---

## Comandos ejecutados

| #   | Comando                                                                                                | Exit                       | Resultado                                                                       |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| 1   | `node -v`                                                                                              | 0                          | `v26.10.0`                                                                      |
| 2   | `npm -v`                                                                                               | 0                          | `11.19.1`                                                                       |
| 3   | `npx --yes pnpm@12.8.1 --version`                                                                      | 0                          | `12.8.1`                                                                        |
| 4   | `rm -rf platform/.next platform/node_modules` (+ `rm platform/tsconfig.tsbuildinfo`)                   | 0                          | estado limpio                                                                   |
| 5   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile`                                       | 0                          | `Lockfile is up to date` · `Packages: +717` · `Done in 1.5s using pnpm v12.8.1` |
| 6   | `npx --yes pnpm@12.8.1 --dir platform lint`                                                            | 0                          | sin salida (verde)                                                              |
| 7   | `npx --yes pnpm@12.8.1 --dir platform test`                                                            | 0                          | `Test Files 3 passed (3)` · `Tests 11 passed (11)`                              |
| 8   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                                                       | 0                          | `✓ Types generated successfully`                                                |
| 9   | `npx --yes pnpm@12.8.1 --dir platform build`                                                           | 0                          | `✓ Compiled successfully in 1385ms`                                             |
| 10  | `npx --yes pnpm@12.8.1 --dir platform start -p 3124` + `curl /`                                        | 0 / 200                    | `HTTP/1.1 200 OK`, estado vacío y landmarks presentes                           |
| 11  | `curl /next.svg`                                                                                       | 404                        | no hay assets del template                                                      |
| 12  | `npx --yes pnpm@12.8.1 --dir platform dev -p 3125` + `curl /`                                          | 0 / 200                    | `DEV READY after 2s status=200`                                                 |
| 13  | `npx --yes pnpm@12.8.1 --dir platform typecheck` (con `qa-negative-type.tmp.ts`)                       | 2                          | `error TS2322: Type 'string' is not assignable to type 'number'`                |
| 14  | `npx --yes pnpm@12.8.1 --dir platform lint` (con `qa-negative-lint.tmp.tsx`)                           | 1                          | `error ... react-hooks/rules-of-hooks`                                          |
| 15  | `npx --yes pnpm@12.8.1 --dir platform typecheck` (tras borrar temporales)                              | 0                          | verde                                                                           |
| 16  | `npx --yes pnpm@12.8.1 --dir platform lint` (tras borrar temporales)                                   | 0                          | verde                                                                           |
| 17  | `npx --yes pnpm@12.8.1 --dir platform test:watch`                                                      | 0 (matado)                 | Vitest lanzado, 11 tests                                                        |
| 18  | `npx --yes prettier@3.8.3 --check platform`                                                            | 1                          | 99 avisos, **todos** en `platform/.next/` (Hallazgo 1)                          |
| 19  | `npx --yes prettier@3.8.3 --check platform --ignore-path platform/.gitignore`                          | 0                          | `All matched files use Prettier code style!`                                    |
| 20  | `git check-ignore -v platform/.env.example`                                                            | 0 (verbose)                | regla `platform/.gitignore:35:!.env.example`                                    |
| 21  | `git check-ignore platform/.env.example` (sin `-v`)                                                    | 1                          | no ignorado                                                                     |
| 22  | `grep -vE '^\s\*(#                                                                                     | $)' platform/.env.example` | 0                                                                               | sin líneas activas |
| 23  | `grep -rniE 'CONTEXT-\|content/projects\|content/lessons\|content/contexts' platform/src`              | 0                          | solo 3 referencias del propio guard                                             |
| 24  | `grep -rniE 'next\.svg\|vercel\.svg\|...' platform/src`                                                | 1                          | sin restos del template                                                         |
| 25  | `git status --porcelain`                                                                               | 0                          | solo baseline esperado (ver abajo)                                              |
| 26  | `git diff --stat -- package.json pnpm-lock.yaml .gitignore README.md content marketing assets .cursor` | 0                          | solo `README.md` (preexistente, 60+/37-)                                        |
| 27  | `stat -f ... README.md`                                                                                | 0                          | mtime `2026-10-01 21:15:00` (anterior al hito, iniciado el 2026-10-02)          |

### Estado git final

`git status --porcelain` (idéntico al baseline registrado antes de la QA, sin restos temporales):

```text
 M README.md
?? AI_TUTOR.md
?? ARCHITECTURE.md
?? BACKLOG.md
?? CONTENT_CONTRACT.md
?? DATA_MODEL.md
?? DECISIONS.md
?? MILESTONES.md
?? ORCA.md
?? PRODUCT.md
?? REPO_MAP.md
?? SOURCE_OF_TRUTH.md
?? SPECS.md
?? STATUS.md
?? docs/milestones/
?? opencode.json
?? platform/
```

`git diff --stat` de paths protegidos:

```text
 README.md | 97 +++++++++++++++++++++++++++++++++++++------------------------
 1 file changed, 60 insertions(+), 37 deletions(-)
```

`package.json`, `pnpm-lock.yaml`, `.gitignore`, `content/`, `marketing/`, `assets/` y `.cursor/` **sin diferencias**. La modificación de `README.md` es preexistente: ya constaba en el baseline de `M0_AUDIT_PLAN.md` §3.4 (60 inserciones / 37 borrados) y su mtime es del 2026-10-01 21:15, anterior al trabajo de M0 del 2026-10-02. `git status --porcelain -uall | grep -iE 'tmp|negative|qa-'` no devuelve nada: sin restos temporales.

### Confirmaciones de cierre

- Servidores `3124` y `3125` detenidos y puertos libres (`server stopped, port 3124 free` / `dev server stopped`).
- Archivos temporales de control negativo eliminados (`platform/src/` solo contiene `app`, `components`, `lib`, `test`).
- No se modificó ningún archivo del repositorio salvo la creación de este informe; no se corrigió ningún hallazgo (READ-ONLY).

---

## Re-QA tras correcciones (M0-R1)

- Fecha: 2026-10-02
- Alcance: re-verificación de AC-0.1 .. AC-0.10 (`docs/milestones/M0_FOUNDATION.md`) con la interpretación de `docs/milestones/M0_AUDIT_PLAN.md` §1, tras M0-FIX-T, M0-FIX-G y M0-FIX-D.
- Modo: READ-ONLY; el único cambio es esta sección. No se ha corregido nada.
- Entorno: macOS (darwin), Node `v26.10.0`, npm `11.19.1`, pnpm `12.8.1` vía `npx --yes pnpm@12.8.1`.
- Estado de partida (limpio): `rm -rf platform/.next platform/node_modules platform/next-env.d.ts platform/tsconfig.tsbuildinfo` → `CLEANED`, sin artefactos restantes.

### Secuencia principal desde estado limpio

| #   | Comando                                                          | Exit    | Resultado                                                                                                   |
| --- | ---------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile` | 0       | `Lockfile is up to date, resolution step is skipped` · `Packages: +716` · `Done in 1.1s using pnpm v12.8.1` |
| 2   | `npx --yes pnpm@12.8.1 --dir platform lint`                      | 0       | `$ eslint .` sin errores                                                                                    |
| 3   | `npx --yes pnpm@12.8.1 --dir platform typecheck`                 | 0       | `Generating route types...` · `✓ Types generated successfully`                                              |
| 4   | `npx --yes pnpm@12.8.1 --dir platform test`                      | 0       | `Test Files 3 passed (3)` · `Tests 18 passed (18)` (sin warning de config loader)                           |
| 5   | `npx --yes pnpm@12.8.1 --dir platform build`                     | 0       | `✓ Compiled successfully in 1341ms` · rutas `/` y `/_not-found`                                             |
| 6   | `npx --yes pnpm@12.8.1 --dir platform start -p 3126` + `curl /`  | 0 / 200 | `✓ Ready in 50ms` · `HTTP/1.1 200 OK`; servidor matado, puerto libre                                        |
| 7   | `cd platform && npx --yes prettier@3.8.3 --check .`              | 0       | `All matched files use Prettier code style!`                                                                |

Extractos literales (build, start + curl, prettier):

```text
$ next build
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully in 1341ms
  Running TypeScript ...
  Finished TypeScript in 868ms ...
✓ Generating static pages using 4 workers (3/3) in 135ms

Route (app)
┌ ○ /
└ ○ /_not-found
```

```text
$ next start -p 3126
▲ Next.js 16.3.8
- Local:         http://localhost:3126
✓ Ready in 50ms
HTTP_STATUS=HTTP/1.1 200 OK
server stopped; port check: free
```

```text
Checking formatting...
All matched files use Prettier code style!
```

También se re-ejecutaron los dos comandos restantes documentados en `platform/README.md`: `dev -p 3127` (`✓ Ready in 163ms`, `GET / 200`, matado y puerto libre) y `test:watch` (`3 passed (3)` / `18 passed (18)`, matado).

### Controles negativos temporales

Lint (exit 1 con `platform/src/qa-negative-lint.tmp.tsx`, hook tras return condicional):

```text
$ eslint .

/Users/aresdominguezgil/orca/ai-engineering-syllabus/platform/src/qa-negative-lint.tmp.tsx
  7:19  error  React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return?  react-hooks/rules-of-hooks

✖ 1 problem (1 error, 0 warnings)

[ELIFECYCLE] Command failed with exit code 1.
EXIT_CODE=1
```

Typecheck (exit 2 con `platform/src/qa-negative-type.tmp.ts`):

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
src/qa-negative-type.tmp.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
[ELIFECYCLE] Command failed with exit code 2.
EXIT_CODE=2
```

Ambos temporales se borraron; `lint` y `typecheck` volvieron a 0 (`LINT_AFTER_EXIT=0`, `TYPECHECK_AFTER_EXIT=0`). `find platform -maxdepth 3 \( -name '*tmp*' -o -name '*negative*' -o -name '*qa-*' \)` no devuelve nada.

### Veredicto final AC-0.1 .. AC-0.10

| AC                          | Veredicto | Evidencia de esta re-QA                                                                                                                                                       |
| --------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-0.1 Next.js + TypeScript | PASS      | build 0 + `start` 200 + `platform/tsconfig.json:7` `"strict": true`                                                                                                           |
| AC-0.2 Tailwind             | PASS      | CSS compilado (27 251 bytes) con `.min-h-dvh`, `.flex`, `.max-w-5xl`, `.bg-card`, `.cursor-not-allowed`; `.sm:flex-row` escapado presente                                     |
| AC-0.3 shadcn/ui            | PASS      | `components.json` válido + HTML servido con `data-slot="card"` y `data-slot="button"` (disabled)                                                                              |
| AC-0.4 lint                 | PASS      | lint 0 + control negativo 1 + restaurado 0                                                                                                                                    |
| AC-0.5 typecheck            | PASS      | typecheck 0 + control negativo 2 + restaurado 0                                                                                                                               |
| AC-0.6 tests                | PASS      | `3 passed (3)` / `18 passed (18)`, sin warning de config loader                                                                                                               |
| AC-0.7 `.env.example`       | PASS      | `git check-ignore -v` → regla `platform/.gitignore:28:!.env.example`; 0 líneas activas; 0 patrones de secreto; build/test sin `.env`                                          |
| AC-0.8 layout base          | PASS      | HTML 13 088 bytes: texto exacto, `header`/`nav`/`main`/`footer`, `lang="es"`, sin restos del template, 0 enlaces, nav con `aria-disabled`; `/next.svg` y `/favicon.ico` → 404 |
| AC-0.9 README               | PASS      | install, dev, build, start, lint, typecheck, test, test:watch y `prettier --check .` ejecutados con el resultado documentado                                                  |
| AC-0.10 no catálogo         | PASS      | guard en verde (incluye fail-closed y control positivo); grep manual solo con 3 referencias del propio guard; 0 `.md/.csv/.pdf` bajo `src/`                                   |

Total: **10/10 PASS · 0 bloqueantes**.

### Estado de los hallazgos previos

| #   | Tipo                                                          | Estado                    | Evidencia / referencia                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MENOR — `prettier --check` fallaba por artefactos de `.next/` | RESUELTO (gate prescrito) | `platform/.prettierignore` (`.next/`, `node_modules/`, `coverage/`, `pnpm-lock.yaml`, `next-env.d.ts`); `cd platform && prettier --check .` → 0. Matiz: la invocación antigua desde la raíz (`npx prettier --check platform`) sigue en 1 (92 archivos: 91 de `.next/` + `platform/pnpm-lock.yaml`) porque Prettier resuelve el ignore desde el cwd; residual ya recogido en `BACKLOG.md:28` (`.prettierignore` raíz). |
| 2   | MENOR — favicon por defecto de Vercel                         | RESUELTO                  | `platform/src/app/favicon.ico` ya no existe; `curl /favicon.ico` → 404; `BACKLOG.md:33` registra el icono neutro futuro.                                                                                                                                                                                                                                                                                              |
| 3   | SUGERENCIA — warning de Vitest (config CJS con ESM)           | RESUELTO                  | `platform/vitest.config.mts`; la salida de `test`/`test:watch` ya no muestra el warning y `resolve.tsconfigPaths` sigue funcionando (imports `@/`).                                                                                                                                                                                                                                                                   |
| 4   | SUGERENCIA — test del shell fuera de `src/test/`              | RESUELTO (documentado)    | `platform/README.md:63,83-85` documenta `src/components/app-shell.test.tsx` como ubicación real; `vitest.config.mts:12` lo incluye.                                                                                                                                                                                                                                                                                   |
| 5   | SUGERENCIA — `AGENTS.md` / `CLAUDE.md` no previstos           | RESUELTO (documentado)    | `platform/README.md:68-69,89-90`: se versionan tal cual y los regenera `next dev`.                                                                                                                                                                                                                                                                                                                                    |
| 6   | SUGERENCIA — `pnpm-workspace.yaml` vs "sin workspace"         | RESUELTO (documentado)    | `platform/README.md:74,86-88` y matiz en `DECISIONS.md:44-48` (ADR-006): solo política `allowBuilds`, sin clave `packages:`.                                                                                                                                                                                                                                                                                          |

### Regresiones nuevas

Ninguna detectada. Cambios observados respecto a la QA anterior, atribuibles a los fixes y no a regresiones:

- Tests: 11 → 18 (más cobertura del guard: control positivo del matcher, normalización y fail-closed por bucket).
- `install`: `Packages: +716` (antes +717), por la actualización del lockfile de `platform/` durante los fixes; el lockfile raíz sigue intacto.
- `build`: `Generating static pages ... (3/3)` (antes 4/4) por la eliminación del favicon.
- `platform/public/` sigue existiendo vacío en disco, pero no aparece en git (los directorios vacíos no se trackean) y el README ya lo explica (`platform/README.md:91-92`); no es un artefacto temporal.

### Estado git final

`git status --porcelain -uall` no muestra restos temporales y añade únicamente `platform/` más esta sección respecto al baseline. `git diff --stat` de paths protegidos sigue mostrando solo la modificación preexistente de `README.md` (60 inserciones / 37 borrados); `package.json`, `pnpm-lock.yaml`, `.gitignore`, `content/`, `marketing/`, `assets/`, `.cursor/` y `opencode.json` sin diferencias. Puertos 3124-3127 libres y sin procesos `next` vivos.

**Veredicto final de la re-QA: 10/10 AC en PASS; 0 bloqueantes.**
