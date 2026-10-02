# M0 — Auditoría y Plan Mínimo

- Hito: **Hito 0 — Fundación** (`docs/milestones/M0_FOUNDATION.md`)
- Estado: auditoría READ-ONLY + propuesta; no se ha implementado nada.
- Fecha de la auditoría: 2026-10-02
- Repo auditado: fork `Aresdgi/ai-engineering-syllabus` de `4GeeksAcademy/ai-engineering-syllabus`
- Commit fuente actual (HEAD local): `962c1e5fc8ebad273abaa348fb3d161568ce8707`
- Documentos leídos completos: `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `REPO_MAP.md`, `PRODUCT.md`, `MILESTONES.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SPECS.md`, `ORCA.md`, `DECISIONS.md`, `STATUS.md`, `BACKLOG.md`, `AI_TUTOR.md`, `docs/milestones/M0_FOUNDATION.md`.

---

## 1. Requisitos exactos (AC-0.1 .. AC-0.10)

Lista literal de AC tomada de `docs/milestones/M0_FOUNDATION.md` (líneas 9-18), con interpretación verificable. La ruta de la app se asume `platform/` según la decisión de la sección 4.

| AC | Texto literal | Interpretación verificable | Comando / evidencia |
|----|---------------|----------------------------|---------------------|
| AC-0.1 | `Next.js + TypeScript funciona` | Existe una app Next.js (App Router) en `platform/` con TypeScript en modo strict; compila y sirve una ruta `/`. | `pnpm --dir platform build` termina en 0 y genera `platform/.next/`; `pnpm --dir platform dev` y `curl -fsS http://localhost:3000/` devuelve HTML con el texto del shell; `platform/tsconfig.json` con `"strict": true`. |
| AC-0.2 | `Tailwind funciona` | Tailwind está integrado al build (Tailwind v4: `@import "tailwindcss"` en `globals.css` + `@tailwindcss/postcss` en `postcss.config.mjs`) y las clases usadas por el shell se compilan a CSS real (no solo aparecen en el JSX). | `pnpm --dir platform build`; comprobar que `platform/.next/static/css/*.css` contiene al menos una utilidad usada exclusivamente por el shell (p. ej. `.flex`); test de shell que verifica que el contenedor tiene clases Tailwind. |
| AC-0.3 | `shadcn/ui configurado` | Existe `platform/components.json` (generado por el CLI, no a mano) con aliases correctos; existe `platform/src/lib/utils.ts` con `cn`; al menos un componente de `platform/src/components/ui/` (p. ej. `button` y `card`) se usa en el shell. | Archivos presentes + `pnpm --dir platform typecheck` en 0 + `pnpm --dir platform build` en 0; `npx shadcn@latest add` funciona (acción de desarrollo con red; los componentes quedan vendorizados en el repo). |
| AC-0.4 | `lint configurado` | ESLint en flat config (`platform/eslint.config.mjs`) con `eslint-config-next`; script `lint` ejecutable y en verde. | `pnpm --dir platform lint` termina en 0. Control negativo documentado (no se commitea): un `const x: any` o variable sin usar debe hacer fallar el lint (`platform/package.json` script `lint`: `eslint .`; Next 16 ya no usa `next lint`). |
| AC-0.5 | `typecheck configurado` | Script dedicado que ejecuta `tsc --noEmit` sobre `src/` y archivos de config, con `strict`. | `pnpm --dir platform typecheck` termina en 0. Control negativo documentado: asignar `"x"` a un `number` debe fallar. |
| AC-0.6 | `tests configurados` | Vitest + Testing Library configurados (jsdom para componentes, node para el guard de catálogo), con script no-watch para CI y al menos los tests mínimos de la sección 5.3 en verde. | `pnpm --dir platform test` ejecuta `vitest run` y pasa. Los tests corren solo dentro de `platform/`; `pnpm test` en la raíz **no** debe usarse (su script upstream termina en 1, ver sección 3). |
| AC-0.7 | `.env.example` | Existe `platform/.env.example` versionado (la raíz ya tiene `!.env.example` en `.gitignore`, sección 3) con **cero variables activas**: M0 no necesita ninguna. Solo comentarios y placeholders claramente marcados como futuros y no implementados. | `git check-ignore -v platform/.env.example` no debe ignorarlo; `pnpm --dir platform build` y `pnpm --dir platform test` pasan sin `.env`; test de higiene de env (sección 5.3). |
| AC-0.8 | `layout base` | Shell neutro: nombre provisional, navegación estructural (items futuros deshabilitados, sin rutas falsas), estado explícito **"Contenido todavía no sincronizado"** y ausencia total de contenido educativo. | Test de smoke del shell (sección 5.3) que afirma el texto de estado, los landmarks (`header`/`nav`/`main`/`footer`) y que no aparece ningún nombre del catálogo; inspección visual en `dev`. |
| AC-0.9 | `README de desarrollo` | `platform/README.md` con prerequisitos, install, dev, build, lint, typecheck, test, env, estructura y alcance/exclusiones de M0. | `platform/README.md` existe y cada comando documentado se ejecuta con el resultado indicado. El `README.md` raíz **no se toca** en M0. |
| AC-0.10 | `no existe catálogo educativo hardcodeado` | Ningún archivo de la app contiene nombres de proyectos, contextos, empresas o lecciones del repo fuente; el guard automatizado de la sección 6 falla si aparecen. | `pnpm --dir platform test` incluye `no-hardcoded-catalog.test.ts` en verde; comprobación manual complementaria con `rg` (sección 6). |

