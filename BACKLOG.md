# Backlog

Ideas de producto que NO forman parte del contenido educativo:

- PWA
- modo offline
- estadísticas de estudio
- calendario personal
- recordatorios
- exportar notas
- temas visuales
- vista gráfica de relaciones
- comparación entre snapshots
- traducción bajo demanda claramente marcada
- tutor por voz

Toda nueva función debe respetar `SOURCE_OF_TRUTH.md`.

## Infraestructura de plataforma (candidatas detectadas en M0)

- `prettier-plugin-tailwindcss` para ordenar las clases de Tailwind de la app.
- Estrategia fork/upstream: remoto `upstream`, política de merge y registro de
  los archivos raíz divergidos.
- Migración de `platform/` a workspace (`apps/web` + `packages/*`) si aparece un
  segundo paquete.
- Nombre definitivo del producto.
- Generar subtokens por segmento de los slugs del catálogo en el guard AC-0.10
  (evaluar antes los posibles falsos positivos).
- Sustituir la suite `radix-ui` por primitivos sueltos (`@radix-ui/react-slot`)
  si se quiere minimizar dependencias.
- Icono/favicon neutro propio para la app (M0 no sirve favicon).
- Verificar `sharp` (build script denegado en `pnpm-workspace.yaml`) cuando
  lleguen assets en el Hito 4.
- Guard AC-0.10: detectar nombres en CamelCase compacto sin separadores (sin
  recurrir a subtokens por segmento).
- Guard AC-0.10: ampliar las extensiones escaneadas (`.txt`, `.env*`) y acotar la
  autoexclusión del propio guard.
- Retirar `"iconLibrary": "lucide"` de `platform/components.json` mientras no se
  usen iconos (o reinstalar `lucide-react` cuando se necesiten).
- Script de alta de fixtures que copie el archivo del upstream y calcule su
  `blob_sha`, y contrastar `commit`/`path`/`blob_sha` de cada fixture contra el
  upstream al darlo de alta (Hito 1).
- Añadir `prettier` como devDependency de `platform/` con scripts `format` y
  `format:check`, para no descargarlo ad hoc en CI.
- Fijar las GitHub Actions por SHA en lugar de por tag mayor (hardening de
  supply chain; valorar Dependabot).
- Decidir si el CI debe cubrir el formato de la raíz: hoy hay 235 archivos
  upstream preexistentes sin formatear que no deben tocarse.

## Ingesta (candidatas detectadas en M1)

- Deduplicar errores al reintentar snapshots `failed` (F-05): hoy dos intentos
  fallidos del mismo commit insertan dos veces las mismas filas en
  `source_import_errors`; usar una clave única con `ON CONFLICT DO NOTHING` o
  borrar los errores previos del propio snapshot.
- Definir la carrera de dos ingestas concurrentes del mismo commit: el
  `UNIQUE(repository_id, commit_sha)` evita snapshots duplicados, pero no qué
  resumen (no-op o creación) obtiene cada proceso.
- Preferencia recursiva de documento de contexto (F-07, H2): 4 de 22 contextos
  tienen su `CONTEXT-*.md` en subdirectorios y hoy `preferred_readme_path` y
  `language` quedan `null` a nivel de contexto.
- Indexar subproyectos anidados (p. ej. `4-devs`) en H2: `source_projects`
  indexa solo carpetas de primer nivel; `4-devs` contiene subdirectorios con
  `learn.json`.
- Previsualización/`--dry-run` de `db:migrate` (H-2): listar el SQL pendiente
  antes de aplicar contra una base real.
- Smoke E2E real contra GitHub en CI programado (H-3) y test de reconciliación
  de conteos con commit pinneado: hoy el smoke real es opt-in y queda skipped.
- Resolver repo/ref con `git ls-remote` y caché ETag: reduce llamadas API y
  rate limit en sincronizaciones repetidas.
- Symlinks como referencia en el contrato: el upstream auditado no tiene, pero
  debe decidirse su representación si aparecen.
- Políticas RLS reales para H3: todas las tablas tienen RLS habilitado y sin
  políticas; al incorporar autenticación hay que definirlas.
- Script de alta de fixtures con contraste upstream: automatiza el protocolo
  manual de ADR-009 (`commit`/`path`/`blob_sha` contra el repo fuente).
- Usar la URI del Session pooler en CI/Vercel (sin IPv6): la conexión directa
  `db.<ref>.supabase.co` es solo IPv6.
- Test propio de redacción para `platform/src/source/store/migrate.ts` (que un
  futuro `console.error(error)` crudo haga fallar la suite) (N-01 de M1-RQ).
- Máscara de URIs en `platform/src/lib/redact.ts` para contraseñas con `/` sin
  percent-encode (N-02 de M1-RQ).
