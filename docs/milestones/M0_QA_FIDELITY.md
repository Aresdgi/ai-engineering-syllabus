# M0 — QA independiente de fidelidad a la fuente y de alcance

- Hito: **Hito 0 — Fundación** (`docs/milestones/M0_FOUNDATION.md`)
- Tarea: M0-C2 (QA independiente de fidelidad, READ-ONLY)
- Fecha: 2026-10-02
- Autor: worker M0-C2 (terminal `term_e488ae41-...`)
- Alcance auditado: `platform/` completo (código, configs, README, `.env.example`, lockfile, `public/`, archivos generados), más `DECISIONS.md` y `BACKLOG.md` (solo adiciones)
- Documentos de contraste: `ORCA.md`, `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `ARCHITECTURE.md`, `MILESTONES.md`, `docs/milestones/M0_FOUNDATION.md`, `docs/milestones/M0_AUDIT_PLAN.md` (secciones 4-8)
- Restricción respetada: **READ-ONLY**. El único archivo creado es este informe.
- Resultado global: **0 bloqueantes, 7 menores, 6 sugerencias**. AC-0.10 se cumple (0 nombres de catálogo hardcodeados en `platform/`), el alcance de M0 no se desborda y los archivos upstream de la raíz no se tocaron.

## 0. Método y comandos ejecutados

1. Lectura completa de los documentos de contraste y de todo el código de `platform/` (28 archivos, excluyendo `node_modules/` y `.next/`).
2. Cruce independiente de los nombres reales del corpus contra `platform/` con `grep` (no con el guard):
   - Se generó la lista de 117 tokens elegibles a partir de los directorios de `content/projects` (84), `content/lessons` (5), los directorios de primer nivel de `content/contexts` (22) y los 208 archivos `CONTEXT-*.md` normalizados (4 empresas: `brasaland`, `healthcore`, `nexova`, `trackflow`, más variantes `*-briefing`).
   - Comando: `cd platform && grep -rniF -f /tmp/m0_names.txt --exclude-dir=node_modules --exclude-dir=.next --exclude=pnpm-lock.yaml --exclude=tsconfig.tsbuildinfo -I .` → `exit=1` (cero coincidencias).
3. Ejecución del guard permitida por la tarea: `npx --yes pnpm@12.8.1 --dir platform exec vitest run src/test` → **2 archivos, 6 tests, todos en verde** (no se ejecutó install/build/start/dev; M0-C1 conserva esa responsabilidad).
4. Experimentos de evasión del matcher con Node, replicando la regex literal de `catalog-denylist.ts:125`.
5. Verificación git sin modificar nada: `git status --porcelain`, `git diff --stat -- package.json pnpm-lock.yaml .gitignore README.md`, `git status --porcelain -- content marketing assets .cursor`.
6. Inspección de dependencias reales: uso de cada paquete en `src/` y exports del paquete `shadcn` en `node_modules/`.

No se ejecutaron `install`, `build`, `start` ni `dev`.

---

## 1. Contenido educativo inventado

**Veredicto: no se encontró ningún contenido educativo inventado ni datos demo.**

### 1.1 Texto de UI (único texto humano de la app)

Todo el texto visible está en español, es neutro y describe el estado de la plataforma, no el curso:

- `platform/src/components/app-shell.tsx:3-9`:
  ```ts
  const navigationItems = [
    "Inicio",
    "Catálogo",
    "Buscar",
    "Tutor",
    "Progreso",
  ] as const;
  ```
  Son etiquetas de UI de producto. `SOURCE_OF_TRUTH.md:64-78` permite explícitamente "Buscar", "Continuar aprendiendo", "Preguntar al tutor", etc. Los ítems futuros se renderizan como `span` con `aria-disabled="true"` y **sin enlaces** (`app-shell.tsx:32-39`), así que no crean rutas ni pantallas falsas.
- `platform/src/components/empty-source-state.tsx:14-24`:
  ```tsx
  <h1>Contenido todavía no sincronizado</h1>
  ...
  "La plataforma mostrará el syllabus real del repositorio cuando se implemente la ingesta (Hito 1). Hasta entonces no se muestra contenido educativo."
  ...
  <Button disabled>Sincronizar (próximamente)</Button>
  ```
- `platform/src/app/layout.tsx:5-9`: metadata de producto (`"AI Engineering Study Platform"`), sin nombres de proyectos, empresas, lecciones ni módulos.
- `platform/src/components/app-shell.tsx:51`: `Fuente: 4GeeksAcademy/ai-engineering-syllabus`. Es procedencia factual, no contenido educativo; coincide con lo previsto en `M0_AUDIT_PLAN.md:227`.

### 1.2 Cruce independiente contra el corpus real

Los 117 tokens elegibles derivados del corpus (proyectos, lecciones, buckets de contextos, archivos `CONTEXT-*`, incluidas las empresas `brasaland`, `healthcore`, `nexova`, `trackflow`) **no aparecen ni una vez** en `platform/`:

```text
$ cd platform && grep -rniF -f /tmp/m0_names.txt --exclude-dir=node_modules \
    --exclude-dir=.next --exclude=pnpm-lock.yaml --exclude=tsconfig.tsbuildinfo -I .