Demo del hito (`M0_FOUNDATION.md` línea 22): *"App shell sin contenido ficticio"* — el estado vacío explícito de AC-0.8 es la demo.

---

## 2. Restricciones aplicables a M0

Extraídas de la documentación; toda implementación de M0 debe respetarlas.

### 2.1 Contenido educativo

- `ORCA.md:9-23`: **NO INVENTAR CONTENIDO EDUCATIVO**. Prohibido crear cursos/módulos/proyectos demo, requisitos, lecciones, quizzes, contextos, rúbricas u orden alternativo. Si se necesitaran fixtures de prueba, deben salir del repo real y conservar su source path (`ORCA.md:23-25`) — para M0 **no se necesitan fixtures educativos**: el shell se prueba con textos de UI.
- `SOURCE_OF_TRUTH.md:52-62`: la plataforma no puede inventar módulos, lecciones intermedias, requisitos, rúbricas, secuencia ni objetivos. Sí puede crear UI ("Continuar aprendiendo", "Buscar", etc. — `SOURCE_OF_TRUTH.md:66-78`).
- `CONTENT_CONTRACT.md:40-52`: prohibido persistir contenido DERIVED como curso; la fidelidad del renderer se aplicará en hitos posteriores.
- `DECISIONS.md` ADR-001/ADR-004/ADR-005: el repo es la única fuente pedagógica, la ingesta va antes que el LMS, y la IA no puede persistir contenido oficial.

### 2.2 Alcance: nada de hitos 1-9

M0 es solo fundación técnica. Queda **excluido explícitamente**:

| Hito | Exclusión en M0 |
|------|-----------------|
| 1 — Ingestión (`docs/milestones/M1_INGESTION.md`) | Sin lector de GitHub, sin snapshots, sin parser/validador, sin DB fuente. |
| 2 — Navegador del syllabus | Sin catálogo real, sin vistas de proyecto/contexto/lección, sin orden leído de `content/projects/README.md`. |
| 3 — Progreso (`DATA_MODEL.md:74-100`) | Sin `user_progress`, notas, bookmarks ni persistencia de usuario. |
| 4 — Contextos/assets/relaciones | Sin `source_relations` ni render de assets. |
| 5 — Búsqueda | Sin índice ni search UI funcional. |
| 6 — Tutor IA (`AI_TUTOR.md`) | Sin RAG, embeddings, LLM, claves de IA ni endpoint de tutor. |
| 7 — Repos personales | Sin `linked_project_repositories`. |
| 8 — Evaluación | Sin comparación contra criterios ni rúbricas. |
| 9 — Sincronización upstream | Sin detección de cambios ni snapshots; solo se deja el repo preparado para no conflictuar (sección 4). |

`ARCHITECTURE.md:47-56` sugiere PostgreSQL/Supabase: es stack de hitos de datos (M1+), no de M0. **No se añade ninguna dependencia de base de datos ni variable activa**.

### 2.3 Entrega (reglas ORCA)

- `ORCA.md:39-42`: solo trabajar el hito activo de `STATUS.md` (Hito 0).
- `ORCA.md:77-86` (`Final de tarea`): verificar build, typecheck, lint y tests antes de dar una tarea por terminada.
- `ORCA.md:98-100`: ideas ajenas al hito van a `BACKLOG.md`, no se implementan.
- `ORCA.md:102-108`: pregunta de seguridad — "¿esto ayuda a consumir el repo o está inventando un curso nuevo?" Todo lo propuesto en este plan es infraestructura/UI.

---

## 3. Inventario del repo relevante para M0

### 3.1 Herramientas comprobadas en la máquina

| Herramienta | Resultado | Nota para M0 |
|-------------|-----------|--------------|
| `node -v` | `v26.10.0` | Cumple `engines` de Next 16 (`>=20.9.0`). |
| `pnpm -v` | **no instalado** (`command not found`) | Hay que instalarlo o usar `npx pnpm`; Node 26 ya no trae Corepack (`corepack` tampoco existe). |
| `npx --yes pnpm --version` | `12.8.1` | El lockfile raíz es `lockfileVersion: '9.0'` (generado por pnpm 9.x), no por pnpm 12. |
| `npm -v` | `11.19.1` | Disponible como fallback y para instalar pnpm. |
| `git --version` | `2.50.1` | — |

