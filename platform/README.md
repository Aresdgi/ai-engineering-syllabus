# platform — AI Engineering Study Platform (nombre provisional)

`platform/` es la aplicación web de la plataforma (Next.js + TypeScript). Es un
paquete pnpm **independiente**: no forma parte de un workspace y tiene su propio
`package.json` y `pnpm-lock.yaml`.

El contenido educativo **no vive aquí**. La única fuente pedagógica es
`4GeeksAcademy/ai-engineering-syllabus`, y su corpus (proyectos, contextos y
lecciones) permanece en la raíz del repositorio, fuera de `platform/`. En M0 la
app es solo un shell neutro: no muestra ni contiene contenido educativo.

## Prerequisitos

- **Node.js >= 20.9** (probado con `v26.10.0`).
- **pnpm 12.8.1**, la versión fijada en `platform/package.json`
  (`"packageManager": "pnpm@12.8.1"`). Si no está instalado globalmente, tienes
  dos opciones:
  - Instalarlo: `npm install -g pnpm@12.8.1`.
  - Usarlo sin instalar nada: `npx --yes pnpm@12.8.1 <comando>`.

En los comandos de esta guía, sustituye `pnpm` por `npx --yes pnpm@12.8.1` si
elegiste la segunda opción.

## Comandos

Todos los comandos se ejecutan desde la raíz del repositorio con
`pnpm --dir platform <script>`, o desde dentro de `platform/`.

| Acción                | Comando                                 | Script en `package.json`                     |
| --------------------- | --------------------------------------- | -------------------------------------------- |
| Instalar dependencias | `pnpm --dir platform install`           | — (comando de pnpm)                          |
| Desarrollo            | `pnpm --dir platform dev`               | `dev` → `next dev`                           |
| Build de producción   | `pnpm --dir platform build`             | `build` → `next build`                       |
| Servir el build       | `pnpm --dir platform start`             | `start` → `next start`                       |
| Lint                  | `pnpm --dir platform lint`              | `lint` → `eslint .`                          |
| Typecheck             | `pnpm --dir platform typecheck`         | `typecheck` → `next typegen && tsc --noEmit` |
| Tests (una pasada)    | `pnpm --dir platform test`              | `test` → `vitest run`                        |
| Tests en modo watch   | `pnpm --dir platform test:watch`        | `test:watch` → `vitest`                      |
| Formato               | `cd platform && npx prettier --write .` | — (no hay script; Prettier 3.8.3)            |

Para comprobar el formato sin escribir: `cd platform && npx prettier --check .`.
`platform/.prettierignore` excluye los artefactos generados y derivados
(`.next/`, `node_modules/`, `coverage/`, `pnpm-lock.yaml`, `next-env.d.ts`), de
modo que Prettier solo comprueba fuentes.

> **No ejecutes `pnpm install` en la raíz del repositorio.** El lockfile raíz
> pertenece a upstream y regenerarlo genera conflictos de sincronización. Todos
> los comandos de la app van con `--dir platform` o dentro de `platform/`.

## Variables de entorno

`platform/.env.example` documenta las variables previstas. **M0 no necesita
ninguna**: el shell y los tests funcionan sin crear un archivo `.env`. Copia el
ejemplo a `.env.local` solo cuando un hito posterior lo requiera.

## Estructura de carpetas

```text
platform/
├── src/
│   ├── app/                    # rutas, layout y estilos globales (App Router)
│   ├── components/             # componentes de la aplicación
│   │   ├── app-shell.test.tsx  # test del shell (jsdom)
│   │   └── ui/                 # componentes shadcn/ui vendorizados
│   ├── lib/                    # utilidades compartidas
│   └── test/                   # guard de catálogo e higiene de entorno
├── .prettierignore             # artefactos generados y derivados fuera del formato
├── AGENTS.md                   # generado/regenerado por next dev (no editar a mano)
├── CLAUDE.md                   # importa @AGENTS.md (generado/regenerado por next dev)
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-workspace.yaml         # política de builds de pnpm 12 (sin miembros de workspace)
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.mts
└── vitest.setup.ts
```

