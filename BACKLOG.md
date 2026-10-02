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