### 3.2 Archivos raíz relevantes (propiedad upstream)

- **`package.json` raíz**: paquete `ai-engineering-syllabus` (sin `"private"`, sin `workspaces`, sin `packageManager`). Scripts: `format:check` y `format` con Prettier, y `"test": "echo \"Error: no test specified\" && exit 1"` — es decir, **`pnpm test` en la raíz falla por diseño**. devDependency: `prettier ^3.8.3`.
- **`pnpm-lock.yaml` raíz**: `lockfileVersion 9.0`, un único importer `.` con `prettier 3.8.3`. Tocarlo o regenerarlo con otra versión de pnpm produce *churn* y conflictos con upstream.
- **`.gitignore` raíz**: ignora `node_modules/`, logs (incluido `pnpm-debug.log*`), `*.pyc`, `.env` y `.env.*` con excepción `!.env.example` (sin slash: aplica a cualquier profundidad), `dist/`, `build/`, `coverage/`, `.DS_Store`, `.idea/`, `.vscode/`. **No** ignora `.next/`, `*.tsbuildinfo` ni `.turbo/`.
- **Prettier**: no hay `.prettierrc`, `.prettierignore` ni config en `package.json` → se usan los defaults. `format:check` corre sobre `.` (todo el repo, incluida la futura carpeta de la app). Prettier 3 respeta `.gitignore` por defecto, así que `node_modules/` y `.next/` no se chequean, pero sí el código fuente de la app.
- **`opencode.json`** (untracked, ajeno a M0): fija el modelo del agente. No tocar.
- **`README.md` raíz**: **ya fue modificado** respecto a upstream (60 inserciones / 37 borrados; ahora describe la plataforma). Es un cambio preexistente, no atribuible a esta auditoría.
- **Documentos de plataforma** (`SOURCE_OF_TRUTH.md`, etc.) y `docs/milestones/`: untracked. Baseline preexistente.
- **`docs/syllabus/New Syllabus AI Engineer - Planificación del programa.csv`**: planificación del programa; **no** es corpus para la app y queda fuera de M0 (y del importador de M1, que lee GitHub).

### 3.3 Contenido que M0 no debe tocar (SOURCE)

| Área | Tamaño / recuento | Uso en M0 |
|------|-------------------|-----------|
| `content/` | ~14 MB, 899 archivos; 85 dirs en `projects/`, 23 en `contexts/`, 6 en `lessons/` | Solo como **denylist dinámica** del test AC-0.10 (sección 6). No se importa ni se copia. |
| `marketing/` | 112 KB, 10 archivos | Fuera de alcance. |
| `assets/` | 108 KB | Fuera de alcance. |
| `.cursor/` | reglas y skills de producción de contenido | Herramientas de contenido, no de plataforma; no tocar. |
| `docs/milestones/M1..M9` | ya existen | Referencia de fronteras de alcance; no implementar. |

### 3.4 Estado git observado (baseline)

`git status --porcelain` antes de esta auditoría: ` M README.md`, y untracked: los 13 documentos de plataforma, `docs/milestones/` (directorio completo, 0 archivos trackeados) y `opencode.json`. Ninguno de esos cambios es de esta tarea; este informe añade únicamente `docs/milestones/M0_AUDIT_PLAN.md`.

### 3.5 Riesgos detectados

1. **`test` raíz termina en 1**: cualquier CI o script que ejecute tests en la raíz fallará. Mitigación: los tests de la app se ejecutan con `pnpm --dir platform test`; no editar el script upstream en M0.
2. **pnpm no instalado y sin Corepack**: hay que instalar/pinnear pnpm. Usar `npx pnpm` sin fijar versión puede descargar una versión distinta en cada ejecución.
3. **Deriva de lockfile raíz**: ejecutar `pnpm install` en la raíz con pnpm 12 puede reescribir `pnpm-lock.yaml` v9 y generar conflictos con upstream. Mitigación: **nunca** correr pnpm en la raíz; la app tiene su propio lockfile.
4. **Prettier raíz escanea la app**: `format:check` incluye `platform/`; si el código no está formateado con Prettier por defecto (y su `.gitignore` no cubre el archivo), el check raíz fallará. Mitigación: `platform/.gitignore` propio + correr `npx prettier --write platform` como parte del gate.
5. **`.gitignore` raíz incompleto para Next**: falta `.next/`, `*.tsbuildinfo`, `.turbo/`. Mitigación: `platform/.gitignore` (archivo nuevo, no upstream), sin editar el raíz.
6. **README raíz ya divergente**: el merge de upstream (Hito 9) conflictuará en `README.md` y potencialmente en docs raíz. Fuera de M0, pero condiciona la decisión de ubicación (sección 4) y merece una candidata a backlog (sección 7).
7. **Node 26 muy nuevo**: cumple `engines` de Next 16, pero conviene fijar versiones con lockfile y documentar `>=20.9` en `platform/README.md`; no asumir compatibilidad de otros tooling sin probarla.
8. **Contenido pesado (899 archivos)**: todo tooling de la app debe quedar confinado a `platform/` para que ESLint/tsc/Vitest no recorran `content/`.
9. **Superficie de merge**: cada archivo raíz que la plataforma modifique (package.json, lockfile, .gitignore, README) es un conflicto futuro con upstream. La decisión de la sección 4 minimiza esa superficie.
10. **shadcn/ui requiere red** en `init/add` (acción de desarrollo, una sola vez); los componentes quedan vendorizados y no hay dependencia runtime del CLI.