Notas de la estructura:

- El test del shell vive junto al componente
  (`src/components/app-shell.test.tsx`); `src/test/` contiene el guard de
  catálogo y el test de higiene de `.env.example`.
- `pnpm-workspace.yaml` no declara miembros de workspace (no tiene la clave
  `packages:`): solo fija la política de build scripts de pnpm 12
  (`allowBuilds`). `platform/` sigue siendo un paquete pnpm independiente.
- `AGENTS.md` y `CLAUDE.md` los escribe/regenera `next dev` (reglas de agente
  para Next 16). Se versionan tal cual: no se editan a mano.
- `public/` no existe hasta que haya assets que versionar: un directorio vacío
  no sobrevive a un clon y M0 no sirve assets.

## Alcance de M0

Incluido:

- App Next.js (App Router) con TypeScript en modo `strict`.
- Tailwind v4 y componentes shadcn/ui vendorizados.
- ESLint (flat config), `tsc --noEmit` y Vitest + Testing Library.
- Shell neutro con un estado explícito de "contenido no sincronizado".
- Guard automatizado contra catálogo educativo hardcodeado (AC-0.10).

Excluido en M0 (hitos posteriores): ingesta del repositorio, catálogo real,
base de datos u ORM, autenticación, progreso, búsqueda, tutor IA/RAG,
repositorios personales, evaluación y sincronización upstream. No se crea
contenido educativo ni datos demo.

## Guard AC-0.10

Los tests incluyen un guard (`src/test/`) que falla si el código de la app
contiene nombres de proyectos, lecciones o contextos del syllabus. La denylist
se construye en tiempo de ejecución a partir de `content/`, por lo que el guard
**requiere el fork completo con `content/`**: si esa carpeta no existe, falla de
forma explícita (fail-closed) en lugar de pasar en vacío. Los nombres del
syllabus solo pueden llegar a la UI mediante la ingesta (Hito 1), nunca como
literales en el código.

## Fixtures fuente (a partir del Hito 1)

Los tests que necesiten contenido real del syllabus usan fixtures copiados
verbatim del repositorio fuente. La copia vive en `fixtures/source/`, ordenada
por commit y conservando el path original:

```text
platform/fixtures/source/
├── manifest.json
└── <commit_sha>/<path original>
```

`manifest.json` es obligatorio y declara cada fixture:

```json
{
  "repository": "4GeeksAcademy/ai-engineering-syllabus",
  "fixtures": [
    {
      "commit": "<commit_sha>",
      "path": "<path original>",
      "blob_sha": "<git blob sha1>"
    }
  ]
}
```

`blob_sha` es el SHA-1 git del contenido (`sha1("blob <bytes>\0" + contenido)`),
el mismo que imprime `git hash-object` sobre el archivo original:

```sh
git hash-object content/<path original>
```

El guard de AC-0.10 valida este directorio antes de excluir nada del escaneo de
nombres: un archivo no declarado en el manifiesto, un fixture cuyo blob no
coincida con `blob_sha` (alterado), una entrada del manifiesto sin archivo o un
manifiesto con forma inválida (campos obligatorios, duplicados, paths absolutos
o con `..`) hacen fallar los tests. Solo los fixtures verificados y el propio
`manifest.json` quedan excluidos; el resto de `platform/` se sigue escaneando
igual. Si `fixtures/source/` no existe, no hay fixtures que verificar y no se
excluye nada: el guard escanea `platform/` como siempre. Si el directorio existe
con archivos pero sin `manifest.json`, cada archivo se considera no declarado y
los tests fallan (un directorio sin archivos no produce violaciones).

## Documentación relacionada

- [SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md) — fuente única del contenido.
- [CONTENT_CONTRACT.md](../CONTENT_CONTRACT.md) — contrato de contenido.
- [ORCA.md](../ORCA.md) — reglas de trabajo del proyecto.
- [MILESTONES.md](../MILESTONES.md) — hitos de desarrollo de la plataforma.
- [Hito 0 — Fundación](../docs/milestones/M0_FOUNDATION.md) — alcance y AC de M0.