$ echo $?
1
```

La comprobación de `M0_AUDIT_PLAN.md:309-313` (`CONTEXT-|content/projects|content/lessons|content/contexts` en `src`) solo devuelve referencias del propio guard:

```text
platform/src/test/no-hardcoded-catalog.test.ts:20:  expect(token.startsWith("context-")).toBe(false);
platform/src/test/catalog-denylist.ts:69:    .replace(/^context-/, "")
platform/src/test/catalog-denylist.ts:111:    if (!/^context-.*\.md$/i.test(baseName)) {
```

Ningún curso, módulo, lección, quiz, rúbrica, requisito, tecnología, orden pedagógico, empresa ficticia ni texto de relleno aparece en el código. No hay `lorem ipsum`, "Proyecto 1", ni assets demo (`platform/public/` está vacío; no existe `next.svg`/`vercel.svg`).

### 1.3 Lo que un usuario podría confundir con contenido oficial

- El nombre provisional "AI Engineering Study Platform" no usa marcas de 4Geeks ni presenta contenido como oficial; el footer solo cita el repositorio fuente.
- La navegación ("Catálogo", "Buscar", "Tutor", "Progreso") está deshabilitada visualmente y no navega a ninguna parte; el test lo verifica (`app-shell.test.tsx:44-57`, `expect(nav.querySelectorAll("a")).toHaveLength(0)`).
- El botón "Sincronizar (próximamente)" aparece `disabled` (`empty-source-state.tsx:24`).

No hay hallazgos de contenido inventado.

---

## 2. Calidad del guard AC-0.10

Implementación: `platform/src/test/catalog-denylist.ts` + `platform/src/test/no-hardcoded-catalog.test.ts`.

### 2.1 ¿La denylist es realmente dinámica?

Sí. No hay nombres hardcodeados: los tokens se derivan en runtime de `content/`:

- `catalog-denylist.ts:14`: `const CATALOG_BUCKETS = ["projects", "lessons", "contexts"] as const;`
- `catalog-denylist.ts:77-118` (`collectCatalogTokens`): recorre directorios de `projects`, `lessons` y `contexts`, y normaliza los basenames `CONTEXT-*.md` (`catalog-denylist.ts:65-71`).
- Ningún identificador de proyecto/empresa/lección aparece como literal en el guard ni en el helper. El test comprueba propiedades estructurales de los tokens, no una lista fija (`no-hardcoded-catalog.test.ts:13-23`).
- La deduplicación y la elegibilidad (`catalog-denylist.ts:73-75, 88-94`) descartan tokens de longitud < 5 y puramente numéricos. En el corpus actual **ningún token cae en esos filtros** (verificado: 117/117 elegibles), por lo que hoy no hay pérdida.

### 2.2 ¿Es fail-closed?

Parcialmente. Falla de forma explícita si falta `content/` o un bucket:

```ts
// catalog-denylist.ts:80-84
if (!existsSync(contentRoot)) {
  throw new Error(
    `Guard AC-0.10: no existe "${contentRoot}". ... falla de forma explícita (fail-closed) ...`,
  );
}
// catalog-denylist.ts:98-102  (mismo patrón por bucket)
```

y existe un test dedicado:

```ts
// no-hardcoded-catalog.test.ts:25-29
it("falla de forma explícita si content/ no existe (fail-closed)", () => {
  expect(() =>
    collectCatalogTokens("/content-inexistente-para-el-guard"),
  ).toThrow(/content/);
});
```

Punto débil: si los directorios existen pero el corpus queda vacío o regresa (p. ej. `content/projects/` sin proyectos y sin archivos `CONTEXT-*`), el guard pasa en vacío. El único control es `expect(tokens.length).toBeGreaterThan(0)` (`no-hardcoded-catalog.test.ts:16`), insuficiente para detectar una regresión parcial. Ver F-03.

### 2.3 ¿Qué evade (falsos negativos plausibles)?

- **Nombres naturalizados de slugs con guion (el caso más realista).** El matcher es de token completo con límites `[a-z0-9-]` (`catalog-denylist.ts:124-126`) y los tokens son slugs completos. Reescribir `OpenClaw` o `Edutrack` en la UI pasa el guard:

  ```text
  MATCH     token=brasaland                 text="Brasaland" / "BRASALAND_DASHBOARD" / "brasaland_ui"
  MATCH     token=nexova                    text="Nexova Inc."
  NO MATCH  token=openclaw-connection       text="OpenClaw connection"
  NO MATCH  token=openclaw-connection       text="openclaw_connection"
  MATCH     token=openclaw-connection       text="openclaw-connection"
  NO MATCH  token=edutrack-data-audit-sql   text="Edutrack"
  MATCH     token=edutrack-data-audit-sql   text="edutrack-data-audit-sql"
  NO MATCH  token=06-telemetry-data-pipelines text="data pipelines"
  NO MATCH  token=audit-log                 text="Audit log"
  ```

  Es decir: las empresas (`brasaland`, `nexova`, ...) sí se detectan en prosa, pero los proyectos de slug compuesto (`openclaw-*`, `edutrack-*`, `nextjs-*`, `company-financial-dashboard-*`) no. Los títulos pedagógicos reales suelen ser la versión "bonita" del slug, no el slug. Ver F-02.

- **Tokens de una sola pieza sintáctica.** Solo se añaden los nombres completos de directorio; no se generan subtokens. `content/contexts/06-telemetry-data-pipelines/telemetry/` (subdirectorio anidado) no produce el token `telemetry`, y `data-pipelines` tampoco existe como token propio.
- **Extensiones no escaneadas.** Solo se escanean `.ts .tsx .js .jsx .mjs .cjs .json .css .md` (`catalog-denylist.ts:18-28`); un nombre en `.txt`, `.env` o un archivo sin extensión no se detecta. `.env.example` (extensión `.example`) queda fuera.
- **Obfuscación** (concatenación, base64): limitación ya asumida en `M0_AUDIT_PLAN.md:319`, razonable para un guard de desarrollo.
- **Sin control positivo automatizado.** El test que escanea solo exige cero violaciones (`no-hardcoded-catalog.test.ts:31-35`). Si `tokenPattern` dejara de coincidir (bug, cambio de flags), la suite seguiría verde. Ver F-01.

### 2.4 ¿Qué falsos positivos tiene?

- El matching por token completo con límites reduce mucho el ruido: palabras genéricas dentro de otro identificador no disparan (p. ej. `class-variance-authority` no colisiona con ningún token actual).
- Al escanear también `.md` y `.json`, cualquier documentación futura de `platform/` que mencionara legítimamente una entidad real (p. ej. un ejemplo pedagógico o un enlace a `content/projects/<proyecto>`) haría fallar el guard. No existe allowlist. Hoy no ocurre (la única referencia es la URL del repositorio fuente).
- Una dependencia futura con nombre igual a un token (p. ej. un paquete `openclaw-*`) sería marcada en `package.json`. Riesgo bajo.
- Al excluir solo `pnpm-lock.yaml` (`catalog-denylist.ts:32, 142`) y no escanear binarios, el guard no genera falsos positivos por el lockfile ni por `favicon.ico`.

### 2.5 ¿El control negativo es reproducible?

Reproducción del estado actual (verde):

```text
$ npx --yes pnpm@12.8.1 --dir platform exec vitest run src/test

 RUN  v5.0.3 /Users/aresdominguezgil/orca/ai-engineering-syllabus/platform

 Test Files  2 passed (2)
      Tests  6 passed (6)
   Duration  213ms
```

La detección en sí es reproducible manualmente con la misma regex (un literal `"Brasaland"` es detectado, ver 2.3), pero **no hay un test que inyecte una violación conocida y espere un fallo**, así que el control positivo no está automatizado (F-01). El filtro `vitest run src/test` no ejecuta el test de shell, que vive en `src/components/`.

---

## 3. Alcance: ¿hay algo de hitos 1-9?

**Veredicto: no. El alcance de M0 está limpio.**

- **Rutas/páginas:** la app solo tiene `/`. Todos los archivos de `src/app/` son:
  ```text
  platform/src/app/favicon.ico
  platform/src/app/globals.css
  platform/src/app/layout.tsx
  platform/src/app/page.tsx
  ```
  No hay API routes, route handlers, `middleware.ts`, `pages/` ni rutas de catálogo/proyecto/lección/búsqueda/tutor/progreso. La única `page.tsx` renderiza el estado vacío (`page.tsx:1-5`).
- **Dependencias:** `platform/package.json:15-41` no contiene ninguna dependencia de GitHub/Octokit, base de datos/ORM, Supabase, auth, búsqueda, LLM/RAG/embeddings ni evaluación. Las deps son Next/React, shadcn + utilidades UI y el toolchain de tests.
- **Lockfile:** `grep -nE '^  (supabase|prisma|drizzle|openai|anthropic|langchain|octokit|@supabase|@prisma|next-auth|@clerk)' platform/pnpm-lock.yaml` → sin resultados.
- **Código:** búsqueda de `supabase|prisma|drizzle|postgres|sqlite|mongodb|openai|anthropic|gemini|langchain|embedding|pinecone|qdrant|chroma|weaviate|octokit|next-auth|clerk|DATABASE_URL|OPENAI_API_KEY|GITHUB_TOKEN` en `platform/` (sin `node_modules`, `.next` ni lockfile) → solo:
  ```text
  platform/.env.example:9:# GITHUB_TOKEN=
  platform/.env.example:13:# DATABASE_URL=
  platform/package.json:16: "class-variance-authority": ...   (falso positivo por "authority")
  ```
  Son placeholders **comentados** que `M0_AUDIT_PLAN.md:205-223` autoriza expresamente.
- **Variables de proveedor IA:** `platform/.env.example` no define ninguna; la sección de tutor dice solo `# Hito 6 — Tutor: variables a definir en su hito`. No hay `OPENAI_API_KEY` ni equivalente.
- **Estado/progreso/repos personales/evaluación:** inexistentes. Las etiquetas "Progreso"/"Tutor" son texto deshabilitado sin lógica (`app-shell.tsx:21-41`).
- **Datos demo/progreso:** los únicos datos de los tests son textos de UI y derivaciones del corpus; no hay fixtures educativos inventados (coherente con `ORCA.md:22-25` y `M0_AUDIT_PLAN.md:39`).
- No hay importador GitHub, snapshots, parser, BD, búsqueda funcional, auth, RAG, embeddings ni repositorios personales.

---

## 4. Sobreingeniería

**Veredicto: no hay sobreingeniería estructural; sí hay residuos menores y dependencias prescindibles.**

### 4.1 Dependencias

Uso verificado de cada dependencia de producción (`package.json:15-25`):

| Paquete                        | Uso real                                           | Veredicto             |
| ------------------------------ | -------------------------------------------------- | --------------------- |
| `next` / `react` / `react-dom` | Framework y render                                 | Necesario             |
| `shadcn`                       | `@import "shadcn/tailwind.css"` en `globals.css:3` | Necesario (ver 4.2)   |
| `cn`                           | `src/lib/utils.ts:1` y `ui/{button,card}.tsx`      | Necesario             |
| `class-variance-authority`     | `ui/button.tsx:2`                                  | Necesario             |
| `radix-ui`                     | Solo `Slot` en `ui/button.tsx:4`                   | Ver F-08 (sugerencia) |
| `tw-animate-css`               | `globals.css:2`                                    | Necesario             |
| `lucide-react`                 | **0 importaciones en `src/`**                      | Ver F-04 (menor)      |

### 4.2 `shadcn` como dependencia de producción: justificado

Comprobado que no es un error de clasificación: `globals.css:3` importa `shadcn/tailwind.css` y el paquete expone ese subpath:

```text
$ python3 -c "...json.load(.../shadcn/package.json)..."
{'./tailwind.css': './dist/tailwind.css'}
version: 4.21.0
```

El CLI vendorizado es requisito del estilo `radix-nova` (`components.json:3`). No se propone cambio.

### 4.3 Abstracciones y configuración

- No hay abstracciones prematuras: `AppShell` y `EmptySourceState` son componentes planos sin estado, providers ni stores. No hay carpetas `hooks/`, `services/`, `store/` ni features especulativas (`components.json:20` declara alias `@/hooks` pero la carpeta no existe).
- No hay configuración sobrante relevante: `next.config.ts` está vacío, `postcss.config.mjs` mínimo, `tsconfig.json` es el del scaffolding con `strict: true` (`tsconfig.json:7`), y no se añadió i18n ni plugins extra (correcto para M0).
- Residuos del template: ver F-09 (comentario placeholder en `next.config.ts:4`, `favicon.ico` por defecto de Next —25.931 bytes, 4 iconos—, entradas Yarn/PnP/Vercel en `.gitignore:7-11,37-38`) y F-10 (`AGENTS.md`/`CLAUDE.md` generados por `next dev`).

---

## 5. Coherencia documental

### 5.1 README de `platform/` vs realidad

| Afirmación del README                                                                                                       | Realidad verificada                                                                | Veredicto                                            |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| pnpm 12.8.1 fijado (`README.md:15-16`)                                                                                      | `package.json:5`: `"packageManager": "pnpm@12.8.1"`                                | Coherente                                            |
| Comandos `dev/build/start/lint/typecheck/test/test:watch`                                                                   | Scripts en `package.json:6-14`, coinciden literalmente                             | Coherente                                            |
| Typecheck = `next typegen && tsc --noEmit` (`README.md:36`)                                                                 | `package.json:11` y `tsconfig.json` con `strict: true`                             | Coherente (desviación justificada del plan, Next 16) |
| `src/test/ # tests (shell, higiene de entorno, guard)`                                                                      | El test de shell está en `src/components/app-shell.test.tsx`                       | **Desajuste (F-05)**                                 |
| Estructura incluye `public/` (`README.md:64`)                                                                               | `platform/public/` está vacío y no sobrevive a un clon (git no guarda dirs vacíos) | **Desajuste (F-11)**                                 |
| "La denylist se construye... a partir de `content/`... fail-closed" (`README.md:90-98`)                                     | Cierto con los matices de la sección 2                                             | Coherente, incompleto                                |
| Estructura omite `.env.example`, `.gitignore`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `AGENTS.md`, `CLAUDE.md`            | Existen en disco                                                                   | Simplificación (F-06/F-10)                           |
| Enlaces a `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `ORCA.md`, `MILESTONES.md`, `M0_FOUNDATION.md` (`README.md:100-106`) | Todos los archivos existen                                                         | Coherente                                            |

`.env.example` cumple AC-0.7: solo comentarios/placeholders (`env-example.test.ts:38-52` lo verifica), sin variables activas ni apariencia de secreto (`env-example.test.ts:14-23`).

### 5.2 ADR-006..008 vs implementación y DECISIONS

- **ADR-006** (`DECISIONS.md:35-42`): "vive en `platform/`, con su propio `package.json` y `pnpm-lock.yaml`, sin declarar workspaces" — se cumple en lo esencial (`platform/package.json`, `platform/pnpm-lock.yaml`). Matiz: existe `platform/pnpm-workspace.yaml` (sin `packages:`) con `allowBuilds: sharp: false, unrs-resolver: false`, ajuste de builds de pnpm 12. No es un workspace con paquetes, pero el archivo no está documentado y la redacción del ADR puede leerse como contradicción. Ver F-06.
- **ADR-007** (`DECISIONS.md:44-51`): Next App Router + TS strict (`tsconfig.json:7`, `layout.tsx:11-18`), Tailwind v4 (`postcss.config.mjs`, `globals.css:1`), shadcn vendorizado (`components.json`, `ui/`), ESLint flat (`eslint.config.mjs`), `tsc --noEmit` (`package.json:11`), Vitest + Testing Library (`vitest.config.ts`, `vitest.setup.ts`). Sin BD ni IA. **Coherente al 100%.**
- **ADR-008** (`DECISIONS.md:53-59`): denylist dinámica y fail-closed — implementado (`catalog-denylist.ts:77-118`) con las salvedades de la sección 2 (F-01..F-03). El ADR describe la intención correctamente; conviene precisar en él que el fail-closed cubre directorios, no corpus vacíos.
- Numeración y estilo continúan ADR-001..005 sin conflictos.

### 5.3 BACKLOG

`BACKLOG.md:19-28` contiene exactamente la sección "Infraestructura de plataforma (candidatas detectadas en M0)" y coincide con las candidatas de `M0_AUDIT_PLAN.md:338-345` (CI, prettier-plugin-tailwindcss, estrategia fork/upstream, migración a workspace, nombre definitivo, `.prettierignore`). Son **solo adiciones**; no se introdujo contenido educativo ni se movió nada del backlog previo (`BACKLOG.md:1-17`).

### 5.4 Archivos upstream de la raíz

```text
$ git diff --stat -- package.json pnpm-lock.yaml .gitignore README.md
 README.md | 97 +++++++++++++++++++++++++++++++++++++++------------------------
 1 file changed, 60 insertions(+), 37 deletions(-)
```

- `package.json`, `pnpm-lock.yaml` y `.gitignore` raíz: **sin cambios** (no aparecen en el diff).
- `README.md` raíz: modificado, pero es la divergencia **preexistente** documentada en `M0_AUDIT_PLAN.md:90` ("60 inserciones / 37 borrados"); el diffstat actual coincide exactamente, por lo que M0 no la incrementó. Ya está registrada en `BACKLOG.md:23-24`.
- `content/`, `marketing/`, `assets/`, `.cursor/`: `git status --porcelain -- content marketing assets .cursor` → vacío (limpios).
- `git status --porcelain` completo no muestra ningún archivo raíz nuevo atribuible a M0:
  ```text
   M README.md
  ?? AI_TUTOR.md ... ?? opencode.json
  ?? docs/milestones/
  ?? platform/
  ```
  (los `.md` raíz y `docs/milestones/` ya eran untracked en el baseline; `platform/` es la entrega de M0).

---

## 6. Hallazgos numerados

**Resumen: 0 bloqueantes · 7 menores · 6 sugerencias.**

### Bloqueantes

Ninguno. AC-0.10 se cumple (cruce independiente de 117 tokens = 0 coincidencias), no hay contenido inventado, no hay desbordamiento de alcance y no se han modificado archivos upstream por parte de M0.

### Menores

**F-01 — El guard no tiene control positivo (podría estar roto y seguir en verde).**
Evidencia: `no-hardcoded-catalog.test.ts:31-35` solo comprueba `violations == []`; ningún test inyecta un token conocido y espera detección.
Reproducción: la suite pasa (6/6) aunque `tokenPattern` no llegara a coincidir nunca.
Corrección propuesta: test unitario que escanee un fixture sintético (o llame a `scanForHardcodedCatalog` con un directorio/temporal) conteniendo `Brasaland` y afirme que `formatCatalogViolations` reporta la violación.

**F-02 — Falsos negativos con nombres naturalizados o compuestos.**
Evidencia: `catalog-denylist.ts:124-126` (token completo con límites `[a-z0-9-]`); experimento de la sección 2.3: `"OpenClaw connection"` y `"Edutrack"` **no** matchean `openclaw-connection` / `edutrack-data-audit-sql`, mientras que `"Brasaland"` sí matchea.
Reproducción: Node con la regex literal de `catalog-denylist.ts:125`.
Corrección propuesta: generar subtokens por segmento de los slugs (`openclaw`, `edutrack`, `telemetry`...) con el mismo filtro de longitud, y/o normalizar el texto separadores espacio/`_` → `-` antes de comparar. Complementar en M1 con los títulos reales de README si el importador los expone.

**F-03 — Fail-closed parcial: un corpus vacío o regresado no se detecta.**
Evidencia: solo se lanza error si faltan `content/` o los buckets (`catalog-denylist.ts:80-84, 98-102`); el único control de tamaño es `tokens.length > 0` (`no-hardcoded-catalog.test.ts:16`).
Reproducción: con `content/projects/` vacío y sin `CONTEXT-*`, el escaneo devuelve 0 violaciones y el test 3 pasa.
Corrección propuesta: aserciones mínimas por bucket (p. ej. ≥ 80 proyectos, ≥ 5 lecciones, ≥ 4 empresas) o un marcador/manifiesto esperado del corpus.

**F-04 — `lucide-react` declarada y no usada.**
Evidencia: `package.json:18`; `grep -rno 'lucide-react' platform/src` → 0 resultados (solo aparece en `components.json:13` como iconLibrary).
Corrección propuesta: eliminarla de `dependencies` o usarla; a efectos de M0 es peso muerto.

**F-05 — README desalineado con la ubicación real del test de shell.**
Evidencia: `README.md:63` describe `src/test/ # tests (shell, higiene de entorno, guard de catálogo)`; el test de shell está en `platform/src/components/app-shell.test.tsx:1`.
Corrección propuesta: mover el test a `src/test/` (como preveía `M0_AUDIT_PLAN.md:252-281`) o corregir el README.

**F-06 — `pnpm-workspace.yaml` sin documentar y ADR-006 ambiguo.**
Evidencia: `platform/pnpm-workspace.yaml:1-3` (`allowBuilds: sharp/unrs-resolver`) frente a `DECISIONS.md:41` ("sin declarar workspaces") y la estructura del README (`README.md:56-73`), que no lo menciona.
Aclaración verificada: no tiene clave `packages:` y `.pnpm-workspace-state-v1.json` lista un único proyecto `platform`; es política de builds de pnpm 12, no un workspace de paquetes.
Corrección propuesta: mencionarlo en la estructura del README y matizar ADR-006 ("sin miembros de workspace; `pnpm-workspace.yaml` solo contiene política de builds").

**F-07 — Aviso de Vite/Vitest: `vitest.config.ts` cargado como CommonJS.**
Evidencia literal de la ejecución:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'` ...
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set "type": "module" ...
```

Corrección propuesta: renombrar a `vitest.config.mts` (o añadir `"type": "module"` al `package.json` de `platform/`, evaluando su efecto en los `.mjs`/`.ts`).

### Sugerencias

**F-08 — `radix-ui` (suite completa) para un solo `Slot`.**
`ui/button.tsx:4` importa `Slot` de `radix-ui`; el paquete unificado instala todos los primitivos. Es el default del estilo `radix-nova` de shadcn, aceptable, pero podría sustituirse por `@radix-ui/react-slot` si se quiere minimizar dependencias. Sin acción obligatoria.

**F-09 — Residuos del template.**
`next.config.ts:4` conserva `/* config options here */`; `src/app/favicon.ico` es el favicon por defecto de Next (25.931 bytes, 4 iconos); `.gitignore:7-11,37-38` mantiene entradas de Yarn/PnP/Vercel no aplicables. Limpiar (o dejar el favicon como decisión de branding futura) y documentarlo.

**F-10 — `AGENTS.md` y `CLAUDE.md` generados por `next dev`.**
`platform/AGENTS.md:1-9` declara que el bloque lo escribe `next dev`; `CLAUDE.md:1` solo importa `@AGENTS.md`. No estaban en el plan ni en README. Decidir si se commitean (como sugiere el propio Next) o se ignoran, y reflejarlo en la estructura.

**F-11 — `public/` vacío listado como parte de la estructura.**
`README.md:64` lo incluye, pero está vacío y git no versiona directorios vacíos: tras un clon no existirá. Quitar la línea o añadir `.gitkeep` si se quiere conservar.

**F-12 — `@testing-library/dom` como devDependency explícita.**
`package.json:28`; ya figura como `peerDependencies` de `@testing-library/react@16`. Redundante pero inocuo; se puede eliminar si se quiere depurar la lista.

**F-13 — `README.md` raíz divergido (preexistente).**
Confirmado por diffstat (60/37) y documentado en `M0_AUDIT_PLAN.md:90`; ya registrado en `BACKLOG.md:23-24`. No requiere acción en M0; solo seguimiento para el Hito 9.

---

## Anexo — Trazabilidad de evidencias

- Guard: `platform/src/test/catalog-denylist.ts`, `platform/src/test/no-hardcoded-catalog.test.ts`; ejecución `vitest run src/test` → 2 archivos / 6 tests OK.
- Cruce independiente: 117 tokens (84 proyectos + 5 lecciones + 22 contextos + 208 `CONTEXT-*.md` normalizados), `grep -rniF -f` → `exit=1`.
- UI: `app-shell.tsx`, `empty-source-state.tsx`, `layout.tsx`, `page.tsx`; sin rutas adicionales.
- Scope: `package.json`, `pnpm-lock.yaml` (grep de paquetes prohibidos sin resultados), búsqueda de términos de hitos 1-9.
- Documental: `platform/README.md`, `DECISIONS.md:35-59`, `BACKLOG.md:19-28`, `M0_AUDIT_PLAN.md:90,205-223,285-321,338-345`, `M0_FOUNDATION.md:9-22`.
- Git: `git status --porcelain`, `git diff --stat -- package.json pnpm-lock.yaml .gitignore README.md` (solo README, preexistente).

---

## Re-QA tras correcciones (M0-R2)

- Fecha: 2026-10-02
- Autor: worker M0-R2 (terminal `term_f4f828d8-...`)
- Alcance: re-verificación hallazgo por hallazgo de F-01..F-13 tras `M0-FIX-T`, `M0-FIX-G` y `M0-FIX-D`, sobre `platform/`, `DECISIONS.md` y `BACKLOG.md`. **READ-ONLY**: el único cambio de esta tarea es esta sección.
- Resultado global: **0 bloqueantes**. 9 resueltos (F-01, F-03, F-04, F-05, F-06, F-07, F-09, F-10, F-11), 2 diferidos a BACKLOG con línea (F-02 subtokens, F-08 radix-ui) y 2 sin corrección en este ciclo por ser opcionales/preexistentes (F-12, F-13). AC-0.10 sigue cumpliéndose: cruce independiente de 117 tokens = 0 coincidencias y el guard ahora tiene control positivo, normalización y fail-closed por bucket.

### 1. Estado de F-01..F-13, con evidencia

| ID   | Estado                 | Evidencia (archivo:línea)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | **Resuelto**           | Control positivo real en `platform/src/test/no-hardcoded-catalog.test.ts:79-102`: deriva un token multi-segmento del corpus en runtime (`:34-44`), lo inyecta en un directorio temporal (`:82-84`) y exige detección con `archivo:línea` (`:91-100`). El matcher es parametrizable (`platform/src/test/catalog-denylist.ts:183-211`), por lo que el test ya no puede quedar verde con un matcher roto.                                                                                   |
| F-02 | **Diferido a BACKLOG** | La normalización sí se resolvió: `normalizeCatalogText` convierte espacios/`_` en `-` y colapsa repeticiones (`catalog-denylist.ts:36,38,52-57`), y se aplica a cada línea antes del match (`:196-199`); hay tests con un token real multi-segmento escrito "Spaced CamelCase" y con `_` (`no-hardcoded-catalog.test.ts:104-142`). La generación de subtokens por segmento (p. ej. `Edutrack` dentro de `edutrack-data-audit-sql`) sigue pendiente y ahora figura en `BACKLOG.md:29-30`. |
| F-03 | **Resuelto**           | Fail-closed por bucket: se cuentan contribuciones por bucket (`catalog-denylist.ts:100-112`) y se lanza error explícito si algún bucket aporta 0 tokens elegibles (`:139-145`); tests `it.each` por bucket, incluido corpus vacío (`no-hardcoded-catalog.test.ts:144-170`).                                                                                                                                                                                                              |
| F-04 | **Resuelto**           | `lucide-react` ya no está en `platform/package.json:15-40`. Queda `"iconLibrary": "lucide"` como metadata inerte del CLI en `platform/components.json:13` (no instala ni importa nada en runtime).                                                                                                                                                                                                                                                                                       |
| F-05 | **Resuelto**           | `platform/README.md:63` y `:83-85` documentan que el test del shell vive en `src/components/app-shell.test.tsx`, que es su ubicación real. Se optó por alinear el README en lugar de mover el test (desviación aceptada del esquema de `M0_AUDIT_PLAN.md:278`).                                                                                                                                                                                                                          |
| F-06 | **Resuelto**           | `pnpm-workspace.yaml` explicado en `platform/README.md:74,86-88` (política de builds sin miembros de workspace) y ADR-006 matizado en `DECISIONS.md:44-48`.                                                                                                                                                                                                                                                                                                                              |
| F-07 | **Resuelto**           | `platform/vitest.config.ts` → `platform/vitest.config.mts:1`; la ejecución ya no emite el aviso de Vite cargando ESM como CommonJS; `tsconfig.json:31` incluye `**/*.mts` y `platform/README.md:77` refleja el nombre nuevo.                                                                                                                                                                                                                                                             |
| F-08 | **Diferido a BACKLOG** | Candidata registrada en `BACKLOG.md:31-32` ("Sustituir la suite `radix-ui` por primitivos sueltos..."). No se cambió la dependencia (`platform/src/components/ui/button.tsx:4` sigue usando `Slot` de `radix-ui`).                                                                                                                                                                                                                                                                       |
| F-09 | **Resuelto**           | `platform/next.config.ts:3` ya no conserva `/* config options here */`; `platform/src/app/favicon.ico` eliminado (verificado ausente); `platform/.gitignore:1-32` ya no incluye las secciones Yarn/PnP/Vercel del template. Residuo cosmético: `yarn-debug.log*`/`yarn-error.log*` en `.gitignore:22-23`; el `.gitignore` raíz permanece intacto (upstream).                                                                                                                             |
| F-10 | **Resuelto**           | Decisión "se versionan tal cual" documentada en `platform/README.md:68-69,89-90`; `platform/AGENTS.md` y `platform/CLAUDE.md` existen.                                                                                                                                                                                                                                                                                                                                                   |
| F-11 | **Resuelto**           | `platform/README.md:91-92` explica que `public/` no se lista por no versionarse vacío. Verificado: `platform/public/` solo existe como directorio vacío local (sin archivos rastreados); ya no aparece en la estructura del README.                                                                                                                                                                                                                                                      |
| F-12 | **No aplica**          | Sugerencia opcional ("redundante pero inocuo" en el informe original). `@testing-library/dom` sigue en `platform/package.json:27`; no requería corrección para M0.                                                                                                                                                                                                                                                                                                                       |
| F-13 | **No aplica**          | Divergencia preexistente del `README.md` raíz: `git diff --stat -- README.md` sigue marcando 60 inserciones/37 borrados, idéntico al baseline de `M0_AUDIT_PLAN.md:90`. Ya registrada en `BACKLOG.md:23-24`; M0 no la incrementó.                                                                                                                                                                                                                                                        |

### 2. Revisión de los nuevos tests del guard (M0-FIX-G)

Los tres controles pedidos son reales, no decorativos:

1. **Control positivo** (`no-hardcoded-catalog.test.ts:79-102`): inyecta un token obtenido del corpus real en un `.ts` temporal y afirma `token`, `line` y `file` de la violación. No usa una lista fija: `pickRealMultiSegmentToken` (`:34-44`) deriva el token de `collectCatalogTokens()` y falla si el corpus no tuviera ninguno multi-segmento.
2. **Normalización** (`no-hardcoded-catalog.test.ts:104-142`): test unitario de `normalizeCatalogText` con cadenas neutras (`"Nombre Compuesto"`, `"nombre__compuesto"`) más un test que reescribe un token real del corpus con espacios (`toSpacedCamelCase`, `:46-51`) y con guiones bajos, y exige detección en ambos archivos temporales.
3. **Fail-closed por bucket** (`no-hardcoded-catalog.test.ts:144-170`): `it.each` vacía cada bucket por separado sobre un `content/` temporal y exige `throw` que nombra el bucket; un cuarto test vacía los tres y exige mención `fail-closed`.

**No hay nombres del syllabus hardcodeados en los tests**: los únicos literales son genéricos (`"nombre-compuesto"`, `sample-projects`, `injected`, nombres de bucket del contrato). El cruce independiente de 117 tokens (sección 3) escaneó también `platform/src/test/` y devolvió 0 coincidencias.

**Ejecución** (solo tests; sin install/build/start/dev):

```text
$ npx --yes pnpm@12.8.1 --dir platform exec vitest run src/test
 Test Files  2 passed (2)
      Tests  13 passed (13)

$ npx --yes pnpm@12.8.1 --dir platform exec vitest run
 Test Files  3 passed (3)
      Tests  18 passed (18)
```

Observaciones residuales (no bloqueantes, ninguna exige acción en M0):

- El escaneo excluye el propio archivo del guard (`catalog-denylist.ts:172` con `guardFilePath` = `no-hardcoded-catalog.test.ts:16,73`): un nombre hardcodeado _dentro de ese test_ no sería detectado. Hoy no existe ninguno (verificado con el cruce independiente); si se quiere eliminar el punto ciego, la exclusión podría restringirse únicamente al helper.
- La normalización introducida para F-02 convierte espacios en guiones en toda la línea; podría producir falsos positivos futuros con frases genéricas si un token del corpus coincidiera con ellas. Hoy no ocurre: el escaneo real está en verde.
- Queda `"iconLibrary": "lucide"` en `components.json:13` como residuo de la retirada de `lucide-react` (F-04); solo afecta a un futuro `shadcn add`. Candidata a limpieza/BACKLOG.

### 3. Cruce independiente content/ → platform/ (0 coincidencias)

Se repitió el cruce sin usar el guard: tokens de los directorios de primer nivel de `content/projects` (87), `content/lessons` (5) y `content/contexts` (24), más los basenames normalizados de los 208 archivos `CONTEXT-*.md`, filtrando longitud ≥ 5 y no numéricos:

```text
$ { find content/projects -mindepth 1 -maxdepth 1 -type d -exec basename {} \; ; \
    find content/lessons -mindepth 1 -maxdepth 1 -type d -exec basename {} \; ; \
    find content/contexts -mindepth 1 -maxdepth 1 -type d -exec basename {} \; ; \
    find content/contexts -iname 'CONTEXT-*.md' -exec basename {} \; | \
      sed -E 's/^[Cc][Oo][Nn][Tt][Ee][Xx][Tt]-//; s/\.(es|en)?\.?md$//' ; } \
  | tr '[:upper:]' '[:lower:]' | sort -u \
  | awk 'length($0) >= 5 && $0 !~ /^[0-9]+$/' > /tmp/m0r2_names.txt
$ wc -l < /tmp/m0r2_names.txt
117
$ cd platform && grep -rniF -f /tmp/m0r2_names.txt --exclude-dir=node_modules \
    --exclude-dir=.next --exclude=pnpm-lock.yaml --exclude=tsconfig.tsbuildinfo -I .
$ echo $?
1
```

La comprobación manual de `M0_AUDIT_PLAN.md:309-313` (`CONTEXT-|content/projects|content/lessons|content/contexts`) solo devuelve autorreferencias del guard:

```text
src/test/no-hardcoded-catalog.test.ts:61:  expect(token.startsWith("context-")).toBe(false);
src/test/catalog-denylist.ts:82:    .replace(/^context-/, "")
src/test/catalog-denylist.ts:129:    if (!/^context-.*\.md$/i.test(baseName)) {
```

### 4. Contenido inventado, hitos 1-9 y sobreingeniería nueva

- **Contenido educativo inventado: no.** El texto humano sigue siendo UI neutra (`platform/src/components/app-shell.tsx:3-9,16-18,51`; `empty-source-state.tsx:14-24`; `layout.tsx:5-9`) y el único dato con nombre real es la procedencia del repositorio en el footer (`app-shell.tsx:51`), permitida por `M0_AUDIT_PLAN.md:227`. El cruce de la sección 3 confirma 0 nombres del catálogo.
- **Funcionalidad de hitos 1-9: no.** `src/app/` solo contiene `globals.css`, `layout.tsx` y `page.tsx` (no hay `api/`, `middleware.ts`, `pages/` ni rutas adicionales). La búsqueda de `supabase|prisma|drizzle|postgres|sqlite|mongodb|openai|anthropic|gemini|langchain|embedding|pinecone|qdrant|chroma|weaviate|octokit|next-auth|clerk|DATABASE_URL|OPENAI_API_KEY|GITHUB_TOKEN` en `platform/` solo devuelve los placeholders comentados de `.env.example:9,13`, autorizados por `M0_AUDIT_PLAN.md:205-223`. El lockfile no contiene ninguno de esos paquetes y las dependencias de `platform/package.json` no incluyen GitHub, BD/ORM, auth, búsqueda, LLM/RAG ni evaluación.
- **Sobreingeniería nueva: no.** Los cambios de los fixes son test/helper (`src/test/*`), configuración de test (`vitest.config.mts`), docs (`README.md`, `.prettierignore`) y una retirada de dependencia (`lucide-react`); no se añadió ninguna dependencia de producción ni abstracción de aplicación. Los únicos archivos nuevos del ciclo son config/test, no features.

### 5. Archivos upstream de la raíz

```text
$ git diff --stat -- package.json pnpm-lock.yaml .gitignore
(sin salida: intactos)
$ git diff --stat -- README.md
 README.md | 97 ++++++++++++++++++++++++++++++++++++++++------------------------
 1 file changed, 60 insertions(+), 37 deletions(-)   # divergencia preexistente (F-13)
$ git status --porcelain -- content marketing assets .cursor
(sin salida: limpios)
```

`git status --porcelain` global sigue mostrando solo ` M README.md` (preexistente) y untracked preexistentes (`docs/milestones/`, documentos raíz, `opencode.json`, `platform/`). Ningún archivo raíz fue modificado por M0-FIX-\* ni por esta re-QA.