---

## 4. Decisión recomendada de ubicación de la app

### 4.1 Opciones evaluadas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| **A. Raíz del repo** (el `package.json` raíz pasa a ser la app) | Rutas simples; un solo install. | Modifica archivos upstream (`package.json`, `pnpm-lock.yaml`); conflicto garantizado en cada sync; mezcla SOURCE y código de app en el mismo nivel; contradice la separación de `ARCHITECTURE.md:5-19`. |
| **B. `apps/web/` con pnpm workspace raíz** | Preparado para múltiples paquetes. | Exige editar el `package.json` raíz (`workspaces`, `private`) y regenerar el lockfile raíz → máximo conflicto con upstream; sobredimensionado para una sola app (YAGNI). |
| **C. `platform/` como paquete independiente** (sin workspace) | Rutas disjuntas de `content/`, `marketing/`, `assets/`; cero ediciones en archivos upstream; lockfile propio; nombres alineados con la documentación ("la plataforma"). | Hay que entrar al subdirectorio o usar `pnpm --dir platform`; el Prettier raíz lo escanea (mitigable). |

### 4.2 Decisión

**Adoptar la opción C: `platform/` como proyecto pnpm independiente, con su propio `package.json` y `pnpm-lock.yaml`, sin declarar workspaces.**

Justificación:

1. **Separación SOURCE / plataforma** (`ARCHITECTURE.md`, `PRODUCT.md`): `content/`, `marketing/`, `assets/`, `.cursor/` y los docs fuente quedan intactos en la raíz; el código de producto vive aislado en `platform/src/`. Se puede razonar sobre "qué es fuente" sin ambigüedad.
2. **Sincronización upstream (Hito 9)**: el sync será `git fetch upstream && git merge upstream/main` (o rebase). Como la app no toca ningún path que upstream edite (`content/`, `marketing/`, `assets/`, `package.json`, `pnpm-lock.yaml`, `.gitignore`), el merge es **path-disjoint** salvo los archivos raíz que la plataforma ya modificó por su cuenta (p. ej. `README.md`), que quedan como deuda explícita y no empeoran por M0.
3. **Cero `churn` en el lockfile raíz**: upstream mantiene activamente `pnpm-lock.yaml` (commit `e4aae3f "Fix dependencies with pnpm"`); un workspace raíz obligaría a regenerarlo y a resolver conflictos en cada sync.
4. **Despliegue sencillo**: Next/Vercel permite fijar `platform/` como Root Directory del proyecto. `content/` no viaja al bundle de la app y el guard de AC-0.10 se ejecuta en CI dentro del fork completo.
5. **`platform/` en lugar de `apps/web/`**: `apps/` solo aporta valor con un workspace y varios paquetes; la documentación del proyecto ya llama "la plataforma" a la app. Si en el futuro aparecen más apps/paquetes, la migración a workspace es mecánica (candidata a backlog).

### 4.3 Reglas de convivencia (obligatorias durante la implementación)

- **No editar**: `package.json`, `pnpm-lock.yaml`, `.gitignore`, `README.md` raíz, ni nada bajo `content/`, `marketing/`, `assets/`, `.cursor/`, ni los docs de plataforma existentes.
- `platform/package.json` con `"private": true` y `"packageManager": "pnpm@<versión fijada>"` (recomendado: la misma que genere el lockfile de `platform/`, p. ej. `pnpm@12.8.1`, verificada instalable hoy).
- Todos los comandos de la app se ejecutan como `pnpm --dir platform <script>` o dentro de `platform/`. **Nunca** `pnpm install` en la raíz.
- `platform/.gitignore` propio con `.next/`, `node_modules/`, `coverage/`, `*.tsbuildinfo`, `.env*` y `!.env.example`.
- El código de la app se formatea con Prettier (defaults) para que `npx prettier --check platform` pase; el `format:check` raíz queda verde sin tocar su configuración.

---

## 5. Stack y herramientas concretas para cumplir cada AC

### 5.1 Stack base (mínimo)

Versiones estables comprobadas en el registro npm el 2026-10-02; se fijarán vía lockfile de `platform/`:

