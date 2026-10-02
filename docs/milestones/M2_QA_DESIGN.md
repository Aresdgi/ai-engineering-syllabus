# M2 — QA independiente de diseño y accesibilidad (M2-QA-D)

- Hito: **Hito 2 — Navegador del syllabus real** (rama `m2-syllabus-ui`).
- Tarea: `[M2-QA-D]` — QA **READ-ONLY** de diseño y accesibilidad. No se ha modificado ningún archivo del repo salvo este informe; no se ha arreglado nada, solo se documentan hallazgos con corrección sugerida.
- Fecha: 2026-10-02.
- Skills leídas completas antes de auditar: `/Users/aresdominguezgil/.claude/skills/impeccable/SKILL.md` (85 líneas, modo **Read**: "Docs, articles, guides… structure for comprehension", líneas 31-38), `/Users/aresdominguezgil/.claude/skills/emil-design-eng/SKILL.md` (674 líneas; Animation Decision Framework, Review Checklist, Accessibility, Performance Rules) y `/Users/aresdominguezgil/.claude/skills/design-taste-frontend/SKILL.md` (1.206 líneas; §0-§9). Diales aplicables según `M2_AUDIT_PLAN.md:288`: "minimalist/clean/editorial" → VARIANCE 5-6, MOTION 3-4, DENSITY 2-3. **Design Read:** navegador de syllabus interno, modo Read, lenguaje editorial/minimalista, sistema shadcn + Tailwind 4 ya existente.
- Docs leídos: `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `ORCA.md`, `docs/milestones/M2_REAL_SYLLABUS_UI.md`, `docs/milestones/M2_AUDIT_PLAN.md` (incl. §4 y "Decisiones del usuario"), ADR-013..017 de `DECISIONS.md:169-279`, `BACKLOG.md` ("temas visuales"), `platform/README.md` §§Hito 2, y formato de referencia `docs/milestones/M1_QA_FIDELITY.md`. La frontera de contenido se respeta en todas las correcciones propuestas: ningún arreglo añade texto educativo; los copys sugeridos son de interfaz o derivaciones literales de paths (SOURCE_OF_TRUTH.md:64-78, ADR-017).
- Código auditado: `platform/src/app/**`, `platform/src/components/**`, `platform/src/app/globals.css`, con foco en `document-view`, `unit-list`, `provenance-header`, `language-selector`, `app-shell`, `document-nav`, `source-markdown` y los catálogos `catalog/**`.
- Evidencia real: HTML servido por el dev server del coordinador en `http://localhost:3100` (`curl -s`) en `/`, `/projects`, `/projects/ai-eng-milestone-choose-company[?lang=en]`, `/contexts`, `/contexts/01-web-fundamentals`, `/contexts/06-telemetry-data-pipelines[?doc=…]`, `/lessons`, `/lessons/4geeks-student-extension[?lang=en]`, 404; CSS compilado servido por Next; cálculos propios de contraste WCAG a partir de los tokens oklch de `globals.css` (script efímero fuera del repo, ver §A.3). No se ejecutó `install`, `build`, `db:migrate` ni `ingest`; el único comando de app fue el test del guard. No se escribió en la base ni se imprimió `DATABASE_URL`. El dev server no se paró ni se reinició.
- Guard AC-0.10: `npx --yes pnpm@12.8.1 --dir platform test src/test/no-hardcoded-catalog.test.ts` → **14/14 verdes** (1 archivo, 290 ms). Sin contenido educativo hardcodeado y sin lecturas a la base durante la QA.

Convención de severidad (pedida por la tarea):

- **BLOCKER** — debe corregirse antes de cerrar el hito.
- **MAJOR** — fallo claro de diseño/accesibilidad en la superficie principal; corregir dentro de H2.
- **MINOR** — incoherencia o deuda visible; corregir o registrar antes del cierre.
- **NIT** — mejora opcional/BACKLOG.

## Resumen ejecutivo

| Severidad | Nº  | IDs                                            |
| --------- | --- | ---------------------------------------------- |
| BLOCKER   | 0   | —                                              |
| MAJOR     | 6   | D-01, D-02, D-03, D-04, D-05, D-08             |
| MINOR     | 8   | D-06, D-07, D-09, D-10, D-11, D-12, D-13, D-15 |
| NIT       | 3   | D-14, D-16, D-17                               |
| **Total** | 17  |                                                |

- **AC en rojo: ninguno.** Las 13 vistas existen, renderizan el snapshot real y no hay texto educativo inventado. Dos AC quedan **en riesgo** por calidad de UI, no por incumplimiento funcional: **AC-2.4** (las filas de `/contexts` no se distinguen entre sí, D-02) y **AC-2.12** (el selector de idioma funciona, pero `lang` y el título de cabecera no acompañan al idioma mostrado, D-05/D-06).
- Veredicto global: **aprobable con correcciones**. La base es sobria y sin "slop" (sin gradientes, glows, eyebrows decorativos, em-dashes de interfaz ni tarjetas anidadas), con una superficie de lectura bien medida y motion disciplinada. Los fallos se concentran en jerarquía tipográfica de listas, duplicación de título/H1, desambiguación del catálogo de contextos, prominencia de la procedencia en móvil y dos detalles WCAG (idioma del documento e identificación de enlaces/rotos).
- Nota media por apartado: **6,8/10** (media simple de las seis notas, detalle abajo).

### Puntuación por apartado

| Apartado (tarea)             | Nota | Justificación breve                                                                                                                                                                                   |
| ---------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Tipografía y lectura      | 6/10 | Medida 65ch, `text-wrap` y scroll propio de código/tablas correctos; jerarquía invertida en listas (D-03), doble H1 (D-01), muted al límite.                                                          |
| 2. Navegación e IA           | 6/10 | Shell, `aria-current`, skip link, "Volver" y estados correctos; `/contexts` indistinguible (D-02), falta "Volver" en proyecto (D-10), aside corta rutas (D-13), título no sigue el idioma (D-06).     |
| 3. Accesibilidad             | 6/10 | Landmarks, teclado, foco, `alt` y avisos de enlace externo correctos; `lang` fijo (D-05), subrayado de enlace 1,26:1 (D-08), enlace roto sin texto accesible (D-09), skip link sin `tabindex` (D-17). |
| 4. Motion                    | 9/10 | Solo `transform`/color, 150 ms, sin entrada ni scroll-reveal, `prefers-reduced-motion` global, hover gated; `transition-all` de shadcn (D-15).                                                        |
| 5. Responsive (360/768/1280) | 6/10 | Sin scroll horizontal de página, aside apilado y contenedores con scroll; nav en 2 líneas a 375 px (D-12), procedencia dominante (D-04), rutas partidas (D-04/D-13).                                  |
| 6. Anti-slop y tema          | 8/10 | Sin gradientes/glows/serif/eyebrows; H1 contenido; tokens claros/oscuros AA; modo oscuro inalcanzable (D-07).                                                                                         |

## 1. Hallazgos priorizados

Cada hallazgo cita la regla de skill aplicable; "corrección" es una propuesta concreta de archivo/clase, sin añadir texto educativo (los copys de interfaz propuestos son neutros o derivaciones literales de paths ya existentes).

### D-01 — MAJOR — Doble `<h1>`: el título de cabecera repite el H1 del documento

- **Archivos:** `platform/src/components/document-view.tsx:39` (h1 de cabecera), `platform/src/components/source-markdown.tsx:123-127` (h1 del documento); consumidores `catalog/projects-document.tsx:48`, `catalog/contexts-detail.tsx:105`, `catalog/lessons-detail.tsx:37`.
- **Evidencia real** (`curl -s http://localhost:3100/contexts/01-web-fundamentals`): el `<main>` contiene exactamente dos `<h1>` con el mismo texto:
  - `<h1 class="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">CONTEXT.md — Brasaland</h1>`
  - `<h1 class="mt-10 mb-4 scroll-mt-24 text-3xl font-semibold tracking-tight text-balance">CONTEXT.md — Brasaland</h1>`
  - En `/projects/ai-eng-milestone-choose-company` los dos H1 difieren solo en la fuente de la etiqueta: "Hito de empresa: Elige tu compañía" vs "Hito — Elige tu empresa". En `/projects`, `/contexts`, `/lessons` (índices) y 404 hay un solo H1.
- **Regla citada:** `impeccable` modo Read — "estructura para comprensión" (SKILL.md:35-36): una página con dos encabezados de máximo nivel que dicen lo mismo rompe la jerarquía antes que la expresión. El plan fija que "el H1 del documento mantiene su nivel semántico" (`M2_AUDIT_PLAN.md:293`, §4.1), así que el que sobra es el de cabecera. Complementa WCAG 2.4.6 (encabezados descriptivos).
- **Corrección propuesta:** en `DocumentView`, cuando se renderiza un documento cuyo Markdown ya empieza por H1, mostrar `title` como texto no-encabezado (p. ej. `<p className="text-2xl font-semibold tracking-tight sm:text-3xl">`) y dejar el único `<h1>` al documento; mantener `<h1>` en las vistas de índice (`/projects`, `/contexts`, `/lessons`) y en 404/error. Alternativa mínima: prop `titleAsHeading?: boolean` con `false` en las tres vistas de detalle.

### D-02 — MAJOR — `/contexts`: filas indistinguibles; no se muestra slug/carpeta

- **Archivo:** `platform/src/components/catalog/contexts-index.tsx:24-28` (items solo con `href` y `title`); `UnitList` ya soporta `meta` (`platform/src/components/unit-list.tsx:69-73`).
- **Evidencia real** (`curl -s http://localhost:3100/contexts`): 22 filas; títulos repetidos literalmente "CONTEXT — Brasaland" (×3), "CONTEXT.md — Brasaland", "CONTEXTO — Brasaland", "CONTEXT — Brasaland · Hito 3: …", y 4 filas cuyo título es solo el slug: `06-telemetry-data-pipelines`, `08-agent-engineering`, `10-realtime`, `sales-forecasting`. El `href` ya contiene el slug (`/contexts/01-web-fundamentals`) pero la fila no lo muestra.
- **Regla citada:** `impeccable` modo Read — estructura/IA (SKILL.md:35-36) y `design-taste-frontend` §4.9 ("long lists need a different UI component…", líneas 298-314): una lista cuyas filas no se pueden diferenciar no es escaneable. La tarea (observaciones del coordinador) pide, como máximo, mostrar la ruta/slug literal.
- **Corrección propuesta:** pasar `meta` a `UnitList` con una derivación literal ya disponible (`unit.slug` o `unit.sourcePath`, ambos de la fuente): p. ej. `meta: <code className="font-mono">{unit.slug}</code>`; en móvil, acomodarlo debajo del título (p. ej. `meta` con `max-sm:block max-sm:pt-0`). No añade texto educativo.

### D-03 — MAJOR — Jerarquía invertida en `/projects`: la descripción (16 px) pesa más que el título (14 px)

- **Archivos:** `platform/src/components/catalog/projects-index.tsx:81-83` (descripción vía `SourceMarkdown`), `platform/src/components/source-markdown.tsx:265` (`text-base … text-foreground` fijos), `platform/src/components/unit-list.tsx:57-59` (título `text-sm`).
- **Evidencia real** (primer `<li>` de `/projects`):
  - Título: `<a … class="… text-sm font-medium text-foreground …">¿Es Saludable Este Snack? — …</a>`
  - Descripción: `<div class="mt-1 text-sm …"><div class="… text-base leading-relaxed text-foreground …"><p class="my-4">Proyecto final en n8n: …</p></div></div>`
  - El `text-base` del wrapper interior (16 px) anula el `text-sm` (14 px) del contenedor; además la descripción usa `text-foreground` pleno, no `muted-foreground`.
- **Regla citada:** `design-taste-frontend` §4.1 — cuerpo/medida y jerarquía (líneas 165-171) y §9.B — "control hierarchy with weight + color, not raw scale" (líneas 606-609); `emil-design-eng` (taste/typography).
- **Corrección propuesta:** dar a `SourceMarkdown` una prop de tamaño/contexto (p. ej. `size?: "base" | "sm"`) que aplique `text-sm leading-relaxed` y deje heredar el color (`text-inherit`) en listados; usarla en `projects-index.tsx:82`. Alternativa local: envolver en `className="[&_p]:text-sm [&_div]:text-sm [&_*]:text-inherit"`. Mantener el título `text-sm font-medium`.

### D-04 — MAJOR — La procedencia domina la primera pantalla en móvil y parte los paths a mitad de palabra

- **Archivos:** `platform/src/components/provenance-header.tsx:34-92` (6 spans + `dl` de 5 filas), `platform/src/components/document-view.tsx:43` (posición entre cabecera y contenido), `:72,76,80,86,90` (`break-all`).
- **Evidencia real:** el bloque contiene repo, rama, commit corto, blob corto, fecha, "Ver en GitHub", y debajo `Fuente`, `Documento`, `Commit completo` (40 hex), `Blob completo` (40 hex) y `Snapshot` (36 caracteres). En 375 px se apila en ~9-11 líneas; el coordinador confirma en captura que ocupa la primera pantalla de la vista de contexto antes del contenido. Los `<code>` usan `break-all`, que corta en cualquier carácter (p. ej. `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`).
- **Regla citada:** `impeccable` modo Read — la estructura manda ("structure for comprehension", SKILL.md:35-36) y `design-taste-frontend` §1.B/§7 (densidad "trust-first", 4-5): el chrome de procedencia no puede comerse el contenido; la spec pedía "discreto pero siempre visible" (observación del coordinador).
- **Corrección propuesta:** dejar una línea compacta siempre visible con lo que exige AC-2.11 (repo + `main @ 962c1e5` + path del documento + "Ver en GitHub") y mover el detalle largo (commit/blob completos, snapshot, `imported_at`, `Fuente`) a un `<details><summary>Procedencia completa</summary>`; cambiar `break-all` por `break-words` (o `[overflow-wrap:anywhere]` solo si desborda) para romper en `/` y `-` en vez de a mitad de palabra. No se oculta información: sigue en el DOM y accesible con un clic/Enter.

### D-05 — MAJOR — `html lang="es"` fijo mientras se renderiza un documento en inglés

- **Archivos:** `platform/src/app/layout.tsx:13` (`<html lang="es">`), `platform/src/components/source-markdown.tsx:265` (wrapper sin `lang`).
- **Evidencia real** (`curl -s 'http://localhost:3100/lessons/4geeks-student-extension?lang=en'`): `<html lang="es" class="antialiased">` con `<h1 …>Your academy AI models in Codespaces: …</h1>` y todo el documento en inglés. Ídem en `/projects?lang=en` (README.md) y en contextos con `?doc=…en.md`.
- **Regla citada:** WCAG 3.1.1 (Language of Page) / 3.1.2 (Language of Parts), recogida por la tarea (apartado 3) y por `emil-design-eng` Accessibility; un lector de pantalla en español leerá con fonética y voz equivocadas un texto inglés.
- **Corrección propuesta:** envolver el render en `<article lang={document.language ?? undefined}>` (o pasar `lang` a `SourceMarkdown`), manteniendo `lang="es"` para la interfaz. Es una línea y no toca el contenido.

### D-06 — MINOR — Al cambiar de idioma, el título de cabecera y `<title>` no acompañan (mezcla es/en)

- **Archivos:** `platform/src/app/lessons/[slug]/page.tsx:40` (`getLesson(slug)` sin idioma) + `:18-29` (`generateMetadata` sin idioma), `platform/src/components/catalog/lessons-detail.tsx:37`; ídem contextos `contexts-detail.tsx:105`.
- **Evidencia real:** en `/lessons/4geeks-student-extension?lang=en` la cabecera muestra "Tus modelos de IA de la academia en Codespaces…" (español, derivado del documento preferido) y justo debajo el H1 inglés del documento; `<title>` sigue en español. En `/projects?lang=en` sí cambia porque el título sale de la etiqueta del README en el idioma pedido (ADR-017): la incoherencia es específica de lecciones y contextos.
- **Regla citada:** `impeccable` Read — consistencia; `design-taste-frontend` §4.5 (estados completos) y §9.C; la mezcla de idiomas en la misma pantalla sugiere un selector roto.
- **Corrección propuesta:** cuando se muestre una variante no preferida, derivar el título visible con `extractDocumentTitle(document.rawContent)` (función pura ya existente, ADR-017: H1 literal del documento mostrado) y usarlo también en `generateMetadata`. Si se aplica D-01 (título de cabecera no-encabezado), basta con que ese texto sea el H1 del documento mostrado.

### D-07 — MINOR — El modo oscuro existe en tokens pero nunca se activa

- **Archivos:** `platform/src/app/globals.css:131` (`color-scheme: light` fijo), `:91-123` (`.dark` solo por clase), `:5` (`@custom-variant dark (&:is(.dark *))`); `platform/src/app/layout.tsx:13` (sin clase ni media query).
- **Evidencia real:** el CSS compilado servido por el dev server contiene 20 reglas `.dark` y **0** apariciones de `prefers-color-scheme`; el `<html>` nunca recibe `class="dark"`. Con `prefers-color-scheme: dark` la app sigue en claro (confirmado por el coordinador en capturas).
- **Regla citada:** `design-taste-frontend` §6.C ("Dark Mode (mandatory…)… Respect `prefers-color-scheme`", líneas 531-535) y §8.C/§8.D ("Test in Both Modes Before Finishing"); el plan §4.6 aplaza solo el **selector** de tema (BACKLOG "temas visuales"), no la adaptación al sistema.
- **Corrección propuesta:** script inline en `layout.tsx` (antes del paint) que añada `dark` a `document.documentElement` cuando `matchMedia("(prefers-color-scheme: dark)")` coincida (y escuche cambios), sin añadir UI de selección; así los tokens `.dark` (que ya pasan AA, ver §A.2) se activan. Si el equipo decide que H2 es deliberadamente light-only, dejarlo escrito en el informe de cierre como excepción a la skill.

### D-08 — MAJOR — Enlaces del contenido casi indistinguibles: subrayado `decoration-border` = 1,26:1

- **Archivos:** `platform/src/components/source-markdown.tsx:18-19` (`linkClass` con `decoration-border`), `platform/src/components/provenance-header.tsx:63`, `platform/src/components/catalog/contexts-detail.tsx:84`, `platform/src/app/not-found.tsx:6`, `platform/src/app/error.tsx:37`.
- **Evidencia real:** `#e5e5e5` (`--border`, `oklch(0.922 0 0)`) sobre `#ffffff` → **1,26:1** (calculado, §A.2). El texto del enlace comparte color con el cuerpo (`text-foreground`), así que la única señal visual para diferenciar un enlace dentro de un README es un subrayado de 1 px casi invisible; el refuerzo `hover-fine:decoration-foreground` solo existe con puntero fino (no en táctil).
- **Regla citada:** WCAG 1.4.1 (Use of Color: el enlace debe distinguirse por algo más que el color, y ese algo debe ser perceptible) y `design-taste-frontend` §6.B (accesibilidad); afecta a la superficie principal de lectura (cientos de enlaces reales).
- **Corrección propuesta:** cambiar la decoración compartida a `decoration-muted-foreground` (**4,73:1**, pasa 3:1 de non-text y hace visible el subrayado) o `decoration-foreground/60`; mantener `hover-fine:decoration-foreground`. Un solo cambio en `linkClass` + los cuatro call sites.

### D-09 — MINOR — Enlace roto sin texto visible/accesible que explique el estado

- **Archivo:** `platform/src/components/source-markdown.tsx:30-46` (`BrokenText`), uso en `:84` y `:94-104`.
- **Evidencia real** (`/contexts/06-telemetry-data-pipelines?doc=data-pipelines%2FCONTEXT-brasaland.es.md`): `<span aria-disabled="true" class="cursor-not-allowed text-destructive underline decoration-dotted underline-offset-4" title="Enlace roto en el origen: ./CONTEXT-brasaland-pipeline.md">…</span>`. No es focalizable (correcto para no ofrecer un destino), pero un lector de pantalla no recibe ninguna explicación (el `title` no se anuncia de forma fiable) y el plan §4.3 pedía un icono textual.
- **Regla citada:** WCAG 3.3.1/1.4.1 y `M2_AUDIT_PLAN.md:310` (§4.3: "estilo visible … + icono textual 'enlace roto en el origen'").
- **Corrección propuesta:** añadir dentro del `span` un `<span className="sr-only"> (enlace roto en el origen)</span>` (y el equivalente en `renderImage`), conservando `title` para puntero. Opcionalmente un glifo visible con `aria-hidden="true"`.

### D-10 — MINOR — `/projects/[slug]` no ofrece "Volver a Proyectos" (asimetría de navegación)

- **Archivos:** `platform/src/app/projects/[slug]/page.tsx:95-115` (no pasa `backHref`); sí lo hacen `projects/[slug]/[subslug]/page.tsx:131-132`, `catalog/contexts-detail.tsx:128-129` y `catalog/lessons-detail.tsx:59-60`.
- **Evidencia real:** en el HTML del proyecto no existe ningún enlace "Volver"; solo el shell y el aside "Subproyectos". El subproyecto sí muestra "← Volver al proyecto".
- **Regla citada:** `impeccable` Read — navegación predecible/consistente; la tarea incluye "Volver" en el apartado 2.
- **Corrección propuesta:** pasar `backHref={projectsIndexHref()}` y `backLabel="Volver a Proyectos"` en `page.tsx` (import ya existente en otros puntos).

### D-11 — MINOR — Filas de lista con doble affordance al hover (fondo + subrayado) y ruido visual

- **Archivo:** `platform/src/components/unit-list.tsx:50` (`hover-fine:bg-muted/60` en la fila) y `:59` (`hover-fine:underline` en el título).
- **Evidencia real:** ambas reglas viven bajo `@media (hover: hover) and (pointer: fine)` y se activan a la vez; además la fila entera cambia de fondo aunque solo el título sea clicable, y los enlaces dentro de las descripciones ya van subrayados siempre (D-08).
- **Regla citada:** `design-taste-frontend` §4.4 ("group with `divide-y`/negative space…", líneas 213-217) y `emil-design-eng` cohesión del feedback (purpose único).
- **Corrección propuesta:** elegir una sola señal: mantener el fondo de fila y quitar `hover-fine:underline`, o mantener el subrayado y quitar el fondo. Si se quiere fila completa clicable, convertir el `li` en el `<a>` con el `hover-fine:bg` (una sola affordance).

### D-12 — MINOR — Nav del shell en 2 líneas a 375 px, con 3 ítems deshabilitados ocupando sitio

- **Archivo:** `platform/src/components/app-shell.tsx:21` (`flex-col … sm:flex-row`), `:29` (`flex-wrap`), `:39-50` (`Buscar/Tutor/Progreso`).
- **Evidencia real:** a 375 px la suma de los 6 ítems (~431 px con `px-2.5` y `text-sm`) supera los ~343 px útiles y envuelve a 2 líneas (confirmado en captura por el coordinador).
- **Regla citada:** `design-taste-frontend` §4.7 — "Navigation MUST render on a single line on desktop" y colapso móvil explícito (líneas 247-260).
- **Corrección propuesta:** ocultar los no disponibles bajo `sm` (`hidden sm:inline-block` en `:44`) o convertir la lista en una fila con scroll horizontal (`flex-nowrap overflow-x-auto`) sin romper `aria-current`; el `title="Próximo hito"` y el `sr-only` actuales se conservan.

### D-13 — MINOR — El aside "Documentos" corta rutas de archivo en dos líneas

- **Archivos:** `platform/src/components/catalog/contexts-detail.tsx:58-63` (`label: document.relativePath`), `platform/src/components/document-view.tsx:48` (`lg:w-64` = 256 px).
- **Evidencia real** (`/contexts/06-telemetry-data-pipelines?doc=…`): las etiquetas literales incluyen `data-pipelines/CONTEXT-brasaland.es.md` (36 caracteres ≈ 252 px a 14 px) dentro de una columna de 256 px con padding, por lo que envuelven a 2 líneas; en el caso de contextos anidados, todas las filas.
- **Regla citada:** `design-taste-frontend` §4.1 (legibilidad/medida) y `impeccable` Read (navegación lateral escaneable).
- **Corrección propuesta:** ensanchar el aside (`lg:w-72`, 288 px) y/o partir la etiqueta en dos líneas tipográficas: `basename` como texto principal y `dirname` como línea secundaria `text-xs text-muted-foreground` (ambos literales del path). La ruta completa sigue en el `href`.

### D-14 — NIT — Número de orden pequeño y desalineado respecto al título

- **Archivo:** `platform/src/components/unit-list.tsx:52` (`mt-0.5 w-8 … text-xs`) frente a `:59` (`text-sm`).
- **Evidencia real:** la línea del número (`text-xs`, `mt-0.5`) no comparte línea base ni altura de línea con el título de 14 px; en la captura del coordinador se ve descolgado.
- **Regla citada:** `design-taste-frontend` §4.1 (ritmo tipográfico) / §7 (VISUAL_DENSITY: "font-mono for all numbers" ya se cumple).
- **Corrección propuesta:** `leading-6 pt-[3px]` (o `items-baseline` con `leading-none` en ambos) para alinear la primera línea del título con el número.

### D-15 — MINOR — `Button` de shadcn con `transition-all` y hover sin gate de puntero

- **Archivo:** `platform/src/components/ui/button.tsx:7` (`transition-all`), `:11-20` (`hover:` sin `hover-fine:`).
- **Evidencia real:** es el único `transition-*` del código que no especifica propiedades (todos los demás usan `transition-colors duration-150 ease-out`); el feedback de pulsación (`active:…translate-y-px`) sí es correcto.
- **Regla citada:** `emil-design-eng` Review Checklist — "`transition: all` → specify exact properties" y "Hover animation without media query → add `@media (hover: hover) and (pointer: fine)`" (SKILL.md:658-674).
- **Corrección propuesta:** `transition-colors` y sustituir los `hover:` por `hover-fine:` (el componente solo se usa en el estado vacío y en `error.tsx`, pero conviene alinearlo).

### D-16 — NIT — `tw-animate-css` importado sin uso

- **Archivo:** `platform/src/app/globals.css:2`.
- **Evidencia:** no existe ninguna clase `animate-*` ni `@keyframes` en `platform/src/**`; el CSS compilado no aporta animaciones.
- **Regla citada:** `design-taste-frontend` §6.E (DOM/bundle cost) y el principio de no cargar código muerto.
- **Corrección propuesta:** retirar el `@import "tw-animate-css";` (y la dependencia si no la usa shadcn) hasta que haga falta; candidato a BACKLOG.

### D-17 — NIT — Skip link sin `tabindex="-1"` en el destino

- **Archivos:** `platform/src/components/app-shell.tsx:14-19` (enlace) y `:55-58` (`<main id="contenido">`).
- **Evidencia:** `<main id="contenido">` no tiene `tabindex`; los navegadores modernos mueven el punto de partida de la tabulación, pero añadirlo garantiza el foco en todos los motores y lectores.
- **Regla citada:** buena práctica WCAG 2.4.1 (Bypass Blocks) / patrón skip-link.
- **Corrección propuesta:** añadir `tabIndex={-1}` a `<main>`.

## 2. Verificado y correcto (sin hallazgo)

- **Tipografía/lectura:** medida `max-w-[65ch]` en el contenido (`document-view.tsx:46`, `source-markdown.tsx:265`); `text-wrap: balance` en headings y `pretty` en párrafos/`li` (`globals.css:140-154`); código en `pre` con `overflow-x-auto` y tablas GFM envueltas en `overflow-x-auto` (`source-markdown.tsx:173-176, 215-221`); H1 del documento a 30 px (`text-3xl`), sin H1 gigante; fuente system-ui (sin serif ni Inter por defecto).
- **Navegación:** shell max-w-5xl, una sola línea en desktop; `aria-current="page"` correcto en `NavLink` (verificado en HTML de `/projects` y `/lessons`); skip link presente; "Volver" presente en contextos, lecciones y subproyectos; `DocumentNav` marca el documento actual con `aria-current="true"` + fondo (no solo color); estados vacío/404 (`/no-existe-abc` → 404 con H1 y enlace) y `error.tsx` con "Reintentar" existen.
- **Accesibilidad:** landmarks `header`/`nav[aria-label=Principal]`/`main#contenido`/`aside`/`footer`; foco visible con `outline`/`ring` (ring 4,73:1 claro y 4,18:1 oscuro, ≥3:1); `alt` literal o vacío para decorativas; `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`; enlaces externos con `target="_blank"`, `rel="noopener noreferrer"` y `sr-only "(se abre en una pestaña nueva)"`; `<details>/<summary>` nativos; checkboxes `disabled`/`readOnly`; `aria-disabled="true"` en items próximos con explicación `sr-only`.
- **Motion:** no hay animaciones de entrada, scroll-reveal, stagger, parallax ni loops; solo transiciones de color 150 ms `ease-out` y `transform` de pulsación (`active:translate-y-px`); `@media (prefers-reduced-motion: reduce)` neutraliza animaciones y `scroll-behavior` (compilado en el CSS); sin `window.addEventListener("scroll")`.
- **Anti-slop:** 0 gradientes, 0 glows, 0 sombras decorativas, 0 em-dashes en copys de interfaz, 0 tarjetas anidadas, 0 eyebrows repetidos (el kicker "Contexto"/"Lección" aparece 1 por página), una sola escala de radios vía tokens, paleta neutra con un único acento.
- **Contenido:** todo texto educativo del HTML procede del snapshot (el guard AC-0.10 y los tests de fidelidad lo cubren); esta QA no detectó ningún copys inventado; el "N" del indicador de Next dev se ignora por indicación del coordinador (solo dev).
- **Guard:** 14/14 tests verdes en `no-hardcoded-catalog.test.ts` (ver cabecera).

## 3. Verificación de las observaciones del coordinador

| #   | Observación (capturas 1280/375)                                                                                                     | ¿Confirmada?                                                                               | Hallazgo / severidad                  | Corrección                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Con `prefers-color-scheme: dark` la app sigue en claro; `.dark` existe pero nada lo activa.                                         | Sí (`0` reglas `prefers-color-scheme` en CSS compilado; `color-scheme: light` fijo).       | D-07 / MINOR                          | Script inline de clase `dark` por `matchMedia`; sin selector (BACKLOG).                  |
| 2   | `/contexts`: títulos casi idénticos ("CONTEXT — Brasaland" repetido) y sin carpeta/slug; los 4 sin preferido solo muestran el slug. | Sí (22 filas; 4 con slug únicamente; repetidos ×3).                                        | D-02 / MAJOR                          | `meta` con slug/sourcePath literal (UnitList ya lo soporta).                             |
| 3   | Vistas de documento: la cabecera repite exactamente el H1 renderizado debajo.                                                       | Sí (`/contexts/01-web-fundamentals` → 2 `<h1>` iguales; también en proyecto y lección).    | D-01 / MAJOR                          | Título de cabecera no-encabezado en vistas de detalle.                                   |
| 4   | Bloque de procedencia (5 filas + barra) muy prominente; la spec pedía "discreto pero siempre visible".                              | Sí (6 spans + `dl` de 5 filas; ocupa la primera pantalla a 375 px).                        | D-04 / MAJOR                          | Línea compacta + `<details>` para el detalle; `break-words` en vez de `break-all`.       |
| 5   | Filas de listas con fondo + subrayado a la vez; el aside "Documentos" corta nombres en dos líneas.                                  | Sí (`unit-list.tsx:50,59`; `data-pipelines/CONTEXT-brasaland.es.md` en columna de 256 px). | D-11 y D-13 / MINOR                   | Elegir una sola affordance; `lg:w-72` y/o etiqueta en 2 líneas (basename + dirname).     |
| 6   | `/projects` 1280: descripción más grande que el título; fila con fondo + subrayado; número pequeño/desalineado.                     | Sí (descripción 16 px vs título 14 px; ver D-11; número `text-xs` vs título `text-sm`).    | D-03 (MAJOR), D-11 y D-14 (MINOR/NIT) | Prop de tamaño en `SourceMarkdown`; una sola affordance; alinear número.                 |
| 7   | 375 px: nav del shell en 2 líneas; procedencia ocupa la primera pantalla; paths partidos a mitad de palabra.                        | Sí (suma ≈431 px > 343 px; `break-all` en la procedencia).                                 | D-12 y D-04 (MINOR/MAJOR)             | Ocultar ítems no disponibles o scroll horizontal; compactar procedencia y `break-words`. |
| 8   | El indicador "N" de Next dev abajo a la izquierda es solo de dev.                                                                   | Sí, es el overlay de desarrollo.                                                           | —                                     | Se ignora; no es parte del diseño.                                                       |

## Apéndice A — Método, evidencia y contraste

### A.1 Comandos reproducibles (sin secretos)

- `curl -s http://localhost:3100/…` sobre las rutas listadas en la cabecera; HTML guardado solo en `/tmp` fuera del repo.
- `curl -s http://localhost:3100/_next/static/chunks/src_app_globals_162hn9o.css` (dev) para verificar el CSS compilado: `hover-fine` → `@media (hover: hover) and (pointer: fine)` presente; `.dark` presente; `prefers-color-scheme` ausente.
- `npx --yes pnpm@12.8.1 --dir platform test src/test/no-hardcoded-catalog.test.ts` → 14/14.
- Cálculo de contraste: script Python efímero en `/tmp` con conversión OKLCH→sRGB y compresión alfa sRGB para los tokens de `globals.css`; no se escribió nada en el repo.

### A.2 Contraste WCAG de los tokens usados en texto/estado (calculado)

Tema claro (`:root`):

| Uso real                                      | Token(s)                                        | Ratio     | AA texto (4,5) | AA no-texto (3,0) |
| --------------------------------------------- | ----------------------------------------------- | --------- | -------------- | ----------------- |
| Texto principal                               | `foreground` `#0a0a0a` / `background` `#ffffff` | **19,79** | ✅             | ✅                |
| Texto muted (footer, provenance, meta)        | `muted-foreground` `#737373` / `#ffffff`        | **4,73**  | ✅ (justo)     | ✅                |
| Muted en procedencia (`bg-muted/30`)          | `#737373` / `#fcfcfc`                           | **4,61**  | ✅ (justo)     | ✅                |
| Selector idioma inactivo (`bg-muted/40`)      | `#737373` / `#fafafa`                           | **4,57**  | ✅ (justo)     | ✅                |
| Estado roto                                   | `destructive` `#e7000b` / `#ffffff`             | **4,76**  | ✅             | ✅                |
| Foco                                          | `ring` `#737373` / `#ffffff`                    | **4,73**  | —              | ✅                |
| Item actual de nav (`bg-secondary`)           | `secondary-foreground` `#171717` / `#f5f5f5`    | **16,42** | ✅             | ✅                |
| Código de procedencia (`text-foreground/80`)  | `#3b3b3b` / `#ffffff`                           | **11,20** | ✅             | ✅                |
| **Subrayado de enlace (`decoration-border`)** | `#e5e5e5` / `#ffffff`                           | **1,26**  | ❌ (D-08)      | ❌                |

Tema oscuro (`.dark`, hoy inalcanzable, D-07):

| Uso real             | Token(s)                                        | Ratio     | AA texto | AA no-texto |
| -------------------- | ----------------------------------------------- | --------- | -------- | ----------- |
| Texto principal      | `foreground` `#fafafa` / `background` `#0a0a0a` | **18,96** | ✅       | ✅          |
| Texto muted          | `muted-foreground` `#a1a1a1` / `#0a0a0a`        | **7,63**  | ✅       | ✅          |
| Muted en procedencia | `#a1a1a1` / `#151515`                           | **7,20**  | ✅       | ✅          |
| Estado roto          | `destructive` `#ff6467` / `#0a0a0a`             | **6,84**  | ✅       | ✅          |
| Foco                 | `ring` `#737373` / `#0a0a0a`                    | **4,18**  | —        | ✅          |

Conclusión de contraste: todos los pares de texto pasan AA en ambos temas; los valores muted rozan el umbral (4,57-4,73) sin margen, y el único fallo real es el subrayado de enlaces (D-08). No se recomienda recolorear tokens.

### A.3 Alcance respetado

- No se modificó ningún archivo del repo salvo `docs/milestones/M2_QA_DESIGN.md`; no se arreglaron hallazgos.
- Sin `install`, `build`, `start`, `ingest` ni `db:migrate`; sin escrituras en la base; `DATABASE_URL` nunca se imprimió ni se copió (solo la usa el dev server del coordinador).
- Los scripts de análisis y los HTML descargados viven en `/tmp`, fuera del repo.
- Los fixtures no se tocaron; el guard AC-0.10 sigue verde.

---

# Re-QA (post-correcciones)

- Tarea: `[M2-RQA-FD]` — segunda pasada READ-ONLY de diseño y accesibilidad tras FX1–FX5 (D-01..D-17). El único archivo tocado es este informe (append).
- Fecha: 2026-10-02. Servidor: `http://localhost:3100` (reinicio del proceso a media sesión avisado por el coordinador; las páginas afectadas se re-descargaron).
- Evidencia: HTML real de 24 URLs (`curl -s`, guardado en `/tmp`) y CSS compilado servido por Next (`src_app_globals_162hn9o.css`, 50.383 bytes); ratios WCAG recalculados desde los tokens `oklch` de `platform/src/app/globals.css` con un script Python efímero fuera del repo (conversión OKLCH→sRGB, composición alfa y luminancia relativa). El modo oscuro se verificó por `prefers-color-scheme` en el CSS compilado (no hay captura de navegador en esta ronda; ver limitación en §D3).
- Skills citadas: `/Users/aresdominguezgil/.claude/skills/impeccable/SKILL.md` (modo **Read**: "Structure for comprehension…", línea 35), `/Users/aresdominguezgil/.claude/skills/emil-design-eng/SKILL.md` (Review Checklist, líneas 664/669/670) y `/Users/aresdominguezgil/.claude/skills/design-taste-frontend/SKILL.md` (§4.1 l.165-171, §4.7 l.247, §4.9 l.298-314, §6.C l.531-535, §8.C/§8.D l.588-590, §9.B l.606-609).
- Guard AC-0.10 en esta ronda: **14/14 verdes**; suite completa **417 tests, 0 fallos**.

## D1. Estado de D-01..D-17

| ID   | Sev. original | Estado re-QA      | Evidencia de la corrección                                                                                                                                                                                            | Regla de skill                                                                 |
| ---- | ------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D-01 | MAJOR         | **Corregido**     | `document-view.tsx:38-41,58-62` pinta el título como `<p>` en detalles; **14/14 páginas de detalle con 1 solo `<h1>`** (el del documento). Clase real: `text-base font-medium tracking-tight text-muted-foreground sm:text-lg`. | impeccable Read l.35; design-taste §9.B l.606-609 (jerarquía por peso+color)   |
| D-02 | MAJOR         | **Corregido**     | `contexts-index.tsx:47` pasa `meta: unit.slug`; `unit-list.tsx:65-69` lo pinta (`font-mono text-xs`, `max-sm:basis-full`). `/contexts`: **22/22 filas con slug** (se distingue "CONTEXT — Brasaland" ×3).                  | design-taste §4.9 l.298-314 (listas largas deben poder escanearse)             |
| D-03 | MAJOR         | **Corregido**     | `source-markdown.tsx:16,327-334` (variante `compact`: `text-sm leading-relaxed text-muted-foreground`), usada en `projects-index.tsx:84-88`; `unit-list.tsx:72` fuerza `[&_p]:text-sm`. `/projects`: título `text-sm leading-6 font-semibold`, **0 wrappers `text-base`** en descripciones. | design-taste §4.1 l.165-171; §9.B (control de jerarquía)                       |
| D-04 | MAJOR         | **Corregido**     | `provenance-header.tsx:29-35,46-134`: línea compacta (repo + sha corto + path + "Ver en GitHub") y `<details><summary>Detalles de procedencia</summary>`; `[overflow-wrap:anywhere]` sustituye a `break-all` (0 apariciones en la procedencia servida). | impeccable Read l.35; design-taste densidad "trust-first"                     |
| D-05 | MAJOR         | **Corregido**     | `document-view.tsx:67` aplica `lang` al contenedor del cuerpo: `lang="en"` en `?lang=en` y `?doc=…en.md`, `lang="es"` en ES. `<html lang="es">` se conserva **por diseño** como idioma de la interfaz.                  | WCAG 3.1.2 (Language of Parts), recogido en la tarea                          |
| D-06 | MINOR         | **Corregido**     | `lessons-detail.tsx:38-44` deriva el título del documento mostrado; `contexts/[slug]/page.tsx:127-134` arma `<title>` con el H1 mostrado + slug. HTML: `/lessons/…?lang=en` → `<title>Your academy AI models…`; `?doc=CONTEXT-brasaland.en.md` → `<title>CONTEXT.md — Brasaland · 01-web-fundamentals`. | impeccable Read (consistencia); design-taste §4.5/§9.C                        |
| D-07 | MINOR         | **Corregido**     | `globals.css:4` (`@custom-variant dark (@media (prefers-color-scheme: dark))`), `:90-124` (tokens oscuros bajo la media query) y `:132` (`color-scheme: light dark`). CSS compilado: **4 bloques `@media (prefers-color-scheme: dark)`** y **0 selectores `.dark`**; el modo oscuro se activa por sistema sin selector. | design-taste §6.C l.531-535 y §8.D l.590 ("Respect prefers-color-scheme")     |
| D-08 | MAJOR         | **Corregido** (R-1) | `source-markdown.tsx:20` y `provenance-header.tsx:76`: subrayado `decoration-muted-foreground` → **4,73:1** (claro) y **7,63:1** (oscuro), ≥3:1 no-texto. Quedan 3 call sites con `decoration-border` (R-1).              | WCAG 1.4.1; design-taste §6.B                                                  |
| D-09 | MINOR         | **Corregido**     | `source-markdown.tsx:36-57`: hint visible ` (enlace roto)` + `title` + `aria-disabled`, también en imágenes. HTML real (8 docs de `data-pipelines`): `<span …>available in English (enlace roto)</span>`, sin `href`.    | WCAG 3.3.1/1.4.1; `M2_AUDIT_PLAN.md` §4.3                                     |
| D-10 | MINOR         | **Corregido**     | `projects/[slug]/page.tsx:100-106,139-140` pasa `backHref`/`backLabel`; HTML: `← Volver a Proyectos` en los detalles de proyecto (antes ausente).                                                                     | impeccable Read (navegación predecible)                                        |
| D-11 | MINOR         | **Corregido**     | `unit-list.tsx:51` (fondo de fila `hover-fine:bg-muted/60`) + `:61` (`after:absolute after:inset-0`, sin `hover-fine:underline`); `:72` deja los enlaces de la descripción en una capa `relative` clicable. Una sola affordance y fila completa. | design-taste §4.4; emil (feedback con un propósito)                            |
| D-12 | MINOR         | **Corregido**     | `app-shell.tsx:30-32` (`min-w-0 overflow-x-auto`, `flex flex-nowrap`) y `:43` (`hidden sm:block` para Buscar/Tutor/Progreso); HTML servido con esas clases.                                                            | design-taste §4.7 l.247 (nav en una línea; colapso móvil explícito)            |
| D-13 | MINOR         | **Corregido**     | `document-view.tsx:71` (`lg:w-72`) y `document-nav.tsx:21-33` parten la etiqueta en `basename` + `dirname` (línea secundaria muted, `break-words`); HTML real con `data-pipelines/` en segunda línea.                   | design-taste §4.1; impeccable Read (navegación lateral escaneable)             |
| D-14 | NIT           | **Corregido**     | `unit-list.tsx:53` (marcador `text-sm leading-6`) y `:61` (título `text-sm leading-6`): misma línea base. HTML: `<span class="w-8 … leading-6 tabular-nums">0</span>`.                                                | design-taste §4.1 (ritmo tipográfico)                                          |
| D-15 | MINOR         | **Corregido**     | `button.tsx:7` usa `transition-[color,background-color,border-color,transform] duration-150 ease-out` y `hover-fine:` en todas las variantes; sin `transition-all`.                                                    | emil l.664 ("transition: all" → propiedades exactas) y l.670 (media query)     |
| D-16 | NIT           | **Parcial** (R-2) | `globals.css` ya **no** importa `tw-animate-css`; la dependencia sigue en `platform/package.json:35` sin uso.                                                                                                          | design-taste §6.E (coste de bundle/código muerto)                              |
| D-17 | NIT           | **Corregido**     | `app-shell.tsx:60` añade `tabIndex={-1}` a `<main id="contenido">`; verificado en el HTML de todas las páginas muestreadas.                                                                                             | WCAG 2.4.1 (Bypass Blocks)                                                     |

## D2. Contraste WCAG recalculado (claro y oscuro)

Tema claro (`:root`). El subrayado de enlaces de contenido ya usa `muted-foreground` (D-08):

| Uso real                                     | Token(s)                                         | Ratio     | AA texto (4,5) | AA no-texto (3,0) |
| -------------------------------------------- | ------------------------------------------------ | --------- | -------------- | ----------------- |
| Texto principal                              | `foreground` `#0a0a0a` / `background` `#ffffff`  | **19,79** | ✅             | ✅                |
| Muted (footer/procedencia/meta)              | `muted-foreground` `#737373` / `#ffffff`         | **4,73**  | ✅ (justo)     | ✅                |
| Muted en procedencia (`bg-muted/30`)         | `#737373` / `#fcfcfc`                            | **4,61**  | ✅ (justo)     | ✅                |
| Selector idioma inactivo (`bg-muted/40`)     | `#737373` / `#fbfbfb`                            | **4,57**  | ✅ (justo)     | ✅                |
| Estado roto                                  | `destructive` `#e7000b` / `#ffffff`              | **4,76**  | ✅             | ✅                |
| Foco                                         | `ring` `#737373` / `#ffffff`                     | **4,73**  | —              | ✅                |
| Nav actual (`bg-secondary`)                  | `secondary-foreground` `#171717` / `#f5f5f5`     | **16,42** | ✅             | ✅                |
| Code de procedencia (`foreground/80`)        | `#3b3b3b` / `#ffffff`                            | **11,20** | ✅             | ✅                |
| **Subrayado de enlaces de contenido**        | `muted-foreground` `#737373` / `#ffffff`         | **4,73**  | —              | ✅ (D-08 ok)      |
| Subrayado restante (`decoration-border`, R-1) | `border` `#e5e5e5` / `#ffffff`                   | **1,26**  | —              | ❌                |

Tema oscuro (`.dark` sustituido por `@media (prefers-color-scheme: dark)`, ya alcanzable):

| Uso real                                | Token(s)                                        | Ratio     | AA texto | AA no-texto |
| --------------------------------------- | ----------------------------------------------- | --------- | -------- | ----------- |
| Texto principal                         | `foreground` `#fafafa` / `background` `#0a0a0a` | **18,96** | ✅       | ✅          |
| Muted                                   | `muted-foreground` `#a1a1a1` / `#0a0a0a`        | **7,63**  | ✅       | ✅          |
| Muted en procedencia (`bg-muted/30`)    | `#a1a1a1` / `#121212`                           | **7,20**  | ✅       | ✅          |
| Selector inactivo (`bg-muted/40`)       | `#a1a1a1` / `#151515`                           | **7,03**  | ✅       | ✅          |
| Estado roto                             | `destructive` `#ff6467` / `#0a0a0a`             | **6,84**  | ✅       | ✅          |
| Foco                                    | `ring` `#737373` / `#0a0a0a`                    | **4,18**  | —        | ✅          |
| Nav actual                              | `secondary-foreground` `#fafafa` / `#262626`    | **14,48** | ✅       | ✅          |
| Dirname actual del aside (`…/70`)       | `#bababa` / `#262626`                           | **7,82**  | ✅       | ✅          |
| Code de procedencia (`foreground/80`)   | `#cacaca` / `#0a0a0a`                           | **12,07** | ✅       | ✅          |
| Subrayado de enlaces de contenido       | `#a1a1a1` / `#0a0a0a`                           | **7,63**  | —        | ✅          |

Conclusión: todos los pares de texto pasan AA en ambos temas; el modo oscuro ahora se activa por sistema (D-07) y sus tokens pasan AA con margen. El único fallo de contraste que persiste es el subrayado `decoration-border` de los call sites residuales (R-1).

## D3. Limitaciones de método

- No se usó navegador ni capturas en esta ronda: el modo oscuro se verificó en el **CSS compilado** (media query + tokens) y los ratios se recalcularon desde los tokens; no se observó el render con `prefers-color-scheme: dark` activo en un motor real. La reproducción visual del coordinador en la ronda anterior ya confirmó el token oscuro; si se quiere cierre visual, basta una captura con el sistema en oscuro.

## D4. Regresiones nuevas

#### R-1 — MINOR — Quedan 3 call sites con subrayado `decoration-border` (1,26:1) fuera del contenido

- **Dónde**: `platform/src/components/catalog/contexts-detail.tsx:93` (enlaces de assets del aside), `platform/src/app/not-found.tsx:6` y `platform/src/app/error.tsx:37` (enlaces "Volver a Proyectos").
- **Evidencia real**: `/contexts/09-agentic-workflows` renderiza **12 enlaces de assets** con `class="text-sm font-medium break-all underline decoration-border …"` (p. ej. `rfp-requests/brasaland/CONTEXT-brasaland-request-1.pdf`); el 404 y `error.tsx` usan la misma clase en "Volver a Proyectos".
- **Impacto**: subrayado 1,26:1 (claro) por debajo del 3:1 de WCAG 1.4.1 para componentes no textuales; contraste con el texto de los enlaces (foreground) sí pasa. D-08 se corrigió en la superficie principal (contenido y procedencia), no en estos tres puntos.
- **Corrección sugerida**: cambiar `decoration-border` por `decoration-muted-foreground` en esos 3 sitios (4,73:1 claro / 7,63:1 oscuro), alineando con `linkClass`.

#### R-2 — NIT — Dependencia `tw-animate-css` conservada sin uso

- **Dónde**: `platform/package.json:35` (y `pnpm-lock.yaml:5229`), con el `@import` ya retirado de `globals.css`.
- **Impacto**: dependencia muerta en install/CI; sin efecto visual.
- **Corrección sugerida**: retirarla del `package.json` si no la usa shadcn en H2 (candidato a BACKLOG, como ya decía D-16).

#### R-3 — NIT — Los enlaces de assets del aside siguen con `break-all`

- **Dónde**: `platform/src/components/catalog/contexts-detail.tsx:93`.
- **Evidencia real**: `/contexts/09-agentic-workflows` corta `rfp-requests/brasaland/CONTEXT-brasaland-request-1.pdf` a mitad de palabra en la columna del aside (`lg:w-72`).
- **Impacto**: mismo defecto de legibilidad que D-04 corrigió en la procedencia (allí se pasó a `[overflow-wrap:anywhere]`), pero acotado al aside de assets.
- **Corrección sugerida**: sustituir `break-all` por `break-words`/`[overflow-wrap:anywhere]` o reutilizar el partido basename/dirname de `DocumentNav`.

## D5. Veredicto de la re-QA de diseño

- **LISTO PARA CERRAR.** 0 BLOCKER y 0 MAJOR: D-01..D-15 y D-17 corregidos con evidencia en código y HTML real; D-08 corregido en la superficie principal; D-16 parcial.
- Quedan **1 MINOR (R-1: subrayado 1,26:1 en 3 call sites residuales)** y **2 NIT (R-2 dependencia muerta, R-3 `break-all` en assets)**; ninguno bloquea el cierre y los tres tienen corrección de una línea registrada.
- Nota: no se re-puntúan los seis apartados de la ronda anterior; con las correcciones aplicadas, los defectos que bajaban tipografía, navegación y accesibilidad están resueltos (un solo H1, filas distinguibles, jerarquía título>descripción, procedencia compacta, `lang` del documento, modo oscuro por sistema y subrayados de contraste).

## Apéndice C — Evidencia reproducible de la re-QA de diseño

- `curl -s http://localhost:3100/...` sobre 24 URLs (índices, 14 detalles ES/EN, contextos con/sin `?doc`, 404); HTML en `/tmp/m2rqa`.
- CSS compilado: `curl -s http://localhost:3100/_next/static/chunks/src_app_globals_162hn9o.css` → 4 bloques `prefers-color-scheme: dark`, tokens oscuros presentes, 0 selectores `.dark`, `hover-fine` compilado (2), `prefers-reduced-motion` presente.
- Contraste: script Python efímero en `/tmp/m2rqa/contrast.py` (OKLCH→sRGB, alfa, WCAG 2.x).
- Tests: guard 14/14 y suite completa 417/417 (1 skipped).
- Restricciones: READ-ONLY, sin `install`, sin escrituras en base, `DATABASE_URL` nunca impresa, dev server del coordinador intacto.

---

## QA final (independencia, idioma global, tema)

- Tarea: `[M2-FQA-FD]` — QA **READ-ONLY** final de diseño y accesibilidad tras ADR-018 (espejo/`source-files`), ADR-019 (selector único de idioma) y el selector de tema claro/oscuro/sistema. El único archivo tocado es este informe (append); no se arregló nada.
- Fecha: 2026-10-02. Servidor `http://localhost:3100` (del coordinador). Evidencia: HTML real de 19 páginas (`curl -s` con `Cookie: lang=es|en` y `theme=light|dark|system`), CSS/tokens de `platform/src/app/globals.css`, código de `app-shell`, `language-selector`, `theme-selector`, `layout` y los `DocumentView`; ratios WCAG recalculados con script efímero okLCH→sRGB fuera del repo. Sin navegador/capturas propias: las observaciones de captura del coordinador se verifican contra el DOM/clases servidos y los ratios calculados.
- Skills aplicadas: `impeccable` modo **Read** (SKILL.md:35, «Structure for comprehension»), `emil-design-eng` (Review Checklist l.658-674: propiedades exactas, hover con media query, accesibilidad) y `design-taste-frontend` (§4.7 nav en una línea l.247-248; §6.C dark mode l.531-535; §9.B jerarquía por peso+color l.606-609; §4.11 theme lock l.341-347).
- Guard AC-0.10 14/14 y suite completa **547 passed / 1 skipped / 0 fallos**.

### 1. Selectores de idioma y tema (compactos, accesibles, una línea)

- **Idioma** (`language-selector.tsx:33-72`): un único selector global en el shell; dos opciones `ES`/`EN` (`text-xs`, `px-1.5 py-0.5`), con `aria-label` («Español»/«English»), `lang`/`hrefLang`, `aria-current="true"` en el activo y navegación por teclado (anclas); el `href` pasa por `/preferences/language/<lang>` preservando la ruta y la query sin `?lang`. No queda ningún selector por documento/página (única referencia en `app-shell.tsx:113`).
- **Tema** (`theme-selector.tsx:74-103`): botón de 28×28 px (`size-7`) con icono SVG `aria-hidden` y `aria-label`/`title` que anuncian estado y acción («Tema actual: Oscuro. Cambiar a Sistema»); ciclo claro→oscuro→sistema (`theme/index.ts:32-35`); `data-theme` para estado. Foco visible por la regla global `a:focus-visible` (`globals.css:207-212`).
- **Compactos y en una línea**: ambos controles juntos ocupan ≈90-100 px; el selector de tema no tiene texto visible. La fila de controles ES|EN+tema está en una línea a 375 px; el problema es la fila de navegación (QA-D3).

### 2. Contraste WCAG recalculado con tema forzado (claro y oscuro)

Se verificó que el tema se aplica en el servidor: `Cookie: theme=dark` → `<html lang="es" class="antialiased dark">`; `theme=light` → `class="… light"`; `theme=system` o sin cookie → sin clase y manda `@media (prefers-color-scheme: dark)`. Tokens OKLCH de `globals.css:65-174` convertidos a sRGB:

| Uso real | Claro | AA texto | Oscuro | AA texto |
| --- | --- | --- | --- | --- |
| Texto principal | **19,79** | ✅ | **18,96** | ✅ |
| Muted (footer/procedencia) | **4,73** | ✅ | **7,63** | ✅ |
| Muted sobre `bg-muted/30` (procedencia) | **4,61** | ✅ | **7,20** | ✅ |
| Muted sobre `bg-muted/40` | **4,57** | ✅ | **7,03** | ✅ |
| Nav actual (`secondary-foreground`/`secondary`) | **16,42** | ✅ | **14,48** | ✅ |
| Idioma activo (texto) | **16,42** | ✅ | **14,48** | ✅ |
| Idioma inactivo (texto) | **4,73** | ✅ | **7,63** | ✅ |
| Roto (`destructive`) | **4,91** | ✅ | **6,89** | ✅ |
| Foco (`ring`) | **4,73** | ✅ (no-texto ≥3) | **4,18** | ✅ |
| Subrayado de enlaces (`muted-foreground`) | **4,73** | ✅ (no-texto ≥3) | **7,63** | ✅ |
| **Indicador activo ES\|EN (fondo `secondary` vs página)** | **1,09** | ❌ | **1,31** | ❌ |
| Borde de fila/control (`border`) | 1,26 | (no identifica por sí solo) | 1,25 | (ídem) |

- Todos los pares de **texto** pasan AA en ambos temas; el único incumplimiento es el indicador de estado del idioma activo (QA-D1).
- El icono del tema (muted-foreground) pasa de sobra; la pista de aviso `sr-only` no depende del color.

#### QA-D1 — MAJOR — El estado activo del selector ES|EN apenas se distingue (fondo 1,09:1 claro / 1,31:1 oscuro)

- **Dónde**: `platform/src/components/language-selector.tsx:58-63` — el activo usa `bg-secondary text-secondary-foreground`; el `ul` contenedor tiene `border border-border` (`:47`).
- **Evidencia**: en `/projects` con `Cookie: lang=en` el HTML servido del activo es `class="… bg-secondary text-secondary-foreground"`; el fondo activo es `#f5f5f5` sobre `#ffffff` en claro (1,09:1) y `#262626` sobre `#0a0a0a` en oscuro (1,31:1), por debajo del **3:1 de WCAG 1.4.11** (non-text contrast de estados). En oscuro, el texto activo `#fafafa` vs el inactivo `#a1a1a1` solo dista 2,45:1, así que la única señal clara sería un fondo casi invisible. Confirmado en la captura del coordinador a 1280 px.
- **Impacto**: el usuario no puede identificar de un vistazo qué idioma está activo, precisamente en el control nuevo de ADR-019; afecta a ambos temas (el claro aún más). `aria-current` lo cubre para lectores de pantalla, no visualmente.
- **Corrección sugerida** (una clase, en `:59-62`): activo `bg-foreground text-background` (≈19,79:1 claro / 18,96:1 oscuro) o, si se quiere conservar el pill sutil, añadir una señal no cromática y de contraste: `ring-1 ring-ring` (4,73:1 / 4,18:1) + `font-semibold`/`underline`. Aplicar el mismo criterio al estado actual de `NavLink` (`nav-link.tsx:21-23`) y de `DocumentNav` (`document-nav.tsx:58-60`), que hoy solo añaden `font-medium` sobre el mismo `bg-secondary`.

### 3. Sin parpadeo SSR

- El tema se decide en servidor (`layout.tsx:21-28`: `getUiTheme()` → clase en `<html>`); no hay script inline que cambie la clase tras el paint ni `matchMedia`/`localStorage` en el árbol (único uso de DOM: `error.tsx:44` lee `lang`); la respuesta inicial ya trae `class="dark"`/`"light"` o ninguna para `system`. Sin flash.

### 4. Textos de interfaz coherentes en inglés

- Revisadas 11 páginas con `Cookie: lang=en` (índices, detalles, 404): shell (`Projects/Contexts/Lessons`, `Skip to content`, `Search/Tutor/Progress`, footer), procedencia (`Content provenance`, `View on GitHub (mirror)`, `Imported on…`), estados (`Content not synced yet`), 404 (`Page not found`, `Back to Projects`) y contexto/lección están en inglés. `Tutor` es la palabra inglesa del ítem deshabilitado, no una fuga.
- **Hallazgo**: QA-D2 (los hints `sr-only` de enlaces de documentos de proyecto siguen en español).

#### QA-D2 — MINOR — En modo EN, los avisos de enlace externo/roto de los documentos de proyecto salen en español

- **Dónde**: `platform/src/components/catalog/projects-document.tsx:83` y `platform/src/components/catalog/projects-index.tsx:101-105` llaman a `SourceMarkdown` **sin `lang`**, así que usa el valor por defecto `"es"` (`source-markdown.tsx:369-374` y copys en `:28-39`). Sí lo pasan `lessons-detail.tsx:84` y `contexts-detail.tsx:192`.
- **Evidencia literal** (`/projects` con `lang=en`, idéntico en `/projects/ai-eng-cybersecurity-practices` y `/projects/n8n-snackcheck-nutrition`):
  ```html
  <code class="…">10-realtime/agent-observability</code><span class="sr-only"> (se abre en una pestaña nueva)</span>
  ```
  El test `source-markdown.test.tsx` cubre el copy EN (`opens in a new tab`, `broken link`), pero los dos call sites no pasan el idioma.
- **Impacto**: para lectores de pantalla, la superficie principal de lectura en inglés anuncia «(se abre en una pestaña nueva)» en español; afecta también a la pista de enlace roto si apareciera en un README de proyecto. Incoherente con ADR-019 («incluidos los copys neutros de interfaz»).
- **Corrección sugerida**: añadir `lang={lang}` en ambos call sites (una prop; el componente ya está preparado).

### 5. Responsive 375 px: fila de navegación recortada

- Medición estructural sobre el HTML de `app-shell.tsx:77-115`: fila 2 = `div.flex.min-w-0.items-center.gap-2` (ancho útil 375−32 = **343 px**) con `nav.min-w-0.flex-1.overflow-x-auto` + `LanguageSelector.shrink-0` (≈62 px) + `ThemeSelector.shrink-0` (28 px) + gaps (16 px). El contenido de la nav a 375 px (`Proyectos`+`Contextos`+`Lecciones` con `px-2.5 text-sm`, sin los «próximo hito» que están `hidden sm:block`) ronda **260 px**: 260+62+28+16 ≈ **366 px > 343 px**, por lo que la nav se comprime y el último ítem aparece recortado («Leccion…») sin indicación de scroll. Coincide con la captura del coordinador.

#### QA-D3 — MINOR — A 375 px, los selectores dejan la nav recortada en la misma fila

- **Dónde**: `platform/src/components/app-shell.tsx:77` (contenedor `flex-col … sm:flex-row`), `:84-88` (`div` con nav `flex-1` + controles `shrink-0`).
- **Impacto**: en móvil, la navegación principal pierde el último ítem visible (aunque es desplazable con `overflow-x-auto`); el patrón de `design-taste-frontend` §4.7 pide colapso móvil explícito y una sola línea legible.
- **Corrección sugerida** (como propuso el coordinador): en móvil subir `LanguageSelector`+`ThemeSelector` a la fila del título (a la derecha) y dar a la nav el ancho completo en una segunda línea; p. ej. en `:77` `flex flex-wrap items-center gap-x-4 gap-y-1`, marca con `mr-auto`, controles tras la marca y nav `order-last w-full sm:order-none sm:w-auto sm:flex-1`. A 375 px la fila superior (marca ≈210 px + controles ≈100 px) cabe en 343 px y la nav completa (~260 px) cabe en la suya.

### 6. Residual R-1 y otros restos

- **R-1 (subrayado `decoration-border` 1,26:1): RESUELTO.** `grep -rn "decoration-border" platform/src` sin tests → **0 ocurrencias**; los antiguos call sites (`contexts-detail.tsx:139`, `not-found.tsx:29`, `error.tsx:35`) usan ya `decoration-muted-foreground` (4,73:1 claro / 7,63:1 oscuro).
- **R-2 (NIT)**: `tw-animate-css` sigue en `platform/package.json:36` y el lockfile sin ningún uso (`globals.css` ya no lo importa) → dependencia muerta (candidata a BACKLOG).
- **R-3 (NIT)**: `contexts-detail.tsx:139` conserva `break-all` en los enlaces de assets del aside (los paths largos de `rfp-requests/...pdf` siguen partiéndose por carácter, a diferencia del resto que usa `[overflow-wrap:anywhere]`).
- QA-F2 del informe de fidelidad (PDFs inline sin `sandbox`) es la única observación de seguridad y es NIT documentado.

### 7. Verificación de las observaciones del coordinador (capturas reales)

| # | Observación | ¿Confirmada? | Hallazgo | Corrección |
| --- | --- | --- | --- | --- |
| 1 | 375 px, `/projects`, `lang=es theme=light`: la nav muestra «Proyectos Contextos Leccion…» recortada por ES\|EN y tema en la misma fila. | Sí: fila 2 = nav `flex-1` + controles `shrink-0` (343 px útiles vs ≈366 px de contenido). | QA-D3 / MINOR | Subir controles a la fila del título y nav a ancho completo en móvil (`app-shell.tsx:77-115`). |
| 2 | 1280 px dark: el idioma activo (EN) apenas se distingue del inactivo. | Sí: fondo activo 1,31:1 (oscuro) y 1,09:1 (claro) vs página; texto activo/inactivo 2,45:1 en oscuro. | QA-D1 / MAJOR | Activo `bg-foreground text-background` o `ring-1 ring-ring` + peso/subrayado. |
| 3 | En escritorio claro/oscuro, ¿otros problemas? | No: un solo H1 por detalle, nav en una línea, foco y aria correctos, contraste de texto AA en ambos temas, SSR sin flash, R-1 resuelto. | QA-D2 (solo EN, sr-only) | Pasar `lang` a `SourceMarkdown` en los dos call sites de proyecto. |

### 8. Veredicto de la QA final de diseño

- **NO LISTO PARA CERRAR** hasta corregir o aceptar explícitamente: **1 MAJOR (QA-D1, contraste del estado activo ES|EN en ambos temas)** y **2 MINOR (QA-D2, avisos sr-only en español en modo EN; QA-D3, nav recortada a 375 px)**. 0 BLOCKER.
- Todo lo demás del alcance queda verde: selectores únicos, compactos, con aria/lang/hrefLang/aria-current, foco y teclado; tema forzado por cookie con clase SSR (sin parpadeo) y tokens AA salvo el indicador activo; copys de interfaz en inglés salvo QA-D2; R-1 resuelto; R-2/R-3/QA-F2 como NITs de una línea.
- Las tres correcciones son locales y de bajo riesgo (`language-selector.tsx`, `app-shell.tsx`, `projects-document.tsx`/`projects-index.tsx`); con ellas el hito puede cerrarse.

### Apéndice — Evidencia reproducible de la QA final de diseño

- `curl -s -H "Cookie: lang=es|en" -H "Cookie: theme=light|dark|system"` sobre 19 páginas (`/projects`, `/contexts`, `/contexts/01-web-fundamentals`, `/contexts/06-telemetry-data-pipelines`, `/lessons`, `/lessons/4geeks-student-extension`, `/projects/[slug]`, `/projects/4-devs[/subslug]`, 404) y comprobación de `<html class>`/`<html lang>` en cada tema/idioma.
- Contraste: script efímero okLCH→sRGB + WCAG 2.x en `/tmp` (composición alfa incluida); tabla §2.
- `grep` de `decoration-border`, `tw-animate-css`, `break-all`, `dangerouslySetInnerHTML`/`innerHTML`/`eval(` y `documentElement|matchMedia|localStorage` sobre `platform/src`.
- Tests: guard 14/14; suite completa 547 passed / 1 skipped.
- Restricciones: READ-ONLY, sin `install`, sin escrituras en base, `DATABASE_URL` nunca impresa, dev server del coordinador intacto; HTML y scripts fuera del repo.
