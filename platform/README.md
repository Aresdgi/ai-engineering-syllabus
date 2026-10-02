# platform — AI Engineering Study Platform (nombre provisional)

`platform/` es la aplicación web de la plataforma (Next.js + TypeScript). Es un
paquete pnpm **independiente**: no forma parte de un workspace y tiene su propio
`package.json` y `pnpm-lock.yaml`.

El contenido educativo **no vive aquí**. La única fuente pedagógica es
`4GeeksAcademy/ai-engineering-syllabus`, y su corpus (proyectos, contextos y
lecciones) permanece en la raíz del repositorio, fuera de `platform/`.

- **M0** dejó un shell neutro: la app no muestra ni contiene contenido
  educativo.
- **M1** añade la ingesta fiel del repositorio fuente (reader de GitHub,
  clasificación, PostgreSQL/Drizzle y CLI `ingest`) bajo `src/source/`, todavía
  **sin UI nueva**: la app sigue siendo el shell neutro de M0. Ver
  [Hito 1 — Ingestión fiel](#hito-1--ingestión-fiel).

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

| Acción                | Comando                                 | Script en `package.json`                                                              |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| Instalar dependencias | `pnpm --dir platform install`           | — (comando de pnpm)                                                                   |
| Desarrollo            | `pnpm --dir platform dev`               | `dev` → `next dev`                                                                    |
| Build de producción   | `pnpm --dir platform build`             | `build` → `next build`                                                                |
| Servir el build       | `pnpm --dir platform start`             | `start` → `next start`                                                                |
| Lint                  | `pnpm --dir platform lint`              | `lint` → `eslint .`                                                                   |
| Typecheck             | `pnpm --dir platform typecheck`         | `typecheck` → `next typegen && tsc --noEmit`                                          |
| Tests (una pasada)    | `pnpm --dir platform test`              | `test` → `vitest run`                                                                 |
| Tests en modo watch   | `pnpm --dir platform test:watch`        | `test:watch` → `vitest`                                                               |
| Ingesta del repo      | `pnpm --dir platform ingest [opciones]` | `ingest` → `tsx --env-file-if-exists=.env.local src/source/cli.ts`                    |
| Generar migraciones   | `pnpm --dir platform db:generate`       | `db:generate` → `drizzle-kit generate`                                                |
| Aplicar migraciones   | `pnpm --dir platform db:migrate`        | `db:migrate` → `tsx --env-file-if-exists=.env.local src/source/store/migrate.ts`      |
| Backfill de binarios  | `pnpm --dir platform blobs:backfill`    | `blobs:backfill` → `tsx --env-file-if-exists=.env.local src/source/blobs-backfill.ts` |
| Formato               | `cd platform && npx prettier --write .` | — (no hay script; Prettier 3.8.3)                                                     |

Para comprobar el formato sin escribir: `cd platform && npx prettier --check .`.
`platform/.prettierignore` excluye los artefactos generados y derivados
(`.next/`, `node_modules/`, `coverage/`, `pnpm-lock.yaml`, `next-env.d.ts`), de
modo que Prettier solo comprueba fuentes.

> **No ejecutes `pnpm install` en la raíz del repositorio.** El lockfile raíz
> pertenece a upstream y regenerarlo genera conflictos de sincronización. Todos
> los comandos de la app van con `--dir platform` o dentro de `platform/`.

## Variables de entorno

`platform/.env.example` documenta las variables previstas. El shell de M0 y
los tests funcionan sin crear un archivo `.env`; la ingesta de M1 necesita
`DATABASE_URL` (ver [Hito 1](#hito-1--ingestión-fiel)). Copia el ejemplo a
`platform/.env.local` (ignorado por git) y define allí los valores reales.

Los scripts `ingest` y `db:migrate` cargan `.env.local` automáticamente
(`tsx --env-file-if-exists=.env.local`), sin dependencias extra.

## Hito 1 — Ingestión fiel

La ingesta se ejecuta solo por CLI (sin UI en M1) y copia el contenido del
repositorio fuente sin resumir, reescribir ni sustituir nada: los fallos se
registran en `source_import_errors` y el snapshot termina en
`complete_with_errors` (o en `failed` si el fallo es global).

### Configuración

En `platform/.env.local`:

- `DATABASE_URL`: URI de Postgres de Supabase (Dashboard → Connect). Debe ser
  la **URI del Session pooler**: la conexión directa `db.<ref>.supabase.co` es
  solo IPv6, así que para CI y Vercel usa la del Session pooler. Es requerida
  para `db:migrate` e `ingest` (salvo con `--dry-run`).
- `GITHUB_REPO`: repo fuente en formato `owner/name` (opcional; por defecto
  `4GeeksAcademy/ai-engineering-syllabus`).
- `GITHUB_TOKEN`: token de GitHub de solo lectura (opcional; el repo fuente es
  público y la vía tarball + árbol cabe en el rate limit sin token). Nunca con
  prefijo `NEXT_PUBLIC_*`, nunca en logs ni mensajes de error.

### Migraciones

```sh
pnpm --dir platform db:migrate
```

Aplica las migraciones SQL versionadas de `platform/drizzle/` (generadas con
`pnpm --dir platform db:generate`) a `DATABASE_URL`. Hoy no hay
previsualización: aplica directamente (candidato a BACKLOG, H-2).

### Ingesta

```sh
pnpm --dir platform ingest [--repo <owner/name>] [--ref <branch>] [--commit <sha>] [--dry-run] [--json]
```

| Flag                  | Qué hace                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--repo <owner/name>` | Repositorio fuente; por defecto `4GeeksAcademy/ai-engineering-syllabus`.                                                                         |
| `--ref <branch>`      | Rama/ref a resolver; por defecto la default branch del repo.                                                                                     |
| `--commit <sha>`      | Commit exacto a importar; tiene prioridad sobre `--ref`.                                                                                         |
| `--dry-run`           | Ingesta completa contra un PGlite en memoria con las migraciones aplicadas: valida el flujo real sin escribir en la base ni conectar a Supabase. |
| `--json`              | Emite el resumen (conteos por root, índices, errores, duración) como JSON.                                                                       |
| `-h`, `--help`        | Muestra la ayuda y termina.                                                                                                                      |

Códigos de salida: `0` completo (o no-op), `1` completo con errores
registrados, `2` fallo global o error de arranque. La invocación correcta es
`pnpm --dir platform ingest --commit <sha>`: el `--` de pnpm se reenvía al
script y `ingest -- --commit ...` falla con «opción desconocida».

Idempotencia e inmutabilidad:

- Reimportar un commit ya `complete`/`complete_with_errors` es un no-op que
  devuelve el snapshot existente (`UNIQUE(repository_id, commit_sha)`).
- Un commit nuevo crea otro snapshot y no modifica ni borra el anterior; no
  hay `DELETE` ni cascadas (FK `ON DELETE RESTRICT`).

Errores y fidelidad:

- Cada fallo de lectura, hash o decodificación se registra en
  `source_import_errors` con su path y tipo, y la importación continúa con el
  resto. Nunca se rellena, resume ni sustituye contenido educativo.
- Los archivos de texto se guardan íntegros en `raw_content` (UTF-8 estricto);
  los binarios solo como `binary_reference` pinneada al commit, sin base64.

### Fixtures

Los tests que necesitan contenido real usan
`platform/fixtures/source/<commit>/<path original>` con `manifest.json` (copia
verbatim; ADR-009). El guard AC-0.10 verifica que cada fixture existe, está
declarado y coincide byte a byte con su `blob_sha`. Ver
[Fixtures fuente](#fixtures-fuente-hito-1) para el detalle.

## Hito 2 — Navegador del syllabus real

La UI de H2 muestra exclusivamente el snapshot ya importado (nunca contenido
inventado) a través de la capa de lectura server-only `src/course/` y la capa
de presentación neutra `src/components/`.

- **Capa `course/`** (`src/course/`): consulta el **snapshot activo**
  (`source_snapshots` terminado más reciente) en solo lectura con el esquema
  Drizzle. Orden, títulos, descripciones y variantes de idioma se derivan en
  lectura desde `raw_content` y los paths; no hay escrituras ni reingesta. Sin
  snapshot o sin `DATABASE_URL` devuelve `null`/`[]` y la UI muestra el estado
  vacío neutro. El pool `pg` es perezoso, así que `next build` no necesita base
  de datos. Ver ADR-013.
- **Rutas H2**: `/projects`, `/projects/[slug]`, `/contexts`,
  `/contexts/[slug]`, `/lessons` y `/lessons/[slug]`. `?lang=es|en` selecciona
  una variante real del documento y `?doc=<path>` selecciona un documento
  dentro de un contexto. En Next 16 `params`/`searchParams` son `Promise` y
  cada página llama `await connection()` antes de la primera consulta. El
  esquema de URLs vive en `src/course/routes.ts`.
- **Render Markdown** (`src/components/source-markdown.tsx` +
  `src/lib/markdown/`): `react-markdown` con `remark-gfm` y
  `remark-frontmatter`, y `rehype-raw` + `rehype-sanitize` con allowlist
  (ADR-014). El frontmatter YAML no se muestra; las URLs pasan por un resolvedor
  (vista interna, GitHub blob/tree pinneado al commit o enlace roto visible;
  ADR-015) y los assets se sirven desde `source_blobs` con `GET
/source-files/<path>` (ADR-018, que reemplaza el servido de ADR-016). Orden y
  títulos son literales de la fuente (ADR-017).

### Binarios e independencia del origen (ADR-018)

Los bytes de los binarios viven en la tabla `source_blobs`, direccionada por el
SHA-1 git del blob (dedupe entre snapshots, sin FK). La ingesta los guarda
verificados junto a `source_files`, y la app los sirve desde `GET
/source-files/<path>` sin depender de `raw.githubusercontent.com`; los enlaces
"Ver en GitHub" y a directorios usan el espejo `SOURCE_MIRROR_REPOSITORY` (si no
está definido, el repo del snapshot). La procedencia textual (repo de origen,
commit, path y blob) no se reescribe nunca.

Para snapshots importados antes de ADR-018 (que solo tienen `binary_reference`):

```sh
pnpm --dir platform blobs:backfill --dry-run --from-dir ..   # lee y verifica sin escribir
pnpm --dir platform blobs:backfill --from-dir ..             # inserta los bytes
```

`--from-dir <ruta>` lee de un checkout local (p. ej. `..`, la raíz del repo);
sin él, descarga el tarball del commit con el reader de GitHub (`--repo` /
`GITHUB_REPO`, o el repo del snapshot). El comando es idempotente (los blobs ya
presentes se omiten), verifica el hash git antes de insertar y nunca sustituye
bytes existentes.

## Estructura de carpetas

```text
platform/
├── src/
│   ├── app/                    # rutas, layout y estilos globales (App Router)
│   ├── components/             # componentes de la aplicación
│   │   ├── source-markdown.*   # render fiel del Markdown (Hito 2)
│   │   ├── app-shell.test.tsx  # test del shell (jsdom)
│   │   └── ui/                 # componentes shadcn/ui vendorizados
│   ├── course/                 # lectura server-only del snapshot (Hito 2)
│   ├── lib/                    # utilidades compartidas
│   │   └── markdown/           # tipos y allowlist de saneado del render
│   ├── source/                 # ingesta SOURCE (Hito 1; sin UI)
│   │   ├── classify/           # buckets, idioma, media type e índices
│   │   ├── github/             # reader (tarball + árbol + raw) y errores
│   │   ├── ingest/             # orquestador, opciones y resumen del CLI
│   │   ├── fixtures/           # hash git y manifiesto de fixtures (ADR-009)
│   │   ├── store/              # esquema Drizzle, PostgresSourceStore, migrador
│   │   ├── validate/           # verificación de blob/path/árbol
│   │   ├── cli.ts              # entrada de `pnpm ingest`
│   │   ├── fixture-reader.ts   # reader de fixtures para tests
│   │   └── types.ts            # contratos del dominio SOURCE
│   └── test/                   # guard de catálogo e higiene de entorno
├── drizzle/                    # migraciones SQL versionadas (drizzle-kit)
├── fixtures/                   # copias verbatim del repo fuente (ADR-009)
├── .prettierignore             # artefactos generados y derivados fuera del formato
├── AGENTS.md                   # generado/regenerado por next dev (no editar a mano)
├── CLAUDE.md                   # importa @AGENTS.md (generado/regenerado por next dev)
├── components.json
├── drizzle.config.ts
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
- `src/source/` es la capa de ingesta del Hito 1 (reader, clasificación,
  store, validación y CLI). No importa `course/`, `user/` ni `ai/`, y la app
  no la importa: no hay UI de ingesta. `src/course/` es la capa de lectura del
  Hito 2 (solo lectura del snapshot activo, sin escrituras) y
  `src/lib/markdown/` contiene los tipos y la allowlist de saneado del render.
- `drizzle/` contiene el SQL versionado que aplica `db:migrate` y que los
  tests aplican sobre PGlite; `fixtures/` guarda las copias verbatim del repo
  fuente declaradas en `manifest.json` (ADR-009).
- `pnpm-workspace.yaml` no declara miembros de workspace (no tiene la clave
  `packages:`): solo fija la política de build scripts de pnpm 12
  (`allowBuilds`). `platform/` sigue siendo un paquete pnpm independiente.
- `AGENTS.md` y `CLAUDE.md` los escribe/regenera `next dev` (reglas de agente
  para Next 16). Se versionan tal cual: no se editan a mano.
- `public/` no existe hasta que haya assets que versionar: un directorio vacío
  no sobrevive a un clon y M0 no sirve assets.

## Alcance

Incluido en M0:

- App Next.js (App Router) con TypeScript en modo `strict`.
- Tailwind v4 y componentes shadcn/ui vendorizados.
- ESLint (flat config), `tsc --noEmit` y Vitest + Testing Library.
- Shell neutro con un estado explícito de "contenido no sincronizado".
- Guard automatizado contra catálogo educativo hardcodeado (AC-0.10).

Incluido en M1 (sin UI nueva):

- Ingesta fiel del repositorio fuente vía CLI: reader de GitHub (tarball +
  árbol), clasificación de buckets/idioma/media type, snapshots e índices
  mínimos.
- PostgreSQL (Supabase) con Drizzle ORM, migraciones versionadas en
  `platform/drizzle/` y tests con PGlite.
- Fixtures verbatim del repo real (ADR-009) y guard AC-0.10 reforzado.
- La app sigue mostrando solo el shell neutro de M0.

Incluido en M2 (navegador del syllabus real):

- Capa de lectura `src/course/` sobre el snapshot importado, con orden,
  títulos y variantes de idioma derivados en lectura (ADR-013, ADR-017).
- Vistas de proyectos, contextos y lecciones con cabecera de procedencia y
  selector de idioma cuando existe.
- Render Markdown fiel server-side con saneado por allowlist y política única
  de enlaces (ADR-014, ADR-015) y assets servidos desde `source_blobs` con
  `GET /source-files/<path>` (ADR-018, que reemplaza el servido de ADR-016).

Excluido hasta hitos posteriores (H3-H9): autenticación y progreso, relaciones
y visores de assets, búsqueda, tutor IA/RAG, repositorios personales,
evaluación y sincronización upstream. No se crea contenido educativo ni datos
demo.

## Guard AC-0.10

Los tests incluyen un guard (`src/test/`) que falla si el código de la app
contiene nombres de proyectos, lecciones o contextos del syllabus. La denylist
se construye en tiempo de ejecución a partir de `content/`, por lo que el guard
**requiere el fork completo con `content/`**: si esa carpeta no existe, falla de
forma explícita (fail-closed) en lugar de pasar en vacío. Los nombres del
syllabus solo pueden llegar a la UI mediante la ingesta (Hito 1), nunca como
literales en el código. Desde M1 el guard escanea también `.yaml`, `.yml` y
`.sql`, y valida el manifiesto y la integridad de `platform/fixtures/source/`
antes de excluir cualquier fixture del escaneo.

## Fixtures fuente (Hito 1)

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
- [Hito 1 — Ingestión fiel](../docs/milestones/M1_INGESTION.md) — alcance y AC de M1.
- [Hito 2 — Navegador del syllabus real](../docs/milestones/M2_REAL_SYLLABUS_UI.md) — alcance y AC de M2.
- [M1 — Auditoría y plan](../docs/milestones/M1_AUDIT_PLAN.md) — auditoría, plan y desviaciones de M1.
- [M2 — Auditoría y plan](../docs/milestones/M2_AUDIT_PLAN.md) — decisiones de arquitectura y plan de M2.
- [DECISIONS.md](../DECISIONS.md) — ADR-006 (app en `platform/`), ADR-009 (fixtures), ADR-010..012 (persistencia e idioma), ADR-013..017 (Hito 2).