| Pieza | Paquete / versión de referencia | Uso en M0 |
|-------|--------------------------------|-----------|
| Framework | `next@16.3.8` (App Router, `src/`, alias `@/*`) | AC-0.1, AC-0.8 |
| UI | `react@19.3.0`, `react-dom` | AC-0.1 |
| Lenguaje | `typescript` (strict) | AC-0.1, AC-0.5 |
| Estilos | `tailwindcss@4.3.3` + `@tailwindcss/postcss` (CSS-first, sin `tailwind.config`) | AC-0.2 |
| Componentes | `shadcn@4.21.1` CLI → componentes vendorizados (`button`, `card`) | AC-0.3 |
| Lint | `eslint` + `eslint-config-next@16.3.8` (flat config `eslint.config.mjs`; Next 16 ya no tiene `next lint`) | AC-0.4 |
| Tipos | `tsc --noEmit` | AC-0.5 |
| Tests | `vitest@5.0.3`, `jsdom@30.1.1`, `@vitejs/plugin-react@6.1.1`, `@testing-library/react@16.3.3`, `@testing-library/jest-dom@7.0.1` | AC-0.6, AC-0.10 |
| Formato | Prettier (el del root; defaults) | Gate global |

Sin dependencias de base de datos, LLM, GitHub ni estado en M0.

### 5.2 Mapeo AC → herramientas/archivos concretos

| AC | Implementación mínima |
|----|-----------------------|
| AC-0.1 | `create-next-app` con `--typescript --app --src-dir --import-alias "@/*"`; script `build`. |
| AC-0.2 | Tailwind integrado por `create-next-app --tailwind`; el shell usa utilidades Tailwind (layout, spacing, colores semánticos). |
| AC-0.3 | `npx shadcn@latest init` (genera `components.json`, `src/lib/utils.ts`, tokens en `globals.css`) + `add button card`; el estado vacío usa `Card` y `Button`. |
| AC-0.4 | `eslint.config.mjs` + script `"lint": "eslint ."`. |
| AC-0.5 | script `"typecheck": "tsc --noEmit"`; `strict`, `noUncheckedIndexedAccess` opcional. |
| AC-0.6 | `vitest.config.ts` (jsdom + setup), `vitest.setup.ts` (`@testing-library/jest-dom`), scripts `"test": "vitest run"`, `"test:watch": "vitest"`. |
| AC-0.7 | `platform/.env.example` (contenido en 5.4). |
| AC-0.8 | `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/app-shell.tsx`, `src/components/empty-source-state.tsx` (spec en 5.5). |
| AC-0.9 | `platform/README.md` (esquema en 5.6). |
| AC-0.10 | `src/test/no-hardcoded-catalog.test.ts` (diseño en sección 6). |

### 5.3 Tests mínimos propuestos

1. **`no-hardcoded-catalog.test.ts`** (AC-0.10, entorno node) — ver sección 6.
2. **`app-shell.test.tsx`** (AC-0.8, jsdom):
   - renderiza el shell y verifica el texto exacto `Contenido todavía no sincronizado`;
   - verifica landmarks `header`, `nav`, `main`, `footer` y que los items de navegación futura están deshabilitados (`aria-disabled`), no enlazados a rutas implementadas;
   - verifica que el documento no contiene ninguno de los nombres del denylist (reutiliza el mismo helper que el test 1).
3. **`env-example.test.ts`** (AC-0.7, entorno node):
   - el archivo `platform/.env.example` existe;
   - ninguna línea no comentada define una variable con valor no vacío (M0 no requiere variables);
   - no contiene valores con pinta de secreto (`sk-`, `ghp_`, JWT, URLs con credenciales);
   - todos los placeholders futuros están comentados.

Opcional (no obligatorio): test de que `platform/src` no contiene archivos `.md` copiados del corpus. Se puede cubrir con una regla del test 1.

### 5.4 Contenido de `platform/.env.example`

Solo comentarios; ninguna variable activa. Borrador:

```dotenv
# M0 (Fundación): la app shell no requiere variables de entorno.
# Copia este archivo a .env.local solo cuando un hito posterior lo necesite.
#
# --- Placeholders de hitos FUTUROS (NO implementados en M0) ---
# Hito 1 — Ingestión del repositorio fuente:
# GITHUB_TOKEN=
# GITHUB_REPO=4GeeksAcademy/ai-engineering-syllabus
# Hito 1+ — Persistencia (se decidirá en su hito):
# DATABASE_URL=
# Hito 6 — Tutor fundamentado:
# OPENAI_API_KEY=
```

Regla: ningún nombre real, ningún valor, ningún `NEXT_PUBLIC_*` activo.

### 5.5 Layout base neutro (AC-0.8)

