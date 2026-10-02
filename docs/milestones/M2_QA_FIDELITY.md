# M2 — QA independiente de fidelidad, alcance y seguridad (AC-2.13)

- Hito: **Hito 2 — Navegador del syllabus real** (rama `m2-syllabus-ui`).
- Tarea: `[M2-QA-F]` — QA READ-ONLY. No se ha modificado código, esquema, fixtures ni documentación; el único artefacto escrito es este informe.
- Fecha: 2026-10-02.
- Repo fuente auditado: `4GeeksAcademy/ai-engineering-syllabus`, commit pinneado `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- Snapshot activo consultado (solo lectura): `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, `ref = main`, `status = complete`, `imported_at = 2026-10-02T12:13:49.515Z`, 0 errores; 899 archivos, 84 proyectos, 22 contextos, 5 lecciones.
- Servidor de desarrollo auditado: `http://localhost:3100` (gestionado por el coordinador; no se arrancó ni paró ningún proceso). 25 URLs + 7 documentos de contexto adicionales verificados por HTTP.
- Documentos leídos completos: `docs/milestones/M2_REAL_SYLLABUS_UI.md`, `docs/milestones/M2_AUDIT_PLAN.md` (incl. "Decisiones del usuario"), `DECISIONS.md` (ADR-013..017), `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `ORCA.md`, `BACKLOG.md`, `STATUS.md`, `MILESTONES.md`, `platform/AGENTS.md`, `docs/milestones/M1_QA_TECHNICAL.md`, `docs/milestones/M1_QA_FIDELITY.md`; además el código de `platform/src/course/**`, `platform/src/lib/markdown/**`, `platform/src/components/**`, `platform/src/app/**` y `platform/src/test/**`.
- Restricciones respetadas: la base se consultó con `SELECT` dentro de `BEGIN READ ONLY` (`SET LOCAL statement_timeout`); `DATABASE_URL` se cargó desde `platform/.env.local` sin imprimirla, copiarla ni registrarla; los scripts efímeros vivieron fuera del repo (en el directorio temporal de la sesión) y las salidas no contienen la URL ni la contraseña. No se ejecutó `install`; sí `vitest` (solo lectura, PGlite en memoria) y `git hash-object`.
- Baseline git al empezar: rama `m2-syllabus-ui` con cambios de H2 sin commitear (el coordinador commitea); este informe es el único archivo que añade la QA.

Convención de severidad (M1): **BLOCKER** = debe corregirse antes de cerrar el hito; **MAJOR** = debe corregirse o aceptarse explícitamente antes del cierre; **MINOR** = corregir o registrar; **NIT** = mejora opcional/BACKLOG.

## Resumen ejecutivo

| Severidad | Nº  | IDs                    |
| --------- | --- | ---------------------- |
| BLOCKER   | 0   | —                      |
| MAJOR     | 2   | F-01, F-02             |
| MINOR     | 3   | F-03, F-04, F-05       |
| NIT       | 2   | F-06, F-07             |
| **Total** | 7   |                        |

Veredicto por apartado:

1. **AC-2.13 (fidelidad del texto educativo): verde con 2 salvedades.** 84/84, 22/22 y 5/5 unidades renderizadas; 0 títulos, descripciones, secciones o textos de documento inventados; 1436 nodos de texto de 19 vistas de detalle comprobados como subcadena literal (normalizando Markdown/espacios) del `raw_content` mostrado; `learn.json` no se parsea ni se muestra; guard AC-0.10 en verde. Salvedades: **F-02** (numeración 71–80 mostrada en entradas que el README no numera, incluidas las que declara "no forman parte de la secuencia") y **F-05** (el título de `4-devs` muestra backticks literales de Markdown).
2. **Fidelidad de enlaces/assets: verde con 2 salvedades.** Los enlaces relativos resueltos van a vista interna o a GitHub `blob`/`tree`/`raw` **pinneado al commit**; los 8 enlaces rotos alcanzables de `06-telemetry-data-pipelines` se muestran como rotos sin `href` ni destino inventado; imágenes vía `binary_reference` pinneada con `loading`/`decoding`/`referrerPolicy`; los 4 contextos sin preferido no reciben "principal" inventado; los subproyectos se derivan en lectura sin escribir en base (0 filas anidadas en `source_projects`); el orden de `/projects` es exactamente el del README. Salvedades: **F-01** (46 de 107 documentos alcanzables contienen enlaces absolutos del propio repo a `main`, que se dejan intactos: 59 ocurrencias) y **F-04** (los enlaces generados por el resolvedor a GitHub@commit no abren en pestaña nueva ni llevan `rel`).
3. **Seguridad: sin hallazgos.** Sin XSS en el pipeline real (13 vectores de ataque neutralizados en test efímero fuera del repo); sin `dangerouslySetInnerHTML`; `DATABASE_URL`/credenciales no aparecen en el HTML servido ni en `.next/static` (0 credenciales en 52 archivos); `server-only` presente; sin `NEXT_PUBLIC_*`; enlaces externos con `target="_blank" rel="noopener noreferrer"` (salvo F-04); `?doc`/`?lang`/slug no permiten traversal (9 vectores → 404); errores redactados con `describeError`. F-07 es un artefacto solo-dev de Next.
4. **Alcance: sin hallazgos.** No hay H3+ (progreso, notas, repos personales, búsqueda, tutor): solo rutas `projects`/`contexts`/`lessons`, 0 route handlers, 0 tablas/código de usuario o IA; los enlaces del shell a "Buscar/Tutor/Progreso" siguen deshabilitados. ADR-013..017 coherentes con el código salvo la consecuencia literal de ADR-015 ("ninguna URL apunta a `main`") por F-01.

**AC en rojo: ninguno.** AC-2.2 y AC-2.13 quedan en ámbar por F-02; AC-2.9 por F-01; el resto (AC-2.1, 2.3–2.8, 2.10–2.12) verdes con la evidencia de este informe.

---

## 1. AC-2.13 — fidelidad del texto educativo

Método: consulta real del snapshot activo (`source_projects`/`contexts`/`lessons`/`files`) y volcado de los 781 `raw_content` a un directorio temporal fuera del repo; parseo del HTML servido con `jsdom`; normalización de ambos lados (decodificación de entidades, eliminación de sintaxis Markdown inline, colapso de espacios) y comprobación de subcadena.

### 1.1 Listas

| Vista       | Filas del snapshot | Ítems renderizados | Títulos literales                                                         | Descripciones/orden                                                           |
| ----------- | ------------------ | ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/projects` | 84                 | **84**             | 84/84 = etiqueta literal del README (ES o EN), H1 del preferido o slug    | 84/84 descripciones subcadena del README; orden == README.md + 5 no listados  |
| `/contexts` | 22                 | **22**             | 22/22 = primer H1 del preferido o slug (4 sin preferido muestran el slug) | orden `source_path` exacto; sin descripciones                                 |
| `/lessons`  | 5                  | **5**              | 5/5 = primer H1 del preferido (frontmatter ignorado)                      | orden `source_path` exacto; sin descripciones                                 |

Evidencia de `/projects`:

- Secuencia de posiciones renderizadas: `0,1,…,70,71,74,75,76,77,78,79,80` + 5 ítems sin número; la secuencia de slugs coincide 1:1 con las **79 unidades de primer nivel** que aparecen en los 81 enlaces `./` de `content/projects/README.md` (71 numerados + `./4-devs` + 7 de "Other projects" + 2 anidados que no son filas) y los 5 no listados al final por `source_path` (`ai-eng-cybersecurity-practices`, `ai-eng-cybersecurity-vulnerabilities`, `ai-eng-evaluating-regression-model`, `ai-eng-sales-forecasting-timeseries`, `vps-ssh-resource-optimization`).
- Encabezados de sección mostrados: `null`, `Proyectos (orden sugerido)`, `Curso For Devs`, `Otros proyectos` y el copy neutro de interfaz `Sin posición en el índice del repositorio`; los cuatro primeros son encabezados `##` literales de los README.
- Títulos como `¿Es Saludable Este Snack? — Una Automatización que Verifica Nutrición` (etiqueta literal del enlace en `README.es.md:14`) y descripciones como la de `openclaw-skills` son subcadenas literales del `raw_content` de `content/projects/README.es.md`.
- Contextos sin preferido (`06-telemetry-data-pipelines`, `08-agent-engineering`, `10-realtime`, `sales-forecasting`): el título es el slug del path real, no un H1 de otro documento ni un "principal" inferido (verificado en las 4 vistas: `h1` = slug, sin cabecera de procedencia, con el aviso de selección).

### 1.2 Vistas de detalle (25 URLs, 19 con cuerpo de documento)

URLs analizadas con comprobación de título, procedencia, cuerpo, enlaces e imágenes: `/projects/n8n-snackcheck-nutrition` (±`?lang=en`), `/projects/4-devs` (±`?lang=en`), `/projects/4-devs/ai-eng-incident-manager-for-devs`, `/projects/html-css-artist-landing-seo-access`, `/contexts/00-general-contexts`, `/contexts/01-web-fundamentals` (±`?doc=CONTEXT-brasaland.en.md`), `/contexts/4-devs` y `?doc=incident-manager-for-devs/CONTEXT-brasaland.es.md`, `/contexts/06-telemetry-data-pipelines` (sin preferido) y `?doc=data-pipelines/CONTEXT-brasaland.{es.,}md`, `/contexts/08-agent-engineering?doc=…`, `/contexts/10-realtime?doc=…`, `/contexts/sales-forecasting?doc=…`, `/lessons/4geeks-student-extension` (±`?lang=en`).

Resultado:

- **1436 nodos de texto** de los cuerpos renderizados (≥20 caracteres) comprobados: **0 no literales**. Todo texto visible es subcadena del `raw_content` del documento mostrado (normalizando Markdown/espacios), salvo los copys neutros de interfaz (`(se abre en una pestaña nueva)`, etc.).
- **Procedencia (AC-2.11)**: en cada vista de detalle, `Fuente`, `Documento`, `Commit completo`, `Blob completo` y `Snapshot` coinciden exactamente con las filas del snapshot activo; el enlace "Ver en GitHub" va a `…/blob/<commit completo>/<path>` (nunca a `main`) con `target="_blank" rel="noopener noreferrer"`. Ejemplo real: `content/lessons/4geeks-student-extension/4geeks-student-extension.es.md`, blob `41313f085f5f4a7bba5bb2e5803151bdf8137fe4`.
- **Selector de idioma (AC-2.12)**: aparece solo con ≥2 variantes reales del documento mostrado y la inicial es la preferida (ES cuando existe). Verificado con hrefs reales: en `/lessons/4geeks-student-extension` el enlace English es `/lessons/4geeks-student-extension?lang=en` (actual = Español); en `/contexts/01-web-fundamentals?doc=CONTEXT-brasaland.en.md` el enlace Español es `/contexts/01-web-fundamentals` (actual = English). En el corpus de contextos los 244 markdown tienen al menos una variante, por lo que el caso "sin selector" solo es observable en tests de componente (cubierto en `language.test.ts`/`language-selector.test.tsx`).

### 1.3 `learn.json` no mostrado

- El código **no parsea ni lee** el contenido de `learn.json`: `platform/src/course/reader.ts:497` solo comprueba su existencia (`context.files.has(...)`) para derivar subproyectos; no hay `JSON.parse` de `learn.json` en `platform/src/course/**` ni en la UI.
- Prueba negativa: de los 85 `learn.json` de unidad (83 raíces + los 2 anidados de `4-devs`; el 86.º es `content/projects/learn.json`, índice del catálogo) se extrajeron 878 cadenas exclusivas (≥25 caracteres, que no aparecen en ningún markdown del snapshot); **ninguna aparece en el texto visible de las 33 páginas HTML analizadas**. No se muestran `difficulty`, `duration`, `technologies`, `preview` ni `title/description` de `learn.json` (decisión del usuario, `M2_AUDIT_PLAN.md:582`).

### 1.4 Código y guard AC-0.10

- Barrido de `platform/src/**` en busca de textos que describan contenido educativo, orden alternativo o fallbacks que "rellenen": los únicos literales de contenido son los copys neutros de interfaz (`Proyectos`, `Contextos`, `Lecciones`, `Idioma`, `Volver…`, `Sin posición en el índice del repositorio`, estados vacíos/error) y los **paths/constantes de la fuente** (`content/projects/README.md`, `README.es.md`, `learn.json`), permitidos por el contrato.
- `npx --yes pnpm@12.8.1 --dir platform vitest run src/test/no-hardcoded-catalog.test.ts` → **14/14 tests en verde**.
- Suite completa: `vitest run` → **42 archivos pasan, 354 tests pasan, 1 skipped**, 0 fallos.
- Fixtures ADR-009: los **18/18** fixtures del manifiesto coinciden a la vez con `git hash-object` local, el `blob_sha` del manifiesto y el `blob_sha` del snapshot activo (incluido el nuevo `content/projects/README.md`, `972ec8eb…`, y `content/projects/README.es.md`, `a2dfc4b7…`).

### Hallazgos del apartado

#### F-02 — MAJOR — Numeración mostrada en entradas que el README no numera (71–80), con hueco 72–73

- **Dónde**: `platform/src/course/order.ts:175-182` (asigna `position: entries.length` a **todo** enlace `./`, sea lista ordenada, bullet o párrafo) → `platform/src/components/catalog/projects-index.tsx:80` (`order: unit.order`) → `platform/src/components/unit-list.tsx:51-55` (pinta el número siempre que `order` es `number`).
- **Evidencia literal** (HTML de `/projects`):

  ```html
  <li>…<span class="…tabular-nums…">71</span>…<a href="/projects/4-devs" …>`./4-devs`</a>…</li>
  ```

  Secuencia completa renderizada: `0..70, 71, 74, 75, 76, 77, 78, 79, 80` (números `72` y `73` no existen en pantalla: los consumen las 2 entradas anidadas de `4-devs`, que no se listan como filas). Las posiciones `71` y `74..80` se muestran junto a entradas del README que **no llevan número**:

  - `content/projects/README.es.md:226` (párrafo "Track separado en [`./4-devs`](./4-devs)…").
  - `content/projects/README.es.md:234-238`: `## Otros proyectos` + "**No forman parte de la secuencia del temario.** Se mantienen aquí como referencia o uso opcional." (los 7 bullets `- **[Plataforma…](./ai-eng-roles-permissions)**` …). En inglés: `README.md:234-236` "Not part of the syllabus sequence.".
  - Los números `0..70` sí son literales del README (`0.` … `70.`); `71` y `74..80` no lo son.
- **Impacto**: la UI presenta como "secuencia numerada" ítems que la fuente declara fuera de la secuencia, y un hueco 72–73 sin explicación. Incumple AC-2.2 ("orden obtenido de `content/projects/README.md`") y AC-2.13 ("ninguna … orden … inventado o mostrado") en el badge numérico, aunque la **secuencia** de ítems sí es fiel.
- **Corrección sugerida**: registrar en `ProjectOrderEntry` si la línea del enlace es un ítem de lista ordenada (`/^\s*\d+[.)]\s/`) y renderizar el número solo entonces (o mostrar el número solo para posiciones `< 71` mientras el README mantenga su numeración). Alternativa mínima: no pintar número cuando la entrada no sea de lista ordenada; los anidados dejarían de consumir posiciones visibles.

#### F-05 — MINOR — El título del proyecto `4-devs` muestra backticks literales de Markdown

- **Dónde**: `platform/src/course/reader.ts:449-452` (usa la etiqueta literal del enlace) y `platform/src/components/unit-list.tsx:61` (la pinta como texto plano, sin pipeline Markdown).
- **Evidencia literal** (`/projects`): `<a href="/projects/4-devs" …>`./4-devs`</a>` y `<h1 …>`./4-devs`</h1>` en `/projects/4-devs`. El README fuente dice `[`./4-devs`](./4-devs)` (`README.es.md:226`), es decir, el código inline forma parte de la etiqueta.
- **Impacto**: no es contenido inventado (es literal), pero la interfaz muestra sintaxis Markdown cruda en un título, a diferencia de las descripciones, que sí pasan por `SourceMarkdown`. Afecta a 1 unidad.
- **Corrección sugerida**: renderizar las etiquetas con el mismo tratamiento Markdown que las descripciones, o normalizarlas (quitar backticks/énfasis) al construir el título; alternativa: usar el H1 del documento cuando la etiqueta contenga sintaxis inline.

---

## 2. Fidelidad de enlaces y assets

### 2.1 Enlaces relativos resueltos y pinneados

- Los enlaces relativos de los documentos mostrados se resuelven por la política ADR-015 (`platform/src/course/links.ts:79-143`): vista interna (`/projects/...`, `/contexts/...?doc=...`, `/lessons/...?lang=...`), GitHub `blob`/`tree` con el **commit completo del snapshot**, o `binary_reference` `raw` pinneada. Ejemplo verificado en `/contexts/4-devs`: los enlaces `./incident-manager-for-devs` y `./inventory-manager-for-devs` del README se renderizan como

  ```text
  https://github.com/4GeeksAcademy/ai-engineering-syllabus/tree/962c1e5fc8ebad273abaa348fb3d161568ce8707/content/contexts/4-devs/incident-manager-for-devs
  ```

- Las imágenes relativas usan la referencia pinneada: en `/projects/html-css-artist-landing-seo-access` el `<img>` de `./.learn/page-speed-example.png` se renderiza como `https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/962c1e5…/content/projects/html-css-artist-landing-seo-access/.learn/page-speed-example.png` con `alt` literal ("Ejemplo de resultado de PageSpeed Insights", `README.es.md:91`), `width="260"`, `loading="lazy"`, `decoding="async"` y `referrerPolicy="no-referrer"` (`platform/src/components/source-markdown.tsx:106-118`).
- Assets no imagen de contextos (PDF/CSV/JSON/HTML): enlaces de descarga a la `binary_reference` pinneada con `target="_blank" rel="noopener noreferrer"` (`platform/src/components/catalog/contexts-detail.tsx:78-96`). Verificado con los PDF de `/contexts/09-agentic-workflows` (p. ej. `…/rfp-requests/brasaland/CONTEXT-brasaland-request-1.pdf`).

### 2.2 Enlaces rotos: no se "arreglan"

- Los 8 documentos de `content/contexts/06-telemetry-data-pipelines/data-pipelines/` con enlaces rotos del Apéndice B se renderizan como `<span aria-disabled="true" title="Enlace roto en el origen: ./CONTEXT-…-pipeline.md">` conservando la etiqueta literal, **sin `href`** y sin destino inventado. Verificado en los 8 (1 span roto por documento):

  ```html
  <span aria-disabled="true" class="cursor-not-allowed text-destructive …" title="Enlace roto en el origen: ./CONTEXT-brasaland-pipeline.md">available in English</span>
  ```

- Los enlaces rotos a rutas de app (`/forgot-password`) y a `.learn/solution` no son alcanzables desde las vistas internas (viven en documentos `.learn` que se enlazan a GitHub), por lo que no se renderizan como páginas; su tratamiento sería el mismo (`resolveMarkdownHref` los marca `broken`).

### 2.3 Los 4 contextos sin preferido

- `06-telemetry-data-pipelines`, `08-agent-engineering`, `10-realtime` y `sales-forecasting`: la vista muestra **todos** los documentos reales (16 cada uno) con su ruta relativa literal, el aviso "Selecciona un documento de la lista para leerlo aquí." y **ninguna** cabecera de procedencia ni documento "principal" inventado. `?doc` válido renderiza el documento real con su procedencia.

### 2.4 Subproyectos y orden

- Los subproyectos de `4-devs` se derivan en lectura (carpeta hija directa con `learn.json`, `reader.ts:478-518`) y se muestran en el aside del padre y en ruta propia (`/projects/4-devs/ai-eng-incident-manager-for-devs`), con títulos literales del README. Consulta real: `SELECT count(*) FROM source_projects WHERE source_path LIKE '%/4-devs/%'` → **0 filas** (no se escribe en base, ADR-013).
- El orden de `/projects` es exactamente el del `README.md` (posiciones 0..70 + 4-devs + anidados + Other projects + 5 no listados), sin orden alternativo. La salvedad es F-02 (badges numéricos).

### Hallazgos del apartado

#### F-01 — MAJOR — Enlaces absolutos del propio repo a `main` se dejan intactos (46 de 107 documentos alcanzables)

- **Dónde**: `platform/src/course/links.ts:86-88` (cualquier `http(s)` se devuelve como `external` intacto) y `platform/src/components/source-markdown.tsx:61-74` (se pinta tal cual).
- **Evidencia**:
  - `content/lessons/4geeks-student-extension/4geeks-student-extension.es.md:12`: `[English](https://github.com/4GeeksAcademy/ai-engineering-syllabus/blob/main/content/lessons/4geeks-student-extension/4geeks-student-extension.md)`; renderizado en `/lessons/4geeks-student-extension` como `href="https://github.com/4GeeksAcademy/ai-engineering-syllabus/blob/main/…"`.
  - `content/projects/4-devs/ai-eng-incident-manager-for-devs/README.es.md:12`: `**[CONTEXT-company.md](https://github.com/4GeeksAcademy/ai-engineering-syllabus/tree/main/content/contexts/4-devs/incident-manager-for-devs)**`; renderizado en la vista del subproyecto con `href="…/tree/main/…"`.
  - Recuento real sobre el snapshot: **46 de 107** documentos alcanzables por defecto (84 README preferidos de proyecto + 18 contextos con preferido + 5 lecciones) contienen este patrón, con **59 ocurrencias**; en el corpus completo (incluidos `.learn/solution`) hay 109 archivos.
- **Impacto**: contradice el criterio de QA ("los de GitHub van pinneados al commit `962c1e5…`, nunca a `main`") y la consecuencia literal de ADR-015 (`DECISIONS.md:240-241`: "ninguna URL apunta a `main`, siempre al commit importado"). Es contenido de la fuente, así que no hay invención, pero la app puede llevar al usuario a una versión del documento distinta de la importada (incluido el enlace de par de idioma de las lecciones, que además evita el selector interno).
- **Corrección sugerida** (dos opciones):
  1. En `resolveMarkdownHref`, antes de la rama externa genérica, detectar URLs del propio repo (`^https://github\.com/<owner>/<name>/(blob|tree|raw)/(main|master)/<path>`) y: si el path existe en el snapshot y tiene vista interna → ruta interna; si existe sin vista → `blob`/`tree`/`raw` pinneado al commit; si no existe → roto. Es resolución de enlaces (permitida por `CONTENT_CONTRACT.md`), no reescritura de texto.
  2. Si se decide conservar la literalidad absoluta, **corregir ADR-015** para documentar la excepción y que la consecuencia no afirme algo falso; en cualquier caso conviene un test que recorra el corpus y cuente los enlaces same-repo a `main`.

#### F-04 — MINOR — Enlaces generados por el resolvedor a GitHub@commit sin `target`/`rel`

- **Dónde**: `platform/src/components/source-markdown.tsx:76-82` (rama `kind: "source"`): pinta `<a href title>` sin `target="_blank"` ni `rel="noopener noreferrer"`, a diferencia de los externos (`:61-74`).
- **Evidencia literal** (`/contexts/4-devs`):

  ```html
  <a href="https://github.com/4GeeksAcademy/ai-engineering-syllabus/tree/962c1e5…/content/contexts/4-devs/incident-manager-for-devs" class="font-medium underline …">
  ```

  (2 enlaces en esa página; 0 en el resto de páginas analizadas).
- **Impacto**: navegación fuera de la app sin pestaña nueva ni aviso accesible, e inconsistencia con la política §4.4 del plan de M2 ("Enlaces externos: `target="_blank"` + `rel="noopener noreferrer"`; aviso accesible"). Sin riesgo de tabnabbing al no abrir pestaña nueva.
- **Corrección sugerida**: aplicar a `kind: "source"` el mismo tratamiento que a `kind: "external"` (target/rel/aviso), o documentar explícitamente que los enlaces de procedencia abren en la misma pestaña.

---

## 3. Seguridad

### 3.1 XSS

- Allowlist revisada: `platform/src/lib/markdown/sanitize-schema.ts:10-57` (tags permitidos sin `script`/`style`/`iframe`/`object`/`embed`; atributos `a[href|title]`, `img[src|alt|title|width|height]`, `input[type=checkbox]…`; protocolos `href: [http, https, mailto]`, `src: [http, https]`). Pipeline en orden seguro: `remarkGfm`+`remarkFrontmatter` y `rehypeRaw`+`rehypeSanitize` (`source-markdown.tsx:266-268`).
- **Test efímero fuera del repo** con el pipeline real (`react-markdown` + los mismos plugins + el esquema real, renderizado con `react-dom/server`): 13/13 vectores neutralizados — `<script>` (eliminado), `<img onerror>` (sin `onerror`), `[x](javascript:)` (sin href), `![x](data:…)` (sin src), `<iframe>` (eliminado), `<style>` (etiqueta eliminada; su texto queda visible e inerte), `<a href="javascript:">`, `<div onclick>`, `<svg onload>` (eliminado), `<form>` (eliminado; el `input` interno queda como checkbox deshabilitado por el componente), `<details ontoggle>`, `<meta http-equiv=refresh>` (eliminado), `<base>` (eliminado). Controles positivos de fidelidad: `<details>`, tablas GFM, `img width`, task lists y `~~del~~` se conservan.
- Sin `dangerouslySetInnerHTML`, `innerHTML` ni `eval(` en `platform/src/**` (búsqueda: 0 resultados). El HTML embebido del corpus pasa siempre por `rehype-sanitize` antes de renderizarse; el texto de un tag prohibido se conserva como texto, nunca se ejecuta.

### 3.2 Secretos y frontera servidor/cliente

- `DATABASE_URL` se lee solo en servidor (`platform/src/course/database.ts:29-48`, `platform/src/source/**`); `server-only` presente en `course/index.ts:14`, `course/reader.ts:18` y `course/database.ts:12`. Los únicos componentes cliente (`error.tsx`, `nav-link.tsx`) no importan la capa `course/` (solo `course/routes.ts`, puro).
- Barrido de las 38 páginas HTML servidas (25 de análisis + 13 auxiliares) + 14 archivos de `.next/static` (52 archivos): **0 hits** de la URL literal de `DATABASE_URL`, de su contraseña, de su host, de `postgres://`, `supabase.co`, `service_role`, `GITHUB_TOKEN`, `PGPASSWORD` o cadenas tipo JWT (`eyJ…`); el único hit del patrón genérico `password=` es el parser de URL de `whatwg-url` en el bundle (propiedad `password`), sin valor de credencial. El bundle cliente no contiene `drizzle-orm`, `pg` ni el pool del curso.
- Sin variables `NEXT_PUBLIC_*` en código ni en `.env.example` (la única mención es un comentario de la plantilla). `platform/.env.local` sigue ignorado por git (`platform/.gitignore:27: .env*`).
- Enlaces externos con `target="_blank" rel="noopener noreferrer"` en Markdown (`source-markdown.tsx:61-74`), procedencia (`provenance-header.tsx:59-67`) y assets (`contexts-detail.tsx:80-84`). La excepción son los enlaces `source` (F-04).

### 3.3 Path traversal y validación de parámetros

| Petición                                                                | Resultado      |
| ----------------------------------------------------------------------- | -------------- |
| `/projects/does-not-exist`, `/contexts/does-not-exist`, `/lessons/does-not-exist` | 404            |
| `/projects/%2e%2e%2f%2e%2e%2fetc%2fpasswd`, `/projects/..%5C..%5Cetc`  | 404            |
| `/projects/n8n-snackcheck-nutrition%2f..%2f..%2fREADME.es.md`           | 404            |
| `?doc=../../../etc/passwd`, `?doc=/etc/passwd`, `?doc=..%2F..%2Fcontent%2F…` | 404        |
| `?doc=%00`, `?doc=..%5C..%5Cetc%5Cpasswd`, `?doc=CON..%2F…`             | 404            |
| `?doc=` (vacío)                                                         | 404            |
| `?doc=<válido>&doc=../../../etc/passwd` (array)                         | 200 con el primer valor válido; el segundo se ignora |

- `?doc` se valida contra la lista exacta de documentos markdown del contexto (`contexts/[slug]/page.tsx:59-70`), por lo que no puede salir de la unidad; `slug` se compara con `source_path` exactos (`reader.ts:641-647`, `:717-723`, `:741-747`). Sin `generateStaticParams` ni route handlers (`find src/app -name route.ts` → vacío).

### 3.4 Errores

- Los errores de base pasan por `guarded()` + `describeError` (`course/index.ts:75-81`), que redacta `DATABASE_URL`/`GITHUB_TOKEN` y contraseñas de URI (`lib/redact.ts`). `error.tsx` muestra solo copy neutro y botón "Reintentar"; `not-found.tsx` solo copy neutro. Los 404 servidos no contienen la URL ni credenciales.
- **F-07 (NIT, solo-dev)**: en modo desarrollo, Next 16 incrusta el stack del `NEXT_HTTP_ERROR_FALLBACK;404` en un atributo `data-next-error-stack` del HTML (rutas absolutas del filesystem y `node_modules`; **sin secretos**). Es comportamiento del framework en dev; conviene confirmar que el `next build`/`next start` de producción no lo emite (QA técnica).

---

## 4. Alcance y coherencia documental

### 4.1 Nada de H3+

- Rutas existentes: `/` (redirect a `/projects`), `/projects`, `/projects/[slug]`, `/projects/[slug]/[subslug]`, `/contexts`, `/contexts/[slug]`, `/lessons`, `/lessons/[slug]`, `not-found` y `error`. Sin `/api`, sin route handlers, sin `search`, sin `tutor`, sin `progress`.
- El shell mantiene "Buscar/Tutor/Progreso" como `<span aria-disabled="true" title="Próximo hito">` (`app-shell.tsx:39-50`); no hay progreso, notas, bookmarks, repos personales, relaciones, búsqueda ni IA implementados (búsqueda de `progress|user_note|bookmark|search|tutor|embedding|pgvector|tsvector|ai_thread` en componentes: solo `searchParams`).
- Sin tablas nuevas ni escrituras: `course/**` no contiene `insert/update/delete` fuera de tests; la base sigue con 7 tablas y el snapshot intacto (mismos conteos que M1: 899/84/22/5, 0 errores).

### 4.2 ADR-013..017 vs implementación

| ADR     | Resultado                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ADR-013 | **Fiel**: capa `course/` server-only, snapshot activo por `status`+`imported_at`, derivaciones en lectura sin persistir, subproyectos en lectura (0 filas), `learn.json` no parseado. |
| ADR-014 | **Fiel**: pipeline y allowlist exactos; sin `dangerouslySetInnerHTML`; frontmatter oculto (las 10 lecciones renderizan sin `---`/`title:` visible).                        |
| ADR-015 | **Fiel salvo la consecuencia** "ninguna URL apunta a `main`": los enlaces relativos se pinnean, pero los absolutos same-repo a `main` de la fuente se dejan intactos (**F-01**). |
| ADR-016 | **Fiel**: `binary_reference` pinneada, `<img>` con lazy/decoding/referrerPolicy, sin `next/image` ni proxy.                                                              |
| ADR-017 | **Fiel** en precedencia de títulos y orden por README/`source_path`; salvedades de presentación F-02/F-05.                                                               |

Observación documental: `STATUS.md` sigue marcando "Hito 1" como activo y "pendiente de revisión"; el cierre del H2 (checklist de `M2_REAL_SYLLABUS_UI.md`, `STATUS.md`, ADR-015) corresponde al coordinador.

### 4.3 Candidatos a BACKLOG detectados

- Proxy propio de assets `/api/source-asset/[...path]` y visores de PDF/CSV (ADR-016 ya lo apunta a H4).
- Resaltado de sintaxis y tabla de contenidos (ADR-014 los excluye de H2).
- Pinnear/reescribir enlaces absolutos same-repo (F-01) y aplicar `rel` a enlaces `source` (F-04).
- `lang` del documento dinámico en `<html>` (F-03) y unificar el tratamiento de `?lang` inválido (F-06).
- Guard AC-0.10: cubrir etiquetas Markdown en títulos o normalizarlas (F-05).
- Confirmar en CI que el build de producción no emite `data-next-error-stack` (F-07).

---

## 5. Hallazgos priorizados

| ID   | Sev.  | Título                                                                 | Ubicación principal                                              | Corrección sugerida                                                                    |
| ---- | ----- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| F-01 | MAJOR | 59 enlaces absolutos same-repo a `main` en 46 documentos alcanzables   | `course/links.ts:86-88`, `components/source-markdown.tsx:61-74`  | Detectar URLs del propio repo y resolverlas a vista interna o commit; o corregir ADR-015 |
| F-02 | MAJOR | Badges 71–80 (hueco 72–73) en entradas sin número del README           | `course/order.ts:175-182`, `components/unit-list.tsx:51-55`      | Numerar solo ítems de lista ordenada del README                                        |
| F-03 | MINOR | `<html lang="es">` fijo también con documentos en inglés               | `app/layout.tsx:13`                                              | `lang` dinámico del documento mostrado (o `lang` en el contenedor)                     |
| F-04 | MINOR | Enlaces `source` (GitHub@commit) sin `target`/`rel`/aviso              | `components/source-markdown.tsx:76-82`                           | Mismo tratamiento que externos o documentar la excepción                               |
| F-05 | MINOR | Título de `4-devs` muestra backticks literales                         | `course/reader.ts:449-452`, `components/unit-list.tsx:61`        | Normalizar/renderizar la etiqueta Markdown del README                                  |
| F-06 | NIT   | `?lang` inválido: 404 en lecciones, ignorado en proyectos/contextos    | `app/lessons/[slug]/page.tsx:48-54`, `app/projects/[slug]/page.tsx:65-72` | Unificar comportamiento y documentarlo                                        |
| F-07 | NIT   | Stack de error 404 en atributo del HTML en dev (sin secretos)          | Next 16 dev; `app/not-found.tsx`                                 | Verificar build de producción en CI                                                    |

---

## Apéndice A — Evidencia reproducible (sin secretos)

- Snapshot y conteos: consulta `SELECT` en `BEGIN READ ONLY` (script efímero fuera del repo, borrado al terminar) → 899 archivos (781 texto / 118 binario), 84 proyectos, 22 contextos, 5 lecciones, 0 errores, commit `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- Páginas HTTP: 25 URLs + 7 documentos de contexto de `06` + 3 contextos sin preferido; HTML guardado en el directorio temporal y parseado con `jsdom`; 84/22/5 filas y 1436 nodos de texto verificados.
- Enlaces: recuento de `https://github.com/4GeeksAcademy/ai-engineering-syllabus/(blob|tree|raw)/main/` sobre los `raw_content` del snapshot (46/107 documentos por defecto; 109 archivos en total) y verificación de los enlaces generados con el commit completo.
- Rotos: 8/8 documentos de `data-pipelines` con `<span aria-disabled="true" title="Enlace roto en el origen: …">` y 0 `href` al target roto.
- Seguridad: test efímero `tsx` fuera del repo con `react-markdown`+`rehype-raw`+`rehype-sanitize` y el esquema real (13 ataques + 5 controles); barrido de 52 archivos (38 HTML servido + 14 de `.next/static`) contra el valor literal de `DATABASE_URL`, su host y contraseña, y patrones genéricos (0 credenciales; 1 falso positivo del parser URL); 9 vectores de traversal → 404.
- Tests: `vitest run src/test/no-hardcoded-catalog.test.ts` (14/14) y `vitest run` completo (354 passed, 1 skipped).
- Fixtures: 18/18 con `git hash-object` == `blob_sha` del manifiesto == `blob_sha` del snapshot.
- Restricciones: no se ejecutó `install`, no se escribió en la base, `DATABASE_URL` nunca se imprimió; los scripts efímeros y sus salidas vivieron fuera del repo.

---

# Re-QA (post-correcciones)

- Tarea: `[M2-RQA-FD]` — segunda pasada READ-ONLY de fidelidad y seguridad tras la ronda de correcciones FX1–FX5 (F-01..F-07). No se ha modificado ningún archivo del repo salvo este informe (append).
- Fecha: 2026-10-02. Servidor auditado: `http://localhost:3100` (el coordinador avisó de un reinicio del proceso a media sesión; las verificaciones afectadas se repitieron y no se contabilizan como hallazgo).
- Snapshot verificado por SQL en `BEGIN READ ONLY`: `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, `ref = main`, commit `962c1e5fc8ebad273abaa348fb3d161568ce8707`, `complete`, 0 errores, 899 archivos (781 texto / 118 binario), 84 proyectos, 22 contextos, 5 lecciones, 0 filas anidadas en `source_projects` para `4-devs`.
- Método abreviado de esta ronda: **24 páginas HTML** de `:3100` descargadas (índices, 14 vistas de detalle, variantes EN/ES, contextos con/sin `?doc`, un 404 y auxiliares); el análisis estructurado comparó 17 (3 índices + 14 detalles, ≥8 pedidas). El `raw_content` del snapshot de los 107 documentos preferidos y de los 2 README de proyectos se volcó a un directorio temporal **fuera del repo** y se comparó contra el HTML con normalización de entidades/Markdown inline y comprobación de subcadena; inventario de enlaces same-repo calculado en Node contra la base (solo `SELECT`); test XSS efímero con el pipeline real (`react-markdown`+`rehype-raw`+`rehype-sanitize`, esquema real) en `/tmp`; escaneo de secretos sobre el HTML servido y `.next/static` sin imprimir `DATABASE_URL`.
- Baseline git: sin cambios propios en `platform/**`; los únicos artefactos escritos por esta QA son las secciones añadidas a `M2_QA_FIDELITY.md` y `M2_QA_DESIGN.md`.

## R1. Estado de F-01..F-07

| ID   | Sev. original | Estado re-QA        | Evidencia principal                                                                                                                                                                     |
| ---- | ------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | MAJOR         | **Corregido** (R-1) | `links.ts:114-143` resuelve URLs absolutas same-repo por path; 60/66 ocurrencias alcanzables ahora internas o pinneadas; los 6 paths inexistentes siguen externos intactos.             |
| F-02 | MAJOR         | **Corregido**       | `order.ts:150-151,187-197` guarda el `listMarker` de lista ordenada; `/projects` pinta `0..70` y **ningún** número en `4-devs`, "Otros proyectos" ni no listados; 0 discrepancias.       |
| F-03 | MINOR         | **Corregido**       | `document-view.tsx:67` aplica `lang` del documento mostrado al contenedor de lectura (`lang="en"` en variantes EN); `<html lang="es">` se mantiene para la interfaz.                    |
| F-04 | MINOR         | **Corregido**       | `source-markdown.tsx:87-100` aplica `target/rel` y aviso accesible a `kind: "source"`; verificado en HTML real y en test efímero.                                                       |
| F-05 | MINOR         | **Corregido**       | `reader.ts:450` normaliza etiquetas con `markdownInlineToText` (`title.ts:63-86`); el título de `4-devs` ya no muestra backticks.                                                       |
| F-06 | NIT           | **Corregido**       | `?lang` inválido → 404 en proyectos (`projects/[slug]/page.tsx:61-69`), contextos (`contexts/[slug]/page.tsx:70-76,159-161`) y lecciones (`lessons/[slug]/page.tsx:71-77`).               |
| F-07 | NIT           | **No reproducible** | El 404 servido en dev ya no contiene `data-next-error-stack`; se mantiene como verificación de build de producción en CI (sin riesgo de seguridad).                                    |

### F-01 — resolución de URLs absolutas del propio repo (detalle)

- La política nueva (`links.ts:5-20` y `:197-236`) compara owner/name sin distinguir mayúsculas y decide por **path**, no por ref: si el path existe con vista interna → ruta interna; binario → `binary_reference` raw@commit; texto/directorio sin vista → blob/tree@commit; si **no existe** → la URL original se deja intacta como externa (`:217-219`), sin marcarla rota ni inventar destino.
- Inventario real sobre el snapshot (Node, solo lectura): de los **107 documentos preferidos alcanzables**, **48** contienen URLs absolutas same-repo (66 ocurrencias): **15 existen como archivo, 45 como directorio y 6 no existen**. Las 60 existentes se resuelven; las 6 inexistentes se comprueban en HTML como externas intactas.
- Evidencia de resolución en el HTML de `:3100`:
  - `/lessons/4geeks-student-extension` (ES): el enlace de la fuente a `https://github.com/…/blob/main/content/lessons/4geeks-student-extension/4geeks-student-extension.md` se renderiza como `href="/lessons/4geeks-student-extension?lang=en"` (vista interna del par real).
  - `/projects/edutrack-data-audit-sql`: el enlace same-repo `…/blob/main/content/projects/edutrack-data-audit-sql/README.md` se renderiza como `href="/projects/edutrack-data-audit-sql?lang=en"` (texto literal `available in English`).
  - `/projects/4-devs/ai-eng-incident-manager-for-devs`: `…/tree/main/content/contexts/4-devs/incident-manager-for-devs` → `https://github.com/4GeeksAcademy/ai-engineering-syllabus/tree/962c1e5fc8ebad273abaa348fb3d161568ce8707/content/contexts/4-devs/incident-manager-for-devs` con `target="_blank" rel="noopener noreferrer"` y aviso `sr-only`.
  - `/projects/ai-eng-milestone-backend-development`: las 2 imágenes `.learn/supabase-*.png` (binarias del snapshot) se sirven con `src` raw@commit (no `blob/main`).
  - `/projects/simple-dashboard-tailwind-css`: `…/blob/main/…/.learn/solution.png` → `binary_reference` `raw.githubusercontent.com/…/962c1e5…/….learn/solution.png` (`<img>` con `loading/decoding/referrerPolicy`).
- Evidencia de **no** arreglo ni invención (paths inexistentes):
  - `/projects/ai-eng-real-time-communication`: los destinos `content/contexts/10-realtime/communication` y `…/notification` no existen en el snapshot (0 filas) y se renderizan tal cual a `https://github.com/…/tree/main/…` (sin `href` interno ni error de "roto").
  - `/projects/seats-management-typescript`: `assets/cover/images/cinema_matrix.png` no existe; el `<img>` conserva `src="…/blob/main/assets/cover/images/cinema_matrix.png?raw=true"`.
  - `/contexts/06-telemetry-data-pipelines`: los 8 documentos con enlaces relativos rotos del Apéndice B siguen mostrándose como span `aria-disabled="true"` sin `href` (`1` span roto en cada `.es.md`, `2` hits en cada `.md`), con texto visible ` (enlace roto)` y `title="Enlace roto en el origen: …"`.
- Tests que fijan el contrato: `links.test.ts:214-293` (same-repo existente, externo ajeno y "deja intacta la URL si el path no existe") y `links.test.ts:373-419` (PGlite, misma semántica contra el store).

### F-02 — badges solo para ítems de lista ordenada

- Secuencia de marcadores renderizada en `/projects`: `0,1,…,70` y **13 filas sin número** (`./4-devs`, los 7 de `## Otros proyectos` y los 5 no listados). Números `72/73` y el hueco 71–80 de la ronda anterior han desaparecido.
- Comprobación programática: 84/84 títulos == etiqueta normalizada del `README.es.md`; 0 discrepancias de marcador contra el número literal de la línea del enlace; **0 marcadores visibles fuera de los 71 números de lista ordenada del README**.
- Código: `order.ts:150-151` captura `N.`/`N)` solo de listas ordenadas (nunca de viñetas/párrafos), `reader.ts:471` lo propaga como `listMarker` y `projects-index.tsx:82` lo pinta; `unit-list.tsx:52-56` no pinta nada si es `null`.

### F-03/F-04/F-05/F-06 (evidencia puntual)

- F-03: todas las vistas EN comprobadas llevan `lang="en"` en el contenedor de contenido (`document-view.tsx:67`): `/lessons/4geeks-student-extension?lang=en`, `/projects/n8n-snackcheck-nutrition?lang=en`, `/contexts/01-web-fundamentals?doc=CONTEXT-brasaland.en.md`. El `<html lang="es">` sigue fijo por tratarse del idioma de la interfaz.
- F-04: HTML real de `/projects/4-devs/ai-eng-incident-manager-for-devs` (`<a … tree/962c1e5… target="_blank" rel="noopener noreferrer">CONTEXT-company.md<span class="sr-only"> (se abre en una pestaña nueva)</span></a>`) y test efímero (38 asserts) que cubre la rama `source` en variante `document` y `compact`.
- F-05: `/projects` muestra `./4-devs` (sin backticks) como título de fila; `/projects/4-devs` muestra `./4-devs` como título de cabecera y `Curso For Devs — proyectos` como H1 del documento. Test `title.test.ts:97-148` fija la conversión; mi verificación independiente sobre las 81 etiquetas del README real da **0 cambios de palabras**.
- F-06: tabla HTTP reproducida — `?lang=xx` → 404 en `/projects/n8n-snackcheck-nutrition`, `/contexts/01-web-fundamentals` y `/lessons/4geeks-student-extension`; `?lang=en` en un contexto sin documento (06) → 404; `?doc=missing.md` → 404. El contrato es ahora uniforme.

## R2. AC-2.13 — repetición abreviada

### R2.1 Índices

| Vista       | Filas del snapshot | Filas renderizadas | Títulos literales                                       | Marcadores                                                                 |
| ----------- | ------------------ | ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `/projects` | 84                 | **84/84**          | 84/84 == etiqueta normalizada de `README.es.md` (0 dif.) | `0..70` literales; 13 ítems sin número (0 dif. contra la fuente)           |
| `/contexts` | 22                 | **22/22**          | 22/22 == primer H1 del preferido o slug (0 dif.)         | n/a; cada fila muestra su slug literal (`contexts-index.tsx:47`)           |
| `/lessons`  | 5                  | **5/5**            | 5/5 == primer H1 del `.es.md` preferido (0 dif.)         | n/a                                                                        |

- Encabezados de `/projects` renderizados: `Proyectos (orden sugerido)`, `Curso For Devs`, `Otros proyectos` — los 3 son `##` literales del README (orden incluido) — y el copy neutro de interfaz `Sin posición en el índice del repositorio` para los 5 no listados. El orden de aparición coincide con el del README.
- `markdownInlineToText` (nuevo) no altera palabras: comparé secuencia de palabras de cada una de las 81 etiquetas enlazadas del README contra su versión normalizada → **0 discrepancias**; además `title.test.ts:134-147` verifica sobre el fixture real que las etiquetas decoradas pierden backticks/`**` conservando el slug.

### R2.2 Vistas de detalle (14 páginas, ≥8 pedidas)

Comparación de nodos de texto ≥20 caracteres dentro de `<main>` contra el `raw_content` del snapshot mostrado, normalizando entidades y Markdown inline (subcadena exacta; fallback de secuencia de palabras para cruces de sintaxis):

| Página | Documento del snapshot | Nodos | Literales exactos | Por secuencia | Interfaz/derivados | No literales |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/projects/n8n-snackcheck-nutrition` | `README.es.md` | 223 | 129 | 48 | 15 | **0** |
| `/projects/n8n-snackcheck-nutrition?lang=en` | `README.md` | 224 | 121 | 45 | 11 | **0** |
| `/projects/4-devs` | `README.es.md` | 22 | 6 | 1 | 12 | **0** |
| `/projects/4-devs/ai-eng-incident-manager-for-devs` | `README.es.md` | 110 | 84 | 3 | 14 | **0** |
| `/projects/html-css-artist-landing-seo-access` | `README.es.md` | 91 | 57 | 3 | 12 | **0** |
| `/projects/ai-eng-milestone-backend-development` | `README.es.md` | 172 | 113 | 18 | 14 | **0** |
| `/projects/edutrack-data-audit-sql` | `README.es.md` | 120 | 84 | 8 | 13 | **0** |
| `/projects/seats-management-typescript` | `README.es.md` | 83 | 61 | 6 | 11 | **0** |
| `/projects/ai-eng-real-time-communication` | `README.es.md` | 113 | 76 | 12 | 12 | **0** |
| `/contexts/01-web-fundamentals` | `CONTEXT-brasaland.es.md` | 138 | 98 | 2 | 20 | **0** |
| `/contexts/06-telemetry-data-pipelines?doc=data-pipelines%2FCONTEXT-brasaland.es.md` | idem | 140 | 78 | 6 | 23 | **0** |
| `/contexts/4-devs?doc=incident-manager-for-devs%2FCONTEXT-brasaland.es.md` | idem | 139 | 60 | 8 | 40 | **0** |
| `/lessons/4geeks-student-extension` | `4geeks-student-extension.es.md` | 119 | 72 | 12 | 11 | **0** |
| `/lessons/4geeks-student-extension?lang=en` | `4geeks-student-extension.md` | 115 | 68 | 13 | 10 | **0** |
| **Total** | | **1809** | **1107** | **185** | **218** | **0** |

- "Interfaz/derivados" son copys neutros y derivaciones literales permitidas: paths y basenames del snapshot, shas, snapshot id, fecha de importación, nombres de documentos hermanos en el aside, títulos de subproyectos (etiquetas del README de orden) y copys como "Detalles de procedencia". **Ningún nodo quedó sin origen literal demostrable.**
- Procedencia: en cada detalle, "Ver en GitHub" va a `blob/tree@962c1e5…` (nunca a `main`) con `target/rel`; el `<code>` del path y los shas coinciden con el snapshot.

## R3. F-01: no "arregla" enlaces rotos ni inventa destinos

- Relativos rotos: los 8 documentos de `data-pipelines` con enlace del Apéndice B se renderizan como `<span aria-disabled="true" title="Enlace roto en el origen: ./CONTEXT-…-pipeline.md">` sin `href`; 0 destinos inventados y 0 `href` hacia el target roto (comprobado documento a documento).
- Absolutos same-repo inexistentes: 6 ocurrencias en 4 documentos (`10-realtime/communication`, `10-realtime/notification` ×2, `assets/cover/images/cinema_matrix.png`, y 2 con ref multisegmento, ver R-1). Las de path inexistente conservan **exactamente** el `href` de la fuente (`…/tree/main/…`, `…/blob/main/…?raw=true`); no se convierten en ruta interna ni en `blob@commit`.
- Ningún caso produce un href hacia un path que no exista en el snapshot ni un fallback de "relleno".

## R4. Seguridad (sin regresión)

- **XSS**: test efímero en `/tmp` con el pipeline y esquema reales (18 vectores × variante `document`/`compact` + controles positivos + `target/rel` de `source`/`external`): **38/38 en verde**; ningún `<script>`, `onerror`, `onclick`, `ontoggle`, `javascript:`, `vbscript:`, `<iframe>`, `<style>`, `<svg>`, `<form>`, `<object>`, `<embed>`, `http-equiv` ni `data:text/html` sobrevive. Los controles (`<details>`, tabla GFM, task list, `img width`, enlaces) se conservan. El corpus servido no contiene ninguno de esos patrones en el área de contenido.
- **`source` con `target`/`rel` y aviso**: verificado en HTML real (procedencia y enlace same-repo del subproyecto de `4-devs`) y en los tests de componente (`source-markdown.test.tsx:357-369`). La variante `compact` se ejecuta en el test efímero para los 18 vectores (mismo esquema y pipeline).
- **Secretos**: escaneo de **35 archivos** (21 HTML servidos + 14 de `.next/static`: 13 JS y 1 CSS) contra el valor literal de `DATABASE_URL`, su usuario, contraseña, host y nombre de base, `GITHUB_TOKEN` y patrones `postgres://`, `supabase.co`, `service_role`, JWT `eyJ…`: **0 coincidencias con credenciales**. Los únicos hits fueron contenido público (`supabase.co` enlazado en un README: 2) y el parser de URL del bundle (`password=`: 8, sin valor). No hay `NEXT_PUBLIC_*` en código; `.env.local` sigue ignorado por git.
- **Superficie**: 0 `dangerouslySetInnerHTML`/`innerHTML`/`eval(` en `platform/src` (sin tests); `server-only` intacto; sin route handlers. Traversal re-verificado: `/projects/../etc/passwd` (codificado) → 404, `/contexts/01-web-fundamentals?doc=../../../etc/passwd` → 404, `?doc=%00` → 404, `?doc=válido&doc=../../../etc/passwd` → 200 con el primer valor (comportamiento preexistente, sin fuga).
- **Guard AC-0.10 y suite**: `vitest run src/test/no-hardcoded-catalog.test.ts` → **14/14**; `vitest run src/test/no-hardcoded-catalog.test.ts src/components/source-markdown.test.tsx` → **35/35**; suite completa → **44 archivos, 417 tests, 1 skipped, 0 fallos**.

## R5. Hallazgos nuevos de esta ronda

#### R-1 — MINOR — URLs same-repo con ref multisegmento (`refs/heads/main`) no se resuelven (quedan sin pinnear)

- **Dónde**: `platform/src/course/links.ts:34-38` — los patrones `SAME_REPO_GITHUB_PATTERN`/`SAME_REPO_RAW_PATTERN` asumen una ref de **un solo segmento** (`[^/]+`), por lo que `…/blob/refs/heads/main/<path>` se parsea con ref `refs` y path `heads/main/<path>`.
- **Evidencia real**: `content/projects/edutrack-data-audit-sql/README.es.md` y `…-related-tables/README.es.md` enlazan `https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/refs/heads/main/content/projects/…/edutrack(.sql|_v2.sql)`; ambos paths **sí existen como texto** en el snapshot (verificado por SQL), pero `/projects/edutrack-data-audit-sql` los renderiza con el href externo `…/refs/heads/main/…` sin pinnear:
  ```html
  <a href="https://raw.githubusercontent.com/4GeeksAcademy/ai-engineering-syllabus/refs/heads/main/content/projects/edutrack-data-audit-sql/edutrack.sql" target="_blank" rel="noopener noreferrer" …>
  ```
- **Impacto**: 2 ocurrencias en 2 documentos alcanzables (el path existe y podría mostrarse como enlace pinneado/interno). No hay invención ni enlace roto; falla solo la consecuencia literal de ADR-015 ("ninguna URL apunta a `main`") en este borde. Severidad MINOR.
- **Corrección sugerida**: permitir refs multisegmento en los patrones (p. ej. `(?:[^/]+/)*[^/]+` para la ref) o normalizar `refs/heads/<rama>` antes de extraer el path; añadir el caso a `links.test.ts`.

## R6. Veredicto de la re-QA de fidelidad y seguridad

- **LISTO PARA CERRAR.** No quedan BLOCKER ni MAJOR: F-01..F-06 corregidos con evidencia en HTML real y tests; F-07 no reproducible; AC-2.13 se mantiene verde (1809 nodos de texto extraídos y 1510 comprobados ≥20 caracteres tras normalizar; 0 inventados; 0 discrepancias de títulos/marcadores); seguridad sin hallazgos (XSS 38/38, 0 credenciales, 0 traversal).
- Queda **1 MINOR (R-1)** de borde en el resolvedor (`refs/heads/main`, 2 ocurrencias) y la nota de verificar el build de producción para el stack de error dev (F-07); ninguno bloquea el cierre.

## Apéndice B — Evidencia reproducible de la re-QA (sin secretos)

- Snapshot: `SELECT` en `BEGIN READ ONLY` (script Node efímero en `/tmp`): conteos 899/781/118, 84/22/5, 0 errores, 0 filas anidadas; volcado de los 781 `raw_content` a `/tmp/m2rqa/snapshot/`.
- Páginas: `curl -s http://localhost:3100/...` de 24 URLs (índices, 14 detalles, EN/ES, contextos con/sin `?doc`, 404); parseo con Python y comparación normalizada contra el snapshot (tabla R2.2).
- Enlaces: inventario Node sobre los 107 preferidos (48 docs con 66 URLs same-repo: 15 archivo / 45 directorio / 6 inexistentes) y verificación puntual en HTML de los 4 casos representativos (interno, blob@commit, raw pinneada, externo intacto).
- Rotos: 8 documentos de `data-pipelines` (4 `.es.md` con 1 span roto; 4 `.md` con 2 hits de "Enlace roto") y 0 `href` al target.
- XSS: `vitest` efímero en `/tmp/m2rqa` con config propia (root fuera del repo, alias `@` a `platform/src`) → 38 tests. Suite del repo: 417 tests. Guard: 14/14.
- Secretos: 35 archivos (22 HTML + 13 JS de `.next/static`) sin coincidencias literales del `.env.local`; salidas sin credenciales.
- Traversal: 6 vectores → 404/200-sin-fuga; `?lang` inválido → 404 en las 3 vistas.
- Restricciones: READ-ONLY; `DATABASE_URL` nunca impresa; scripts y HTML en `/tmp`; no se ejecutó `install`; dev server gestionado por el coordinador (no se arrancó/paró).

---

## QA final (independencia, idioma global, tema)

- Tarea: `[M2-FQA-FD]` — QA **READ-ONLY** final de fidelidad, seguridad y diseño tras ADR-018 (independencia de 4Geeks: `source_blobs`, `/source-files/`, espejo), ADR-019 (idioma global ES/EN por cookie, selector único) y el selector de tema. No se ha modificado ningún archivo del repo; el único artefacto escrito es este informe (append).
- Fecha: 2026-10-02. Servidor auditado: `http://localhost:3100` (el coordinador lo gestiona; no se arrancó ni paró). Snapshot verificado por SQL en `BEGIN READ ONLY`: `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, `ref = main`, commit `962c1e5fc8ebad273abaa348fb3d161568ce8707`, `complete`, 0 errores, 899 archivos (781 texto / 118 binario), 84 proyectos, 22 contextos, 5 lecciones, **0 binarios del snapshot sin fila en `source_blobs`** (112 blobs distintos; los `path` del snapshot no salen de `content/`).
- Método: HTTP real con `curl -s -H "Cookie: lang=…/theme=…"` sobre 44 páginas de contexto (22 × ES/EN), 10 de lección, índices y detalles; parseo con `jsdom`; comparación normalizada contra el `raw_content` del snapshot; verificación byte a byte de **781/781 textos** (`md5`/`octet_length` == `raw_content`) y **118/118 binarios** (SHA-1 git-blob calculado sobre los bytes servidos == `source_blobs.blob_sha`); escaneo de secretos (valor literal de `DATABASE_URL`, sus partes, patrones genéricos) sobre 19 HTML y 22 chunks JS servidos; script de contraste WCAG efímero fuera del repo. `vitest run` completo: **547 passed / 1 skipped / 0 fallos**; guard AC-0.10 **14/14**.
- Baseline git: sin escrituras propias en `platform/**`; los únicos cambios del árbol son los del H2 + ADR-018/019 + tema que commitea el coordinador.

### 1. AC-2.13 con idioma global (ambos idiomas)

| Vista / comprobación | Resultado en `lang=es` | Resultado en `lang=en` | Evidencia |
| --- | --- | --- | --- |
| `/projects` filas | **84/84** | **84/84** | `<li>` con enlace de primer nivel |
| Títulos literales del README del idioma | 79/79 listados == etiqueta de `README.es.md` | 79/79 listados == etiqueta de `README.md` | 78 títulos difieren ES/EN; `./4-devs` y los 5 no listados son los 6 iguales |
| Encabezados de sección | `Proyectos (orden sugerido)`, `Curso For Devs`, `Otros proyectos` (literales) | `Projects (suggested order)`, `For Devs course`, `Other projects` (literales) | 0 encabezados fuera de la fuente; el 4.º es el copy neutro de interfaz |
| Descripciones | 84/84 subcadena literal de `README.es.md` | 84/84 subcadena literal de `README.md` | la única diferencia son los copys sr-only de enlaces externos |
| `/contexts` | **22/22**, títulos == primer H1 del preferido ES o slug | **22/22**, títulos == primer H1 del preferido EN o slug | 0 discrepancias |
| Listas de documentos de los 22 contextos | **224/224** enlaces `?doc=` existen en el snapshot y son `.es.md` | **224/224** existen y no son `.es.md` (`.md`/`.en.md`) | 44 páginas verificadas |
| `/lessons` + 10 detalles | 5/5 títulos == H1 de `<slug>.es.md`; `lang="es"` en el cuerpo | 5/5 == H1 de `<slug>.md`; `lang="en"` | 10/10 páginas |
| `learn.json` | no servido en HTML visible | ídem | sin cambios en el pipeline |
| Nota de fallback | no alcanzable | no alcanzable | los 122 pares de markdown de contextos tienen ES y EN; copys neutros cubiertos en tests de componente |
| `?lang` heredado | ignorado (200, sin 404) y sin efecto | ídem | ADR-019 |
| `<html lang>` | `es` | `en` | cabecera SSR |

- **Cero variantes inventadas**: todo path listado existe en `source_files` del snapshot activo; los `?doc` fuera de la lista del contexto o inexistentes → 404.
- **Ningún texto traducido**: no hay copys nuevos de contenido; los únicos literales de interfaz son los copys neutros del shell/vistas y las derivaciones de paths.
- **Procedencia (AC-2.11 + ADR-018)**: en cada detalle el texto dice siempre el repo de **ORIGEN** (`4GeeksAcademy/ai-engineering-syllabus`) con commit corto y completo, path y blob; el enlace se etiqueta «Ver en GitHub (espejo)»/«View on GitHub (mirror)» y apunta al repo espejo **pinneado al commit** (`/tree|blob/962c1e5…/`), 0 enlaces a `main` en los 5 HTML comprobados.
- **Hallazgo**: QA-F1. La única fuga de idioma son 5 títulos de proyectos no listados (detalle abajo).

#### QA-F1 — MAJOR — En modo EN, 5 proyectos no listados muestran título en español (ES) en índice y detalle

- **Dónde**: `platform/src/course/reader.ts:481-486` (`buildProjectUnit` lee el H1 de `row.preferredDocumentPath`, siempre `README.es.md`, sin usar `lang`), invocado desde `getProjectsIndex` (`reader.ts:687`) y `getProject` (`reader.ts:721`); análogo en `buildSubprojectUnit` (`reader.ts:570-575`, vía `listSubprojects:739-742`). El índice de contextos/lecciones sí usa la variante (`titlePathFor` → `variantPathFor`, `reader.ts:614-626`), por eso solo fallan proyectos sin etiqueta en el README.
- **Evidencia literal** (`/projects` con `Cookie: lang=en`):
  ```html
  <a href="/projects/ai-eng-cybersecurity-practices" class="…">Prácticas Seguras en la Integración de IA en Sistemas</a>
  ```
  y en el detalle `/projects/ai-eng-cybersecurity-practices` con `lang=en`:
  ```html
  <title>Prácticas Seguras en la Integración de IA en Sistemas</title>
  <p class="text-base font-medium …">Prácticas Seguras en la Integración de IA en Sistemas</p>
  <h1 class="…">Secure Practices for AI Integration in Systems</h1>
  ```
  Los 5 casos son los proyectos sin mención en `content/projects/README.md`: `ai-eng-cybersecurity-practices`, `ai-eng-cybersecurity-vulnerabilities`, `ai-eng-evaluating-regression-model`, `ai-eng-sales-forecasting-timeseries`, `vps-ssh-resource-optimization` (sus `README.md` sí tienen H1 en inglés, p. ej. `# Secure Practices for AI Integration in Systems`).
- **Impacto**: incumple ADR-019 («en inglés solo se ve lo inglés… títulos») y mezcla idiomas en la misma página (cabecera y `<title>` en ES con cuerpo en EN). Afecta a 5/84 filas del catálogo y a sus 5 vistas de detalle; no hay contenido inventado (el texto es literal, pero del documento equivocado).
- **Corrección sugerida**: pasar `lang` a `buildProjectUnit`/`buildSubprojectUnit` y usar la variante para el fallback de H1 con la misma función que el índice, p. ej. `this.readDocumentTitle(context, lang === undefined ? row.preferredDocumentPath : this.variantPathFor(context, row.preferredDocumentPath, lang))`; añadir caso EN en `reader.test.ts` con un proyecto sin etiqueta. Un `getProject(slug, "en")` debe devolver `Secure Practices…`.

#### QA-F2 — NIT — PDFs servidos inline sin `sandbox` en la CSP (excepción documentada)

- **Dónde**: `platform/src/app/source-files/[...path]/route.ts:46-47` (`PDF_CSP` sin `sandbox`) y `:108-111` (se aplica a `application/pdf`).
- **Evidencia**: 12/12 PDF responden `content-type: application/pdf`, `x-content-type-options: nosniff`, `content-security-policy: default-src 'none'; …; script-src 'none'; object-src 'none'` (sin `sandbox`); el resto de tipos (p. ej. `text/html`, `text/javascript`, `application/json`) van como `text/plain; charset=utf-8` + `sandbox`, y `.DS_Store` como `application/octet-stream` + `attachment`.
- **Impacto**: bajo; el comentario `route.ts:41-45` justifica que `sandbox` bloquea el visor nativo de PDF. Mitigado con `nosniff`, sin scripts y sin objetos. Se registra solo como observación (si se quiere máximo aislamiento, servirlos con `Content-Disposition: attachment` o visor propio en H4).

### 2. Seguridad

- **`/source-files/` (ADR-018)**:
  - **118/118 binarios** servidos con bytes idénticos al blob del snapshot: `sha1("blob <len>\0"+bytes)` calculado sobre la respuesta == `source_blobs.blob_sha`, y longitud == `byte_size` (png 101, pdf 12, jpeg 4, octet-stream 1).
  - **781/781 textos** servidos idénticos a `raw_content` (`md5` y `octet_length` de la respuesta == columna); 0 transformaciones.
  - Tipos peligrosos: `text/html` (8), `text/javascript`, `text/css`, `application/json` (87) y `text/csv` (9) se sirven `text/plain; charset=utf-8`; binario desconocido → `attachment`.
  - **Traversal/encoding**: 13 vectores (`..%2f`, `%2e%2e/`, `%252e%252e`, `%2f`, `%5c`, `%00`, rutas absolutas, doble barra) → **404**; `content/projects/./README.es.md` se normaliza a un path real del snapshot (200 con el mismo contenido) y `//` da 308 al path canónico. Paths que existen en disco pero no en el snapshot (`README.md` de raíz, `platform/src/app/page.tsx`, `.git/config`) → **404**.
  - Caché: `public, max-age=300, must-revalidate` + `ETag: "<blob_sha>"`; `If-None-Match` (fuerte y débil) → 304.
- **Open-redirect `/preferences/*`**: 12 vectores en idioma y 5 en tema (`https://evil`, `//evil`, `/\evil`, `%5C`, `%09`, `%2F%2F`, `javascript:`, `%0d%0a`, `..`) → `Location: /projects`; `next` interno válido se conserva (`/projects?doc=x`); idioma/tema inválido → **404 sin `Set-Cookie`**; respuestas con `Cache-Control: no-store`.
- **Cookies**: solo `lang=es|en` y `theme=light|dark|system`; `Path=/; Max-Age=31536000; SameSite=Lax` (+`Secure` en producción); ningún dato sensible ni token.
- **XSS sin regresión**: 0 `dangerouslySetInnerHTML`/`innerHTML`/`eval(` en `platform/src` (sin tests); 0 patrones ejecutables (`<script`, `on*=`, `javascript:`, `data:text/html`, `<iframe/object/embed/style/form/meta/base`) en el `<main>` de 19 páginas servidas; `?doc`/slug con `<script>` → 404 y el valor queda dentro del payload RSC escapado (0 etiqueta literal).
- **Secretos**: escaneo de 19 HTML + 22 chunks JS servidos contra el valor literal de `DATABASE_URL`, usuario, contraseña, host, nombre de base y patrones genéricos (`postgres://`, `supabase.co`, `service_role`, JWT, `password=`): **0 credenciales**; único hit genérico = parser de URL del bundle (propiedad `password`, sin valor). `.env.local` sigue ignorado por git.
- **Errores**: 404/500 del route handler vacíos; sin trazas ni paths internos.
- **AC en rojo: ninguno.** Veredicto de fidelidad/seguridad: **NO LISTO PARA CERRAR** por QA-F1 (MAJOR); con esa corrección (una función) no queda ningún BLOCKER ni MAJOR. QA-F2 es NIT documentado.

### Apéndice — Evidencia reproducible de la QA final (sin secretos)

- Snapshot: `SELECT` en `BEGIN READ ONLY` (script Node efímero en `/tmp` con `pg`): conteos 899/781/118, 84/22/5, 112 blobs, 0 binarios sin bytes, 0 paths fuera de `content/`.
- HTTP: 44 páginas de contexto + 10 de lección + 84 filas de proyecto (ES/EN) descargadas a `/tmp`; bytes: 118 binarios (SHA-1 git-blob) y 781 textos (`md5` + longitud) comparados contra la base; 13 vectores de traversal, 17 de open-redirect, negativos de snapshot y cabeceras MIME/CSP/nosniff/ETag.
- Secretos: 41 archivos servidos (19 HTML + 22 JS) con 0 coincidencias reales.
- Contraste: script okLCH→sRGB+WCAG efímero en `/tmp` (ver informe de diseño).
- Tests: `vitest run` → 547 passed / 1 skipped; guard AC-0.10 14/14.
- Restricciones: READ-ONLY, sin `install`, sin escrituras en base, `DATABASE_URL` nunca impresa, scripts y HTML fuera del repo.

---

### Re-QA final (QA-F1, QA-D1..D3)

- Tarea: `[M2-ZQA]` — re-QA **READ-ONLY** de la última mini-ronda de correcciones. Este informe cubre **QA-F1** y **QA-D2** (fidelidad/accesibilidad); **QA-D1** y **QA-D3** se re-verifican en `M2_QA_DESIGN.md`. El único archivo tocado es este informe (append).
- Fecha: 2026-10-02. Servidor: `http://localhost:3100` (del coordinador; no se arrancó ni paró). Snapshot verificado por SQL en `BEGIN READ ONLY`: `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, `ref=main`, commit `962c1e5fc8ebad273abaa348fb3d161568ce8707`, `complete`, 0 errores, 899 archivos (781 texto / 118 binario), 84 proyectos, 22 contextos, 5 lecciones, 0 filas anidadas en `source_projects` de `4-devs`.
- Método: `curl -s` con `-b 'lang=es'`/`-b 'lang=en'` (y `theme=light|dark` para el `<html class>`), 31 HTML en `/tmp` fuera del repo; verificación independiente de títulos contra el `raw_content` del snapshot con un script Node efímero (`pg`, solo `SELECT` en `BEGIN READ ONLY`, `DATABASE_URL` nunca impresa); comparación de hrefs del HTML con el corpus fuente para separar enlaces generados de literales.

| ID   | Sev. original | Estado re-QA    | Evidencia principal                                                                                                                                                     |
| ---- | ------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-F1 | MAJOR        | **Corregido**   | `reader.ts:481-489` y `:573-581` usan `titlePathFor(context,row,lang)` (`:621-632`); los 5 no listados muestran el H1 de la variante EN en índice, `<title>`, cabecera y `<h1>`; 84/84 títulos EN y ES literales. |
| QA-D2 | MINOR        | **Corregido**   | `projects-document.tsx:86` y `projects-index.tsx:105` pasan `lang={lang}` a `SourceMarkdown`; en EN el sr-only es `(opens in a new tab)` y en ES `(se abre en una pestaña nueva)`; 0 fugas de idioma en las 31 páginas. |

#### QA-F1 — títulos de los 5 proyectos no listados en el idioma pedido (detalle)

- **Código**: el fallback sin etiqueta de README usa la variante real del idioma: `buildProjectUnit` (`platform/src/course/reader.ts:481-489`) y `buildSubprojectUnit` (`:573-581`) llaman a `this.titlePathFor(context, row, lang)`, que pasa por `variantPathFor` (`:602-618`); el preferido sigue siendo ES, pero con `lang=en` se lee el `README.md` del proyecto.
- **Evidencia literal** (`/projects` con `Cookie: lang=en`):

  ```html
  <a href="/projects/ai-eng-cybersecurity-practices" class="…">Secure Practices for AI Integration in Systems</a>
  <a href="/projects/ai-eng-cybersecurity-vulnerabilities" class="…">Web Vulnerability Audit and Remediation (OWASP Top 10)</a>
  <a href="/projects/ai-eng-evaluating-regression-model" class="…">Evaluating a Regression Model</a>
  <a href="/projects/ai-eng-sales-forecasting-timeseries" class="…">Sales Forecasting with Time Series Feature Engineering</a>
  <a href="/projects/vps-ssh-resource-optimization" class="…">SSH into a VPS, audit resources, and optimize RAM</a>
  ```

- **Detalle** (`/projects/<slug>` con `lang=en`): en los 5 casos `<title>`, el `<p class="text-base font-medium …">` de cabecera y el `<h1>` del documento dicen exactamente lo mismo y es el **H1 literal de la variante EN**; con `lang=es` dicen el H1 literal de `README.es.md`. Ejemplo: `ai-eng-cybersecurity-practices` → `Secure Practices for AI Integration in Systems` (EN) / `Prácticas Seguras en la Integración de IA en Sistemas` (ES).
- **Comprobación 84/84 independiente** (HTML ↔ `raw_content` del snapshot, normalizando solo decoración Markdown inline y espacios): en ES **79/79** títulos listados == etiqueta de `README.es.md` y **5/5** no listados == H1 de su `README.es.md`; en EN **79/79** == etiqueta de `README.md` y **5/5** == H1 de su `README.md`; **0 discordancias** y 0 fallbacks a slug.
- **Subproyectos** (`buildSubprojectUnit`): en `/projects/4-devs` con `lang=en` los dos subproyectos muestran H1 EN (`Operations Backoffice – Incident Manager`, `Operations Backoffice – Inventory Manager`), también corregidos.

#### QA-D2 — avisos sr-only de enlaces en el idioma global (detalle)

- **Código**: `projects-document.tsx:83-86` y `projects-index.tsx:101-105` renderizan `SourceMarkdown` con `lang={lang}`; los copys viven en `source-markdown.tsx:28-39`.
- **Evidencia literal** (`/projects`, enlace a `10-realtime/agent-observability` del documento mostrado):

  ```html
  <!-- lang=en -->
  <a href="https://github.com/Aresdgi/ai-engineering-syllabus/tree/962c1e5…/content/contexts/10-realtime/agent-observability" target="_blank" rel="noopener noreferrer" class="…">…<span class="sr-only"> (opens in a new tab)</span></a>
  <!-- lang=es -->
  …<span class="sr-only"> (se abre en una pestaña nueva)</span></a>
  ```

- **Recuento en las 31 páginas** (índices, 10 detalles ES/EN, contextos con/sin `?doc`, 404): en todas las páginas EN **0** apariciones de `(se abre en una pestaña nueva)`/`(enlace roto)` y en todas las ES **0** de `(opens in a new tab)`/`(broken link)`; el hint roto también alterna correctamente (`c06.en` → `(broken link)`, `c06.es` → `(enlace roto)`).

#### No regresión de la mini-ronda

- **AC-2.2 (orden intacto)**: `/projects` renderiza **84/84** filas en la secuencia exacta derivada de `content/projects/README.md` (79 listadas por el README + 5 no listadas al final por `source_path`), en ES **y** EN; SHA-256 de la secuencia de slugs = `69a3264ff67ed5df0f72c3dc081908c948272dabd8182ca935f414d32f1c9c0f`, idéntico a la Re-QA anterior. Marcadores: **71 exactos `0..70`** sobre las 71 entradas de lista ordenada y **0** marcadores en las 13 restantes (`4-devs`, 7 de "Otros proyectos", 5 no listados).
- **AC-2.13 (títulos)**: los 84 títulos de proyecto en EN y ES son literales del README del idioma o del H1 de la variante del idioma (79+5; 0 discrepancias, 0 slug), tal como detalla QA-F1; el resto de la fidelidad no cambia (mismos 899/84/22/5 del snapshot).
- **0 hrefs generados a 4Geeks en 20 páginas** (se analizaron 31): `https://github.com/4GeeksAcademy/ai-engineering-syllabus/(blob|tree|raw)/…` → **0**; `raw.githubusercontent.com` → **0**; enlaces a GitHub del resolvedor → **37** al espejo `github.com/Aresdgi/…` pinneados al commit. Las 5 URLs distintas a `github.com/4GeeksAcademy`, las 22 a `4geeksacademy.com`, las de `4geeks.com` y `x.com` (61 ocurrencias en las 20 páginas) son **literales del contenido** (subcadena exacta del `raw_content`; 0 no literales). «Ver en GitHub (espejo)»/`View on GitHub (mirror)` conserva la procedencia textual del repo de origen y enlaza al espejo `@962c1e5…`.

#### Gate rápido

| Comando                                   | Resultado                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `lint` (`eslint .`)                       | **exit 0**, sin avisos.                                                          |
| `typecheck` (`next typegen && tsc --noEmit`) | **exit 0**, «Types generated successfully».                                    |
| `test` (`vitest run`)                     | **58 archivos pasan / 1 skipped; 557 tests pasan / 1 skipped, 0 fallos** (6,6 s). |

#### Veredicto

- **LISTO PARA CERRAR** por fidelidad/seguridad: QA-F1 y QA-D2 **CORREGIDOS** con evidencia en HTML real y en la fuente; AC-2.2 y AC-2.13 sin regresión; 0 hrefs generados a 4Geeks; gate en verde. No hay BLOCKER ni MAJOR en este informe; el único residual de la mini-ronda es la observación de diseño sobre el estado activo del aside de documentos (ver `M2_QA_DESIGN.md`).