- **Nombre provisional**: `AI Engineering Study Platform` (o su versión corta "Study Platform"). Sin marcas de 4Geeks en el branding de la app; el repo fuente se menciona solo como procedencia en el footer (`Fuente: 4GeeksAcademy/ai-engineering-syllabus`), que es un hecho, no contenido educativo.
- **Estructura**: `header` con nombre + `nav` estructural; `main` con el estado vacío; `footer` con la fuente.
- **Navegación estructural**: items representativos de funcionalidad de producto permitida (`Inicio`, `Catálogo`, `Buscar`, `Tutor`, `Progreso`) renderizados como texto/`aria-disabled`, **sin** crear rutas ni pantallas falsas. Se habilitarán en sus hitos (M2, M5, M6, M3).
- **Estado vacío** (`empty-source-state.tsx`):
  - Título: **"Contenido todavía no sincronizado"**.
  - Cuerpo: "La plataforma mostrará el syllabus real del repositorio cuando se implemente la ingesta (Hito 1). Hasta entonces no se muestra contenido educativo."
  - Sin listas de proyectos, sin placeholders tipo "Proyecto 1", sin lorem ipsum educativo, sin datos ficticios.
- **Metadata** (`layout.tsx`): title/description del shell; idioma `es` (los documentos del proyecto están en español); sin framework i18n en M0.

### 5.6 `platform/README.md` (AC-0.9)

Esquema mínimo:

1. Qué es (`platform/` = app de plataforma; el contenido fuente vive fuera).
2. Prerequisitos: Node >= 20.9 (probado con 26.10), pnpm fijado (`packageManager`), instalación de pnpm si falta.
3. Comandos: `install`, `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, formato (`npx prettier --write .` desde `platform/`).
4. Variables de entorno: remitir a `.env.example`; M0 no necesita ninguna.
5. Estructura de carpetas.
6. Alcance de M0 y exclusiones (sin ingesta, sin contenido real, sin DB/IA).
7. Enlaces a `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `ORCA.md`, `MILESTONES.md` y `docs/milestones/M0_FOUNDATION.md`.

El README raíz no se modifica.

### 5.7 Árbol de archivos de la app (a crear en la implementación)

```text
platform/
├── .env.example
├── .gitignore
├── README.md
├── components.json                 # generado por shadcn
├── eslint.config.mjs
├── next.config.ts
├── package.json                    # private, packageManager, scripts
├── pnpm-lock.yaml                  # lockfile propio de la app
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── vitest.setup.ts
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── app-shell.tsx
    │   ├── empty-source-state.tsx
    │   └── ui/                     # button.tsx, card.tsx (vendorizados)
    ├── lib/
    │   └── utils.ts                # cn()
    └── test/
        ├── app-shell.test.tsx
        ├── env-example.test.ts
        └── no-hardcoded-catalog.test.ts
```

---

## 6. Verificación de AC-0.10 (sin catálogo educativo hardcodeado)

### 6.1 Test automatizado `no-hardcoded-catalog.test.ts`

**Objetivo**: fallar si en el código de la app aparece cualquier nombre de entidad del syllabus. El test **no hardcodea nombres**: los deriva del repo en tiempo de ejecución, igual que exige `REPO_MAP.md:84-86` para el código de la plataforma.

**Denylist dinámica** (raíz del repo resuelta como `platform/src/test/../../..`):

1. Nombres de directorio en `content/projects/` (entidades de proyecto).
2. Nombres de directorio en `content/lessons/` (entidades de lección).
3. Nombres de directorio en `content/contexts/` (buckets y contextos standalone).
4. Basenames de archivos `CONTEXT-*.md` bajo `content/contexts/` normalizados a su token (`CONTEXT-` fuera, sufijo `.es`/`.en` fuera) para cubrir nombres de empresas/contextos concretos.
5. Filtro: descartar tokens de longitud < 5 y buckets puramente numéricos, para evitar falsos positivos.

**Archivos escaneados**: todo `platform/` con extensiones `.ts .tsx .js .jsx .mjs .cjs .json .css .md`, excluyendo `node_modules/`, `.next/`, `coverage/` y `pnpm-lock.yaml` (el lockfile puede contener nombres de paquetes ajenos y no es código de app).

**Matching**: comparación *case-insensitive* del token normalizado con límites de palabra basados en `[a-z0-9-]` (no substring), de modo que el nombre completo de una entidad se detecte pero palabras genéricas dentro de otro identificador no generen ruido.

**Fail-closed**: si `content/` no existe (p. ej. la app se extrajera a un repo propio), el test **falla con un mensaje explícito** ("este guard requiere el fork completo con content/") en lugar de pasar vacío. Así AC-0.10 queda garantizado mientras M0 viva en este repo.

**Mensaje de fallo**: listar `archivo:línea` y recordar que los nombres del syllabus solo pueden llegar a la UI vía ingesta (M1+), nunca como literales.

### 6.2 Comprobación manual complementaria

```sh
cd platform
rg -n -i --glob '!node_modules' --glob '!.next' --glob '!pnpm-lock.yaml' \
  'CONTEXT-|content/projects|content/lessons|content/contexts' src
```

Resultado esperado en M0: solo referencias permitidas (p. ej. el propio test o el README de la app hablando de la fuente), y **cero nombres de entidades**.

### 6.3 Limitaciones asumidas

- El guard protege contra literales; no protege contra nombres ofuscados (concatenación, base64). Es una salvaguarda de desarrollo razonable, no una sandbox.
- Al ser un test de repo, no se ejecuta en un deploy de solo `platform/`; el gate se corre en CI/local desde la raíz del fork (candidata a backlog: workflow de CI explícito).

---

## 7. Conflictos y ambigüedades detectadas

| # | Conflicto / ambigüedad | Resolución propuesta para M0 |
|---|------------------------|------------------------------|
| 1 | `ARCHITECTURE.md:47-56` sugiere PostgreSQL/Supabase; `M0_FOUNDATION.md` no pide persistencia. | No incluir DB, ORM ni variables activas en M0. Diferir a M1 (snapshots fuente) o M3 (estado de usuario). El stack sugerido queda documentado como dirección, no como requisito de fundación. |
| 2 | `ORCA.md` prohíbe fixtures inventados y exige que los de prueba vengan del repo real con source path; M0 no tiene ingesta para obtenerlos. | M0 no usa fixtures educativos: los tests del shell usan textos de UI y el guard lee el corpus directamente del repo. |
| 3 | La documentación no dice dónde vive el código de la app. | Decisión de la sección 4: `platform/` independiente. Conviene registrarla como ADR nuevo (p. ej. ADR-006) al cerrar el hito, según `ORCA.md:88-96` — **no** se edita `DECISIONS.md` en esta tarea read-only. |
| 4 | ¿Idioma de la UI? Docs en español, corpus bilingüe. | UI en español para M0 (sin i18n); la preferencia de idioma del contenido es problema del renderer (M2/M4). |
| 5 | Prettier raíz sin config escanea el código de la app; Tailwind suele pedir ordenar clases (`prettier-plugin-tailwindcss`). | M0: código formateado con Prettier defaults para no tocar la raíz. Añadir el plugin (y su config) queda como candidata a backlog. |
| 6 | `README.md` raíz ya está divergido de upstream y el sync de Hito 9 conflictuará. | Fuera de M0. No empeorar: la app no toca archivos raíz. Registrar la estrategia de sync/conflictos para M9. |
| 7 | El script `test` raíz termina en 1; un CI ingenuo que lo ejecute falla. | Los tests de la app se corren con `pnpm --dir platform test`. No editar el raíz en M0; si se quiere un test raíz coherente, tratarlo como decisión de fork (candidata a backlog). |
| 8 | `docs/syllabus/*.csv` no está bajo `content/` ni figura en `REPO_MAP.md`. | Tratarlo como material de planificación, no como corpus de la app; fuera de M0 y a revisar en M1. |
| 9 | El guard AC-0.10 depende de `content/` en el mismo checkout. | Asumir y documentar el supuesto "la app vive dentro del fork"; fail-closed si falta `content/`. Revisar si algún día se extrae el repo. |

**Candidatas a `BACKLOG.md`** (no se edita `BACKLOG.md` en esta tarea):

- Workflow de CI (GitHub Actions) que ejecute lint + typecheck + test + build de `platform/`.
- `prettier-plugin-tailwindcss` y configuración de formato para la app.
- Estrategia de fork/upstream: remoto `upstream`, política de merge y `FORK_PATCHES.md` para los archivos raíz ya divergidos (README, docs de plataforma).
- Migración futura de `platform/` a workspace (`apps/web` + `packages/*`) si aparece un segundo paquete.
- Nombre definitivo del producto (el provisional es solo de M0).
- `.prettierignore` raíz para artefactos generados (si molesta al gate).

---

## 8. Plan de implementación paso a paso (mínimo)

Precondición: registrar el baseline (`git status --porcelain`) y no tocar los cambios preexistentes. Todos los comandos se ejecutan desde la raíz del repo salvo indicación.

### Paso 0 — Preparar pnpm y baseline

1. `npm install -g pnpm@12.8.1` (o usar `npx pnpm@12.8.1`).
2. Anotar baseline git. No ejecutar nunca `pnpm install` en la raíz.

### Paso 1 — Andamiaje Next.js en `platform/`

3. `mkdir platform`.
4. `npx create-next-app@latest platform --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm` (con `platform/` vacío; el CLI rechaza directorios con contenido).
5. En `platform/package.json`: `"private": true`, `"packageManager": "pnpm@12.8.1"`, scripts `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch` (`vitest`).

### Paso 2 — Verificar base (AC-0.1, AC-0.2, AC-0.4)

6. `pnpm --dir platform build` → 0.
7. `pnpm --dir platform lint` → 0.
8. `pnpm --dir platform typecheck` → 0.
9. `pnpm --dir platform dev` + `curl -fsS http://localhost:3000/` → HTML.

### Paso 3 — Tests (AC-0.6)

10. `pnpm --dir platform add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`.
11. Crear `vitest.config.ts` y `vitest.setup.ts`; `pnpm --dir platform test` debe ejecutar (aún sin tests) sin fallar por configuración.

### Paso 4 — shadcn/ui (AC-0.3)

12. `npx shadcn@latest init` dentro de `platform/`.
13. `npx shadcn@latest add button card`.

### Paso 5 — Shell neutro (AC-0.8)

14. Crear `src/components/app-shell.tsx` y `src/components/empty-source-state.tsx` según 5.5.
15. Reemplazar `src/app/page.tsx` y ajustar `src/app/layout.tsx` (metadata, `lang="es"`).
16. Eliminar los assets demo que genere el scaffolding si no se usan (iconos/`next.svg`, texto de bienvenida del template); no debe quedar contenido ficticio.

### Paso 6 — Guard AC-0.10 y tests

17. Crear `src/test/no-hardcoded-catalog.test.ts` (sección 6).
18. Crear `src/test/app-shell.test.tsx` (sección 5.3.2).
19. Crear `src/test/env-example.test.ts` (sección 5.3.3) junto con `.env.example` (5.4).
20. `pnpm --dir platform test` → todo verde.

### Paso 7 — Configuración de repo y documentación (AC-0.7, AC-0.9)

21. Crear `platform/.gitignore` (`.next/`, `node_modules/`, `coverage/`, `*.tsbuildinfo`, `.env*`, `!.env.example`).
22. Crear `platform/README.md` (esquema 5.6).
23. `git check-ignore -v platform/.env.example` → debe mostrar la negación `!.env.example`.

### Paso 8 — Gate final

24. `npx prettier --write platform` y `npx prettier --check platform` → 0 (mantiene verde el `format:check` raíz).
25. `pnpm --dir platform lint && pnpm --dir platform typecheck && pnpm --dir platform test && pnpm --dir platform build` → todo 0.
26. Verificar AC-0.10: `pnpm --dir platform test` contiene el guard en verde + `rg` de 6.2.
27. `git status --porcelain`: solo debe aparecer `platform/` y (si se commitea) el archivo del hito; ningún archivo raíz modificado.

### Paso 9 — Cierre de hito (fuera de esta tarea read-only)

28. Al implementar M0 de verdad, `ORCA.md:88-96` pide actualizar `STATUS.md`, el checklist de `M0_FOUNDATION.md` y, si procede, `DECISIONS.md` (ADR de ubicación `platform/` y stack). Eso corresponde a la tarea de implementación, no a esta auditoría.

### Archivos a crear / modificar (resumen)

**Crear** (todos dentro de `platform/`): `.env.example`, `.gitignore`, `README.md`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `components.json`, `pnpm-lock.yaml`, `src/app/{layout.tsx,page.tsx,globals.css}`, `src/components/{app-shell.tsx,empty-source-state.tsx}`, `src/components/ui/{button.tsx,card.tsx}`, `src/lib/utils.ts`, `src/test/{no-hardcoded-catalog.test.ts,app-shell.test.tsx,env-example.test.ts}`. `package.json` de `platform/` se crea con el scaffolding y luego se edita (scripts/private/packageManager).

**Modificar**: ninguno fuera de `platform/`.

**No tocar**: `package.json` raíz, `pnpm-lock.yaml` raíz, `.gitignore` raíz, `README.md` raíz, `content/`, `marketing/`, `assets/`, `.cursor/`, `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `REPO_MAP.md`, `PRODUCT.md`, `MILESTONES.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SPECS.md`, `ORCA.md`, `DECISIONS.md`, `STATUS.md`, `BACKLOG.md`, `AI_TUTOR.md`, `docs/milestones/M0_FOUNDATION.md`.

**Rollback**: si `create-next-app` intentara escribir fuera de `platform/` o propusiera un workspace raíz, abortar y rehacer: M0 no requiere ningún cambio en archivos upstream.

### Definition of Done (M0)

- [ ] AC-0.1 build + dev OK (`platform/`, TypeScript strict)
- [ ] AC-0.2 Tailwind compilado en el CSS del build
- [ ] AC-0.3 `components.json` + componentes shadcn usados en el shell
- [ ] AC-0.4 `pnpm --dir platform lint` verde
- [ ] AC-0.5 `pnpm --dir platform typecheck` verde
- [ ] AC-0.6 `pnpm --dir platform test` verde (guard + shell + env)
- [ ] AC-0.7 `.env.example` versionado, sin variables activas
- [ ] AC-0.8 shell neutro con "Contenido todavía no sincronizado"
- [ ] AC-0.9 `platform/README.md` completo y ejecutable
- [ ] AC-0.10 guard de catálogo hardcodeado en verde y `rg` limpio
- [ ] Cero cambios en archivos raíz/upstream; `git status` acotado a `platform/`
