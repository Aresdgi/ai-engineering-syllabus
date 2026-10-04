# M2B — Auditoría y Plan Mínimo (Autonomía de 4Geeks)

- Hito: **Hito 2.5 — Autonomía de 4Geeks** (`docs/milestones/M2B_AUTONOMY.md`, AC-2.5.1..10).
- Estado: auditoría **READ-ONLY** + propuesta. No se ha modificado código, datos ni configuración; el único artefacto es este informe.
- Fecha de la auditoría: 2026-10-02.
- Repo fuente auditado: `4GeeksAcademy/ai-engineering-syllabus`, commit pinneado `962c1e5fc8ebad273abaa348fb3d161568ce8707`.
- Snapshot activo consultado (solo lectura, `BEGIN READ ONLY`): `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a`, `ref = main`, `status = complete`, `imported_at = 2026-10-02T12:13:49.515Z`, 899 archivos. Es el único snapshot de la base; el inventario local se reconcilió contra él.
- Baseline git: limpio al empezar; este informe añade únicamente `docs/milestones/M2B_AUDIT_PLAN.md`.
- Convención de comandos: los comandos de app se ejecutan como `npx --yes pnpm@12.8.1 --dir platform <cmd>` (nunca `pnpm install` en la raíz). En esta auditoría **no** se ejecutó ningún comando de app (ni `install`, ni `build`, ni `test`, ni `ingest`, ni `db:migrate`).
- Restricciones respetadas: READ-ONLY; la base se consultó con `SELECT` dentro de `BEGIN READ ONLY` (`SET LOCAL statement_timeout`), sin escribir; `DATABASE_URL` se cargó desde `platform/.env.local` sin imprimirla, copiarla ni registrarla; los scripts efímeros vivieron fuera del repo (directorio temporal de la sesión); las peticiones externas fueron GET públicos sin login (~50), respetando `robots.txt`; **no** se llamó a "Save Page Now" ni a ningún endpoint de escritura.
- Nota de transparencia: al comprobar por primera vez los dos primeros enlaces de lección se siguió el 301 con `curl -L` y la petición acabó en `learn.4geeks.com` (cuerpos descartados) antes de conocer su `robots.txt`; al descubrir `Disallow: /` no se volvió a pedir nada a ese host. Detalle en §3.6.

---

## 1. AC-2.5.1 .. AC-2.5.10: texto literal, interpretación verificable y evidencia

Texto literal de `docs/milestones/M2B_AUTONOMY.md` (líneas 15-24). "Evidencia" es el test/comando/artefacto que demostrará la implementación. Las ambigüedades se detallan en §1.1.

| AC        | Texto literal                                                                                                                                                                                                      | Interpretación mínima verificable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Evidencia propuesta                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2.5.1  | `Inventario reproducible de todos los enlaces del snapshot activo hacia hosts de 4Geeks, clasificados en lección, herramienta y marketing, con documentos de origen.`                                              | Existe un comando/derivación que, partiendo del snapshot activo (SELECT de solo lectura o `content/`, idéntico a él), extrae todas las URL absolutas cuyo host pertenece a 4Geeks (`4geeks.com` y subdominios, `4geeksacademy.com`), las agrupa por URL canónica, cuenta ocurrencias y lista documentos de origen e idioma. Clases: `lesson` (`/lesson/`, `/es/lesson/`, `/en/lesson/`), `tool` (`diagram.`, `learn.`, `playground.`), `marketing` (resto de `4geeksacademy.com` y home de `4geeks.com`). Medición de esta auditoría (§2): **1463 ocurrencias, 49 URL canónicas, 180 documentos origen** (172 renderizables; 90 `.es.md` + 90 `.md`). `breathecode.herokuapp.com` se documenta como servicio BreatheCode descubierto, fuera de las tres clases archivables. | Script de inventario (función pura testeable) + test que recorre el snapshot con PGlite y afirma los totales por host/clase; verificación cruzada read-only contra la base (Apéndice A).                                                                            |
| AC-2.5.2  | `Las lecciones externas enlazadas (todas las URL únicas de lección, en cada idioma) se archivan en la base propia de forma literal (contenido y sus imágenes), con URL original, fecha de captura, método y hash.` | De las **8 URL únicas de lección** (§2.4): 5 resuelven a 3 ficheros Markdown reales y se archivan literales (con sus imágenes descargadas); 3 son slugs retirados sin fuente pública ni captura Wayback y quedan marcados `unavailable` (nunca se inventan). Cada fila guarda `original_url`, `captured_at`, `method`, `content_sha256` y la procedencia (`source_repository`, `source_commit`, `source_path`). "En cada idioma" = cada variante de URL presente en el corpus; se archiva el fichero que la API del registro resuelve para esa URL.                                                                                                                                                                                                                         | CLI de captura (idempotente, `--dry-run`) + tests de integración con PGlite: 5 items `captured` con bytes idénticos al raw pinneado (sha256 recalculado), 3 `unavailable`, y assets de imagen con sha256; ver §3 y §5.2.                                            |
| AC-2.5.3  | `Vista interna del material archivado, marcada de forma visible como "material externo archivado, no forma parte del repositorio", con URL original y fecha de captura.`                                           | Ruta interna `/archive/<host>/<path…>` que muestra el contenido literal archivado con un aviso persistente y visible (no un toast) con el texto exacto pedido, la URL original (enlace externo), la fecha de captura, el método y el hash. Sin edición, resumen, traducción ni reordenación.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Test de página con PGlite/fixture: banner presente con el texto, URL y fecha; `notFound()` si el item no existe o no está `captured`; captura de pantalla en QA.                                                                                                    |
| AC-2.5.4  | `Los enlaces del Markdown hacia lecciones archivadas abren la copia archivada en la app, con acceso al original.`                                                                                                  | El resolvedor de enlaces (`platform/src/course/links.ts`) consulta un índice de material archivado por URL canónica; si el `href` es una lección `captured`, devuelve un enlace interno a `/archive/…`; la vista archivada enlaza al original. El resto de enlaces externos no cambia.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Tests unitarios de `resolveMarkdownHref` con las URL reales del corpus: `4geeks.com/lesson/how-to-start-a-project` → `/archive/4geeks.com/lesson/how-to-start-a-project`; marketing y URL no archivadas → `external`; los 3 slugs retirados → `external` sin copia. |
| AC-2.5.5  | `Los enlaces a herramientas de 4Geeks conservan el original y muestran un respaldo de Wayback Machine claramente marcado.`                                                                                         | Las 4 URL de herramienta se consultan contra la API pública de disponibilidad de Wayback (§4); el enlace renderizado conserva el original y, **solo si hay captura**, añade un enlace de respaldo etiquetado como Wayback. Si no hay captura (3 de 4), se muestra solo el original con un estado neutro. Nunca se envía nada a Save Page Now sin permiso.                                                                                                                                                                                                                                                                                                                                                                                                                   | Test de renderer: tool con `backup` → dos enlaces marcados; tool sin `backup` → solo el original; datos reales de §4 (1 captura).                                                                                                                                   |
| AC-2.5.6  | `Los enlaces de marketing quedan intactos.`                                                                                                                                                                        | Las 37 URL de marketing (`4geeksacademy.com/*`, home de `4geeks.com`; 1315 ocurrencias) no entran en el índice de archivo: el resolvedor las devuelve como `external` exactamente igual que hoy (target `_blank`, `rel="noopener noreferrer"`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Test con las URL de marketing reales más frecuentes (`https://4geeksacademy.com/es/comparar-programas`, `https://4geeksacademy.com/en/career-programs/full-stack`, …) → `{ kind: "external" }` sin backup; el índice de archivo no contiene hosts de marketing.     |
| AC-2.5.7  | `Captura idempotente con CLI propio (--dry-run), sin efectos en el snapshot SOURCE.`                                                                                                                               | Existe `pnpm archive:external` con `--dry-run`; repetir la captura con el mismo contenido no inserta filas nuevas ni actualiza `captured_at` (clave `canonical_url`; hash igual ⇒ sin cambios). El CLI solo lee `source_files` (SELECT) y escribe en `external_archive_*`; jamás toca tablas `source_*` ni el snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Test de integración con PGlite: primera ejecución inserta; segunda → 0 cambios; `--dry-run` → 0 cambios y 0 escrituras (spy); `count(*)` de `source_files`/`source_snapshots` idéntico antes y después.                                                             |
| AC-2.5.8  | `Leer el material archivado no requiere ningún host de 4Geeks en tiempo de ejecución.`                                                                                                                             | La vista `/archive/…` lee solo de `external_archive_items`/`external_archive_assets` de la base propia; las imágenes se sirven desde `/archive-assets/<sha256>`. Los enlaces al original y a Wayback son enlaces iniciados por el usuario, no cargas del servidor. Ninguna petición saliente en el render.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Test de página/route handler con fetch global espiado (0 llamadas) y base PGlite; grep de que el código de render no importa hosts externos; QA con red de hosts bloqueada.                                                                                         |
| AC-2.5.9  | `ADR que define la clase de material externo archivado, separada de SOURCE.`                                                                                                                                       | `DECISIONS.md` incorpora el **ADR-020** propuesto en §5.5: añade la clase `EXTERNAL_ARCHIVE` junto a SOURCE/USER/AI_RESPONSE de `CONTENT_CONTRACT.md`, con tablas propias, procedencia, literalidad y marcado, y explica por qué no contradice `SOURCE_OF_TRUTH.md` (la única fuente de contenido educativo oficial sigue siendo el repo; el archivo es material enlazado, literal y marcado).                                                                                                                                                                                                                                                                                                                                                                              | Revisión del ADR + test que afirma que las tablas `external_archive_*` existen separadas y que el guard `platform/src/test/no-hardcoded-catalog.test.ts` sigue en verde.                                                                                            |
| AC-2.5.10 | `Ningún elemento educativo inventado: el archivo es literal y sin resúmenes ni traducciones.`                                                                                                                      | El contenido almacenado es byte a byte el Markdown servido por la fuente (hash recalculado); no hay resúmenes, traducciones, títulos ni descripciones generadas. Los únicos textos añadidos son copys neutros de interfaz (banner, "Ver original", "Capturado el …"). El título de la vista, si se muestra, es literal (frontmatter/H1 del propio documento o `title` de la API). La reescritura de URLs relativas de imagen para servirlas en propio se hace **en render** (no muta el contenido guardado), como ya hace ADR-015 con los enlaces.                                                                                                                                                                                                                          | Test que compara el `content` almacenado con el fixture real (sha256); test de render que verifica que no se añade texto educativo; guard AC-0.10 verde (§6.4).                                                                                                     |

### 1.1 Ambigüedades señaladas

1. **"hosts de 4Geeks".** Se consideran dominios propios: `4geeks.com`, `*.4geeks.com` (`diagram`, `learn`, `playground`), `4geeksacademy.com` (todo su tráfico marketing redirige hoy al mismo sitio de `4geeks.com`, verificado con `robots.txt`), y se documenta aparte `breathecode.herokuapp.com` (API/telemetría de BreatheCode) por ser servicio del bootcamp, no enlace de contenido. No aparece `breatheco.de`, `4geeks.io` ni otros dominios en el corpus.
2. **"todas las URL únicas de lección, en cada idioma" (AC-2.5.2).** Hay 8 strings de URL únicos que corresponden a 5 slugs; varios son la misma página con prefijo de idioma (`/es/lesson/…`). Se archiva **cada URL canónica** del corpus; las que resuelven al mismo fichero comparten `content_sha256`. Tres slugs retirados no tienen fuente pública ni captura: quedan `unavailable` (pregunta 2, §7).
3. **"marketing" (AC-2.5.1/6).** Se clasifica como marketing todo `4geeksacademy.com/*` (páginas de carrera, bootcamps, comparador) y el home `https://4geeks.com`; son 37 URL y 1315 ocurrencias. No se archivan: AC-2.5.6 pide dejarlos intactos.
4. **"herramientas" (AC-2.5.1/5).** Se clasifican por subdominio (`diagram.`, `learn.`, `playground.`): 4 URL y 26 ocurrencias. "Herramienta" no implica archivar su contenido (son apps interactivas con login); el AC pide conservar el original y mostrar respaldo Wayback si existe.
5. **Alcance del archivado.** Solo se archivan las URL de **lección** referenciadas por el corpus. No hay archivado recursivo de los enlaces internos que aparecen dentro de las lecciones (p. ej. `4geeks.com/lesson/how-to-use-github-codespaces`): el límite es el corpus (§6.1, riesgo 4). El material de marketing ajeno (`github.com`, `user-images.githubusercontent.com`, `storage.googleapis.com`) se descarga **solo como imagen de una lección archivada**, no se archiva por sí mismo.
6. **Idempotencia y snapshot.** El archivo no se versiona por snapshot: es global, direccionado por URL canónica y hash. Reingestar o cambiar de snapshot no lo invalida; el CLI puede re-ejecutarse para descubrir enlaces nuevos sin duplicar los existentes.
7. **`.learn/**` no renderiza.** 16 de los 180 documentos con enlaces a 4Geeks no tienen vista Markdown en la app (`.learn/example`, `.learn/solution`, README de `content/contexts/`). Se inventarían igual (AC-2.5.1) pero la reescritura de enlaces de AC-2.5.4 solo puede observarse en los 172 documentos con vista. No requiere tratamiento especial en el render.

---

## 2. Inventario real de enlaces a hosts de 4Geeks (AC-2.5.1)

### 2.1 Método y reconciliación

1. **Extracción local**: recorrido de los 899 archivos de `content/` (todos los tipos textuales: `md`, `json`, `csv`, `html`, `css`, `js`, `sql`, `txt`, `ipynb`), regex de URL absoluta, normalización de la puntuación final y del `/` final, filtro por host propio. Los scripts vivieron fuera del repo.
2. **Reconciliación `content/` ↔ snapshot activo** (read-only): `git ls-tree -r HEAD -- content/` → **899 archivos**; DB → **899 filas**; faltantes en un lado = 0; `blob_sha` distintos = **0**. Por tanto el inventario local es literalmente el del snapshot importado.
3. **Verificación cruzada en base** (misma transacción READ ONLY): los conteos por host calculados en SQL coinciden con los locales salvo la diferencia de regex documentada en §2.8 (dos URL de `playground` pegadas a Markdown malformado). Conteo DB de `docs con enlaces a 4geeks.com/lesson`: **84**, idéntico al local.

### 2.2 Totales por host

| Host                                           | Ocurrencias | URL canónicas | Clases                                        |
| ---------------------------------------------- | ----------: | ------------: | --------------------------------------------- |
| `4geeksacademy.com`                            |        1143 |            36 | marketing (todas)                             |
| `4geeks.com`                                   |         294 |             9 | 122 lección + 172 home (marketing)            |
| `diagram.4geeks.com`                           |          14 |             1 | herramienta                                   |
| `playground.4geeks.com`                        |           8 |             2 | herramienta                                   |
| `learn.4geeks.com`                             |           4 |             1 | herramienta                                   |
| **Total**                                      |    **1463** |        **49** | lección 122 · herramienta 26 · marketing 1315 |
| `breathecode.herokuapp.com` (fuera de alcance) |          80 |             — | infra BreatheCode (78 `learn.json` + 2 docs)  |

### 2.3 Totales por clase y documentos de origen

"Docs origen" son documentos únicos (un documento puede aparecer en varias clases). La columna de idioma cuenta documentos únicos `.es.md` / `.md`.

| Clase       | Ocurrencias | URL canónicas | Docs origen | Docs con vista Markdown | Docs `.es.md` / `.md` |
| ----------- | ----------: | ------------: | ----------: | ----------------------: | --------------------- |
| lección     |         122 |             8 |          84 |                      84 | 42 / 42               |
| herramienta |          26 |             4 |          16 |                      10 | 8 / 8                 |
| marketing   |        1315 |            37 |         174 |                     172 | 87 / 87               |
| **unión**   |        1463 |            49 |     **180** |                 **172** | **90 / 90**           |

Los 180 documentos únicos incluyen 90 `.es.md` y 90 `.md`; 172 son renderizables (los 8 restantes son `.learn/**` y los dos README raíz de contextos). El Apéndice B lista documento a documento las URL de lección y herramienta (las relevantes para archivar).

### 2.4 URL de lección (8 canónicas, 122 ocurrencias) y resolubilidad

| URL canónica (normalizada)                                               | Ocurrencias | Docs | Resolución hoy                          | Fuente de contenido                                                 |
| ------------------------------------------------------------------------ | ----------: | ---: | --------------------------------------- | ------------------------------------------------------------------- |
| `https://4geeks.com/lesson/how-to-start-a-project`                       |          90 |   67 | API asset 916 (`lang=us`)               | `breatheco-de/knowledge-base` → `content/how-to-start-a-project.md` |
| `https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion`  |           9 |    7 | API 404; sin captura Wayback            | **ninguna** (`unavailable`)                                         |
| `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` |           8 |    8 | API asset 920 (`lang=es`)               | `…/how-to-start-a-project.es.md`                                    |
| `https://4geeks.com/lesson/what-is-github-codespaces`                    |           6 |    6 | API asset 915 (`lang=us`)               | `…/what-is-github-codespaces.md`                                    |
| `https://4geeks.com/es/lesson/how-to-start-a-coding-project`             |           5 |    3 | API 404; sin captura Wayback            | **ninguna** (`unavailable`)                                         |
| `https://4geeks.com/lesson/como-comenzar-un-proyecto-de-codificacion`    |           2 |    1 | API asset 920 (mismo fichero ES)        | `…/how-to-start-a-project.es.md`                                    |
| `https://4geeks.com/es/lesson/how-to-start-a-project`                    |           1 |    1 | API asset 916 (traducción ES declarada) | `…/how-to-start-a-project.es.md`                                    |
| `https://4geeks.com/lesson/how-to-start-a-coding-project`                |           1 |    1 | API 404; sin captura Wayback            | **ninguna** (`unavailable`)                                         |

Resumen: **5 URLs → 3 ficheros Markdown** (2 en inglés, 1 en español) capturables; **3 URLs / 15 ocurrencias** sin fuente pública. La API confirma que `como-comenzar-un-proyecto-de-codificacion` es la traducción de `how-to-start-a-project` (`translations: {us: how-to-start-a-project, es: como-comenzar-un-proyecto-de-codificacion}`) y que `what-is-github-codespaces` declara traducción ES (`tutorial-de-github-codespaces`, fichero `content/what-is-github-codespaces.es.md`), aunque el corpus solo enlaza su URL inglesa.

### 2.5 URL de herramienta (4 canónicas, 26 ocurrencias)

| URL canónica                                        | Ocurrencias | Docs | Estado hoy (2026-10-02)                                           | Captura Wayback (§4)                 |
| --------------------------------------------------- | ----------: | ---: | ----------------------------------------------------------------- | ------------------------------------ |
| `https://diagram.4geeks.com`                        |          14 |   10 | 200 `text/html`                                                   | **no**                               |
| `https://playground.4geeks.com/tracker/api/v1/docs` |           6 |    4 | 200 `text/html`                                                   | **sí**: `20260613092255`, status 200 |
| `https://playground.4geeks.com/tracker/api/v1`      |           2 |    2 | 404 `application/json`                                            | **no**                               |
| `https://learn.4geeks.com`                          |           4 |    2 | vivo (destino del 301 de 4geeks.com); `robots.txt`: `Disallow: /` | **no**                               |

### 2.6 Documentos de origen por URL (resumen)

- **Lecciones**: 84 documentos, todos renderizables y todos README de proyecto (nunca contextos ni lecciones internas). Pares reales: `how-to-start-a-project` aparece en 26 `.es.md` + 41 `.md`; la variante ES `como-comenzar…` en 8 `.es.md`; `what-is-github-codespaces` en 3 + 3. Las 3 URL retiradas viven en 11 documentos únicos (10 `.es.md` + 1 `.md`). Listado completo en Apéndice B.
- **Herramientas**: 16 documentos: `diagram` en 10 (5 pares ES/EN de 3 proyectos), `playground` en 4 (par de `ai-eng-milestone-frontend-development`), `learn` en 2 (par de `openclaw-integration`). Solo `diagram` y `playground/docs` se usan también fuera de `.learn/**`.
- **Marketing**: 174 documentos (172 renderizables); cada README de proyecto lleva el bloque común de enlaces de carrera de 4Geeks. No se archiva (AC-2.5.6).

### 2.7 Dominios descubiertos y descartes

- `4geeksacademy.com` no sirve contenido propio: su `robots.txt` responde 308 → `https://www.4geeksacademy.com/robots.txt` → 200 en `https://4geeks.com/robots.txt`; es el mismo sitio.
- `api.4geeks.com` existe pero responde `DEPLOYMENT_NOT_FOUND` (Vercel). `api.breatheco.de` no responde (timeout 25 s). El único API vivo localizado es `https://breathecode.herokuapp.com/v1/registry/asset/<slug>` (§3.3).
- `breathecode.herokuapp.com`: 78 `learn.json` contienen `"batch": "https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=<id>"` (telemetría, requiere auth) y 2 documentos de referencia (`openclaw-integration/STUDENT_API_CALLS_REFERENCE*.md`) lo citan. `learn.json` no se renderiza en la app (ADR-017) y la telemetría no es contenido: **fuera de alcance**, documentado para que el inventario sea completo.

### 2.8 Comparación con la medición del coordinador

El coordinador midió ~1461 ocurrencias, 53 URL únicas y ~6 páginas de lección. Esta auditoría mide **1463 ocurrencias y 49 URL canónicas normalizadas** (52 strings sin normalizar). Diferencias explicadas: (a) dos URL de `playground` aparecen pegadas a Markdown malformado (`…/docs](https://…/docs`) y cuentan una vez cada una tras normalizar (el conteo SQL que no excluye `]` pierde dos ocurrencias); (b) el string `https://learn.4geeks.com` aparece además con una comilla invertida final en el texto, lo que da 53 strings sin normalizar; (c) las "~6 páginas de lección" son en realidad **5 slugs** tras normalizar idioma, de los cuales solo **3 tienen contenido público capturable**. Los datos del coordinador son consistentes con los medidos.

---

## 3. Estrategia de captura fiel (AC-2.5.2)

### 3.1 Qué se midió (peticiones GET de solo lectura)

1. **`robots.txt`**
   - `https://4geeks.com/robots.txt` → 200: `User-agent: * / Allow: /` con `Disallow: /api/`, `/private/`, `/preview-frame`, `/health`; además permite explícitamente GPTBot, ClaudeBot, anthropic-ai, PerplexityBot, etc.
   - `https://learn.4geeks.com/robots.txt` → 200: **`User-agent: * / Disallow: /`** (todo el host prohibido para crawlers).
   - `https://diagram.4geeks.com/robots.txt` → 404; `https://playground.4geeks.com/robots.txt` → 404 (sin restricciones declaradas).
   - `https://raw.githubusercontent.com/robots.txt` → 404; `https://web.archive.org/robots.txt` → 404; `https://breathecode.herokuapp.com/robots.txt` → 404.
2. **Redirección de las lecciones.** `GET https://4geeks.com/lesson/how-to-start-a-project` → **301** con cabecera `Location: https://learn.4geeks.com/lesson/how-to-start-a-project` y `X-Robots-Tag: index, follow`; el `Set-Cookie: 4g_redir_trace` revela que el redirect está declarado en `site_4geeks-com/custom-redirects.yml` (`matchType: fallback`). Lo mismo para `es/lesson/como-comenzar…`, `lesson/what-is-github-codespaces` y los slugs retirados. **El HTML de las lecciones ya no vive en `4geeks.com`; vive en `learn.4geeks.com`, que prohíbe el rastreo.**
3. **API pública del registro de assets.** `GET https://breathecode.herokuapp.com/v1/registry/asset/how-to-start-a-project` → **200 JSON**; extracto literal:
   ```json
   {
     "id": 916,
     "slug": "how-to-start-a-project",
     "title": "How to start coding a project",
     "lang": "us",
     "asset_type": "LESSON",
     "visibility": "PUBLIC",
     "url": "https://github.com/breatheco-de/knowledge-base/blob/main/content/how-to-start-a-project.md",
     "readme_url": "https://github.com/breatheco-de/knowledge-base/blob/main/content/how-to-start-a-project.md",
     "translations": {
       "us": "how-to-start-a-project",
       "es": "como-comenzar-un-proyecto-de-codificacion"
     }
   }
   ```
   La API resuelve slug → fichero Markdown del repositorio público `breatheco-de/knowledge-base` (id. 920 para la variante ES apunta a `how-to-start-a-project.es.md`; 915 para `what-is-github-codespaces.md`).
4. **Repositorio público.** `https://api.github.com/repos/breatheco-de/knowledge-base` → 200, `private: false`, `default_branch: main`, `pushed_at: 2026-03-13T18:03:51Z`, **sin licencia declarada** (`license: null`), ~10,6 MB. Commit de `main` auditado: `8f3c556fbe2dd7c3c129b4e000c642ff570a1b7a`. Los 3 ficheros existen; `GET https://raw.githubusercontent.com/breatheco-de/knowledge-base/8f3c556f…/content/how-to-start-a-project.md` → **200, 6100 bytes**.
5. **Muestra del HTML renderizado.** La captura Wayback de `https://4geeks.com/lesson/how-to-start-a-project` (2026-05-13) pesa 231 123 bytes, contiene el texto del artículo ("Using a template") y elementos `class="markdown-body light css-…"`: el artículo iba renderizado en el HTML servido (SSR), no cargado de una API en cliente.

### 3.2 Comparativa de opciones

| Criterio         | A) HTML renderizado + extracción                                                                                                                                        | B) API del registro → Markdown crudo del repo pinneado (recomendada)                                                                                                                                            | C) Solo clonar `knowledge-base` y mapear a mano                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fidelidad        | Media: el HTML contiene el artículo, pero con chrome de UI, TOC, code highlighting y URLs de imagen reescritas; requiere extractor y puede perder frontmatter.          | **Máxima**: es el Markdown literal que el registro declara como fuente del asset; el render de la app archiva exactamente ese texto.                                                                            | Máxima en contenido, pero el mapeo slug→fichero no está en el repo (la URL ES se llama `how-to-start-a-project.es.md`): exige mantener una tabla manual o resolver igualmente por API. |
| Estabilidad      | Baja: depende del maquetado del sitio; además hoy el host de lecciones es `learn.4geeks.com` (robots `Disallow: /`), así que la captura automática **no es admisible**. | Alta: se fija `commit_sha` + `source_path` + `sha256`; GitHub raw es estable; la API solo se usa en captura, no en runtime.                                                                                     | Alta, pero exige clonar todo el repo (~10,6 MB) por ~19 KB de contenido.                                                                                                               |
| Imágenes         | Habría que extraerlas del DOM (URLs reescritas a CDN).                                                                                                                  | Se obtienen del propio Markdown y se descargan aparte; 19 referencias, 3 orígenes (raw.githubusercontent, user-images.githubusercontent, github.com/…?raw=true → normalizable a raw).                           | Igual que B, con resolución manual de rutas.                                                                                                                                           |
| Idioma           | El prefijo `/es/` decide la página.                                                                                                                                     | La API expone `lang` y `translations`: mapeo explícito y auditable.                                                                                                                                             | Manual.                                                                                                                                                                                |
| Legalidad/robots | Problemática: el contenido canónico vive en un host con `Disallow: /`. La vía Wayback es legal pero incompleta (solo hay captura de 3 de las 8 URL).                    | Correcta: `robots.txt` de la API y de `raw.githubusercontent.com` no restringen; contenido público de un repositorio público (sin licencia declarada, uso personal offline marcado; ver riesgo 1 y pregunta 3). | Igual que B (el clon de un repo público está permitido por los ToS de GitHub).                                                                                                         |

### 3.3 Recomendación

**Opción B**, con este procedimiento en el CLI (§5.2):

1. Inventario de URL de lección del snapshot (SELECT de solo lectura) y normalización.
2. Para cada URL: `GET https://breathecode.herokuapp.com/v1/registry/asset/<slug>` (público, sin login). Del JSON se guardan como procedencia `title`, `lang`, `translations`, `url`, `readme_url`; el `url` da `owner/name` y `path` en `breatheco-de/knowledge-base`.
3. Se fija el commit de `main` consultado (`GET /repos/breatheco-de/knowledge-base/commits/main`) y se descarga `https://raw.githubusercontent.com/breatheco-de/knowledge-base/<commit>/<path>` (probado: 200).
4. Se calcula `sha256` del texto (bytes exactos) y se guarda literal. Verificación de que el `blob?raw=true` de `github.com` se normaliza a `raw.githubusercontent.com/<owner>/<name>/<commit>/<path>`.
5. Imágenes: se extraen las referencias `![…](url)` del Markdown y se descargan por URL (misma política de robots); se guardan por `sha256`. En el HTML archivado se reescriben a `/archive-assets/<sha256>` **en tiempo de render** (el `content` guardado no se muta).
6. Si la API responde 404 y Wayback no tiene captura → fila `unavailable` con el intento registrado; nunca se inventa contenido.

Evidencia de la muestra capturada en esta auditoría (valores reales):

| Fichero fuente                         | Bytes | sha256                                                             |
| -------------------------------------- | ----: | ------------------------------------------------------------------ |
| `content/how-to-start-a-project.md`    |  6100 | `9261997020916708e1a9b7f88417a2a5baaacb49f654eb0e6a92126dde6b1a2e` |
| `content/how-to-start-a-project.es.md` |  6743 | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` |
| `content/what-is-github-codespaces.md` |  6429 | `a14968e4ad5c9991221370e9c9f6ae3c4f114c427b62d59fb5491ed7129734f6` |

### 3.4 Imágenes: obtención y almacenamiento

- **Referencias reales de los 3 ficheros**: `how-to-start-a-project(.es).md` → 7 cada uno (1 `raw.githubusercontent.com/breatheco-de/knowledge-base/main/images/template.png` + 6 `user-images.githubusercontent.com/109599459/…`); `what-is-github-codespaces.md` → 5, todas `github.com/breatheco-de/…/blob/main/…?raw=true` (3 del propio `knowledge-base/images/`, 1 de `breatheco-de/content` y 1 de `knowledge-base/images/e7094b07….png`). Total 19 referencias, ~9 ficheros únicos (hay repetidos entre EN/ES).
- **No hay contenido dinámico**: 0 `<iframe>` y 0 `<video>` en los 3 ficheros. El Markdown es estático; las imágenes son raster.
- **Dónde guardarlas**: **tabla propia, no `source_blobs`**. `source_blobs` es una tabla SOURCE (bytes de binarios del snapshot, clave `blob_sha` = SHA-1 git calculado por la ingesta). Meter bytes externos ahí mezclaría clases (AC-2.5.9/ADR-020) y falsearía la semántica de `blob_sha`. Se propone `external_archive_assets` direccionada por contenido con **SHA-256** (no git blob SHA) y una tabla puente `external_archive_item_assets` (item, URL original literal, `alt` literal) que permite deduplicar una misma imagen entre items/idiomas.
- **Servido**: `GET /archive-assets/<sha256>` con el mismo patrón de seguridad que `/source-files/` (allowlist de tipos raster, `nosniff`, CSP `sandbox`, `ETag` = sha256, caché inmutable de un año por ser direccionamiento por contenido).

### 3.5 Cobertura real obtenida

- 5 URL de lección → 3 ficheros `captured` (más sus imágenes).
- 3 URL de lección retiradas (`como-iniciar-un-proyecto-de-programacion` × 2 paths y `how-to-start-a-coding-project` × 2 paths; 15 ocurrencias) → `unavailable`: la API da 404, el repo no tiene esos ficheros en su historia y Wayback no tiene capturas (§4). No hay fuente legítima que archivar; se conservará el enlace original con aviso neutro (pregunta 2).
- `learn.4geeks.com` solo aparece como destino de login/instrucciones; no se archiva su HTML (robots) y no hace falta: las lecciones se capturan del registro.

### 3.6 Legalidad y robots (resumen operativo para el CLI)

- **Nunca** pedir `learn.4geeks.com` (Disallow total). El redirect de `4geeks.com` hasta ahí se registra como metadato, pero no se sigue.
- **Nunca** pedir `4geeks.com/api/*` (Disallow explícito).
- `diagram.`/`playground.`: robots 404 ⇒ permitido; si se capturase HTML se haría con GET puntual, pero AC-2.5.5 solo pide enlace de respaldo Wayback (no copia).
- API BreatheCode y `raw.githubusercontent.com`: robots 404, sin restricciones declaradas; contenido público.
- `web.archive.org`: solo se consulta su API pública `wayback/available`; no se descarga HTML de Wayback en runtime.
- El repo `knowledge-base` **no declara licencia**: la copia se guarda para consulta personal offline, marcada como material externo y sin redistribución (pregunta 3).

---

## 4. Herramientas y respaldo Wayback (AC-2.5.5)

### 4.1 Consultas reales a `https://archive.org/wayback/available?url=…`

| URL consultada                                                           | Resultado                                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://diagram.4geeks.com/`                                            | `archived_snapshots: {}` — **sin captura**                                                                                                  |
| `https://playground.4geeks.com/tracker/api/v1/docs`                      | captura **2026-06-13 09:22:55**, status 200 → `http://web.archive.org/web/20260613092255/https://playground.4geeks.com/tracker/api/v1/docs` |
| `https://playground.4geeks.com/tracker/api/v1`                           | **sin captura**                                                                                                                             |
| `https://learn.4geeks.com`                                               | **sin captura**                                                                                                                             |
| `https://4geeks.com/lesson/how-to-start-a-project`                       | captura **2026-05-13 11:11:06**, status 200                                                                                                 |
| `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` | captura **2026-05-13 11:11:07**, status 200                                                                                                 |
| `https://4geeks.com/lesson/what-is-github-codespaces`                    | captura **2026-05-20 16:00:03**, status 200                                                                                                 |
| `https://learn.4geeks.com/lesson/how-to-start-a-project`                 | captura **2026-08-22 09:39:10**, status 200                                                                                                 |
| 3 slugs de lección retirados (4 URL)                                     | **sin captura**                                                                                                                             |

### 4.2 Cómo mostrar el respaldo

- `external_archive_items` guarda, para tools, `wayback_url`, `wayback_captured_at` y `wayback_http_status` obtenidos en captura (no en runtime).
- En el Markdown, un enlace a herramienta se resuelve como `external` normal **más** un `backup` opcional: el renderer pinta el enlace original y, si existe respaldo, un segundo enlace pequeño y claramente etiquetado ("Respaldo en Wayback Machine" / "Wayback Machine backup") con la fecha, `target="_blank"` y `rel="noopener noreferrer"`.
- Si no hay captura (3 de 4 herramientas), se muestra solo el original; la vista de archivo/tool puede indicar de forma neutra "Sin respaldo archivado disponible" (copy de interfaz permitido).
- Datos reales: solo `playground.4geeks.com/tracker/api/v1/docs` tendrá respaldo hoy; `diagram.4geeks.com`, `playground…/api/v1` (además hoy 404) y `learn.4geeks.com` no.

### 4.3 Save Page Now

No se ha llamado a Save Page Now (sería una escritura en un servicio externo y requiere permiso). Queda como **pregunta 1** (§7): si el usuario lo autoriza, el CLI tendría un modo explícito `--request-wayback` (nunca por defecto) para esas 3–4 URL.

---

## 5. Modelo de datos, CLI, integración y ADR-020 (AC-2.5.3/4/5/7/9)

### 5.1 Tablas nuevas (clase EXTERNAL_ARCHIVE, separada de SOURCE)

```text
external_archive_items
  id                uuid pk default gen_random_uuid()
  original_url      text not null          -- tal cual aparece en el corpus
  canonical_url     text not null unique   -- host en minúsculas, sin barra final
  kind              text not null check (kind in ('lesson','tool'))
  host              text not null
  language          text null check (language in ('es','en'))
  title             text null              -- literal (frontmatter/H1/API); nunca generado
  content           text null              -- Markdown literal (solo lessons capturadas)
  content_sha256    text null
  content_format    text null check (content_format = 'markdown')
  source_repository text null              -- p. ej. breatheco-de/knowledge-base
  source_commit     text null              -- commit pinneado (40 hex)
  source_path       text null              -- path dentro del repo fuente
  captured_at       timestamptz not null
  method            text not null check (method in ('registry-api+github-raw','wayback-metadata','manual'))
  http_status       integer null
  wayback_url       text null
  wayback_captured_at timestamptz null
  wayback_http_status integer null
  status            text not null check (status in ('captured','unavailable','error'))
  last_error        text null              -- redactado
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()

external_archive_assets          -- bytes de imágenes; direccionado por contenido
  sha256        text pk
  bytes         bytea not null
  content_type  text not null
  byte_size     integer not null
  source_url    text not null              -- URL de la que se descargó
  captured_at   timestamptz not null

external_archive_item_assets     -- relación item ↔ imagen, con URL y alt literales
  item_id       uuid not null references external_archive_items(id) on delete cascade
  asset_sha256  text not null references external_archive_assets(sha256) on delete restrict
  original_url  text not null              -- URL tal cual en el Markdown
  alt           text null                  -- alt literal
  primary key (item_id, original_url)
```

- PK natural de idempotencia: `canonical_url` único por item; `sha256` por asset.
- Índice por `kind`, `status`, `host`, `language`.
- `ENABLE ROW LEVEL SECURITY` en las tres tablas, sin políticas (mismo patrón que el store SOURCE); el servidor/CLI usan la conexión owner.
- Migración nueva única (`platform/drizzle/0002_*.sql`), dueño único W0 (§6.2).

### 5.2 CLI de captura idempotente

```json
"archive:external": "tsx --env-file-if-exists=.env.local src/external-archive/cli.ts"
```

Flags: `--dry-run` (por defecto: inventario + plan, sin red y sin escrituras), `--resolve` (con `--dry-run`: valida resolubilidad con GETs, sin escribir), `--only lessons|tools`, `--from-db` (default) `| --from-dir <content>`, `--limit N`, `--request-wayback` (deshabilitado por defecto; pregunta 1), `--report json|text`.

Flujo:

1. **Inventario** (solo lectura): mismo extractor del §2 sobre el snapshot activo (o `--from-dir`), normalización y clasificación.
2. **Lecciones**: resolver por API → pin de commit → raw Markdown → `sha256`; descargar imágenes del Markdown; `UPSERT` por `canonical_url`.
3. **Herramientas**: consulta Wayback availability (solo lectura) y `UPSERT` de metadatos.
4. **Idempotencia**: si `content_sha256` (y metadatos Wayback) no cambian, no se actualiza la fila; el reporte dice "sin cambios". `captured_at` solo cambia en una recaptura real con hash distinto.
5. **Aislamiento SOURCE**: el CLI únicamente ejecuta `SELECT` sobre `source_files`; escribe solo en `external_archive_*`; ninguna migración toca tablas SOURCE.
6. **Robots**: caché por host; `Disallow` ⇒ se omite la URL; error de red al leer `robots.txt` ⇒ fail-closed (se omite y se registra). Lista negra explícita: `learn.4geeks.com`, `4geeks.com/api/*`.

### 5.3 Integración con el resolvedor de enlaces (`platform/src/course/links.ts`)

Se amplía el contrato de `links.ts` (dueño W2, §6.3) con un índice opcional por URL canónica:

- **Paso 3 actual** (`http(s)` → externo) pasa a consultar antes `context.externalArchive.get(canonical(rawHref))`:
  - lección `captured` → nuevo `MarkdownUrl` `kind: "external-archive"` con `href: "/archive/<host>/<path…>"`, `originalHref` y `archiveId`;
  - herramienta con `wayback_url` → `kind: "external"` con `backup: { href, capturedAt }` (el original no cambia);
  - marketing o URL sin archivo → igual que hoy (`external` intacto, AC-2.5.6).
- `MarkdownResolutionContext` recibe `externalArchive?: ReadonlyMap<string, ExternalArchiveLink>`; el `CourseReader` lo construye una vez por request (`createExternalArchiveIndex()`) y lo memoiza junto al snapshot.
- El renderizado de imagen en `SourceMarkdown` resuelve URLs de imágenes archivadas a `kind: "archive-asset"` (`/archive-assets/<sha256>`) mediante el mismo resolvedor; no hay peticiones salientes (AC-2.5.8).
- Los enlaces dentro de una lección archivada que apunten a otras lecciones **también archivadas** se resuelven a `/archive/…`; los que no estén en el índice quedan externos (límite no recursivo, §6.1).

### 5.4 Ruta, vista y idioma global

- **Ruta**: `/archive/[...path]` = `/archive/<host>/<resto-del-path>`, p. ej. `/archive/4geeks.com/lesson/how-to-start-a-project` y `/archive/4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion`. Funciones puras en `routes.ts`: `archiveHref(host, path)` y `parseArchiveTarget(segments)`; el lector resuelve por `canonical_url = https://<host>/<path>` (sin consultar red).
- **Vista**: página server (`await connection()`), `notFound()` si el item no existe; si `status = unavailable`, estado neutro con el enlace original y el texto de interfaz "No hay copia archivada disponible" (ES/EN).
- **Marcado visible (AC-2.5.3)**: aviso persistente encima del contenido, `role="note"`, con el texto literal pedido:
  - ES: `Material externo archivado. No forma parte del repositorio.` + `URL original`, `Capturado el <fecha>`, `Método: <método>`, `Hash: sha256:<hash>`.
  - EN: `Archived external material. Not part of the repository.` + equivalentes.
  - El original se muestra como enlace externo (`target="_blank"`, `rel="noopener noreferrer"`) y, si existe, el respaldo Wayback.
- **Idioma global (ADR-019)**: el item tiene `language`; si la cookie `lang` no coincide y existe item par (mismo `source_path` sin sufijo o `translations` del registro), se muestra el par en el idioma elegido; si no existe, se muestra el disponible con la nota neutra ya existente ("Solo disponible en inglés" / "Only available in Spanish"). No se traduce nada.
- **Contenido**: `SourceMarkdown` con la allowlist de saneado de ADR-014 (el material es externo, XSS obliga); frontmatter oculto (el `title` literal ya se guardó en el item y se usa en la cabecera).
- **Assets**: `GET /archive-assets/<sha256>` con el patrón de `/source-files/` (§3.4).
- **Diseño**: aplican las skills obligatorias (`impeccable`, `emil-design-eng`, `design-taste-frontend`, `shadcn`) y las reglas de H2 (tipografía de prosa, estados neutros, `prefers-reduced-motion`, contraste AA, foco visible). El banner no es un toast ni es descartable: el marcado es el requisito.

### 5.5 ADR-020 propuesto (texto base para `DECISIONS.md`)

> **ADR-020 — Clase `EXTERNAL_ARCHIVE`: material externo enlazado por el corpus, archivado literal y separado de SOURCE**
> Status: Proposed.
>
> `CONTENT_CONTRACT.md` define SOURCE (importado del repo), USER y AI_RESPONSE. El Hito 2.5 añade una cuarta clase: `EXTERNAL_ARCHIVE`.
>
> - **Qué es**: copias literales de material externo (lecciones de `4geeks.com` y metadatos de respaldo Wayback de herramientas) **enlazado por documentos del corpus**, conservadas para que el curso siga consultable si desaparece el acceso a 4Geeks.
> - **Qué no es**: no es contenido oficial del curso, no es SOURCE y no se mezcla con el catálogo. Vive en tablas propias (`external_archive_items`, `external_archive_assets`, `external_archive_item_assets`) y se muestra en una ruta propia marcada (`/archive/…`), con su URL original, fecha de captura, método y hash.
> - **Fidelidad**: se guarda tal cual (Markdown literal, `sha256` verificable); sin resúmenes, traducciones, títulos ni descripciones generadas. Las únicas transformaciones son de render (URLs de imagen a `/archive-assets/…` y reescritura de enlaces), ya permitidas por el contrato de fidelidad.
> - **No contradice `SOURCE_OF_TRUTH.md`**: la única fuente de contenido educativo oficial sigue siendo `4GeeksAcademy/ai-engineering-syllabus`. El archivo es material enlazado desde el propio repo, conservado como cita literal y marcado; no sustituye, resume ni reordena el syllabus.
> - **Runtime**: leer `/archive/…` no requiere ningún host externo; los enlaces al original y a Wayback son acciones del usuario.
> - **Captura**: CLI propio idempotente (`pnpm archive:external`, `--dry-run`), sin escrituras en el snapshot SOURCE ni en sus tablas; respeta `robots.txt` (nunca `learn.4geeks.com`).

---

## 6. Riesgos y plan de implementación

### 6.1 Riesgos

1. **ToS/robots/licencia.** `learn.4geeks.com` prohíbe todo crawler; el repo `knowledge-base` no declara licencia. Mitigación: capturar solo vía API pública + GitHub raw (permitido), nunca `learn.4geeks.com`; copia personal, marcada, sin redistribución; decisión explícita del usuario (pregunta 3).
2. **Fuente legacy/inestable.** La API vive en `breathecode.herokuapp.com` (Heroku legacy) y `api.breatheco.de`/`api.4geeks.com` están caídos. Mitigación: la API solo se usa en captura; el commit y el hash quedan registrados; la recaptura es manual y explícita.
3. **URLs retiradas sin fuente** (3 de 8, 15 ocurrencias). Mitigación: fila `unavailable`, enlace original y aviso neutro; jamás inventar (pregunta 2).
4. **Enlaces internos de las lecciones archivadas.** No hay archivado recursivo: el límite son las URL del corpus. Un enlace dentro de una lección archivada hacia otra lección no archivada seguirá siendo externo (puede fallar sin red). Se documenta en la vista; si el usuario quiere recursión, es un cambio de alcance.
5. **Imágenes parciales.** Una imagen puede fallar (host caído). Mitigación: estado por asset, item `captured` con aviso neutro de imagen no disponible (`alt` literal marcado como roto); dedupe por sha256 evita repetir descargas.
6. **Drift del contenido.** El Markdown puede cambiar en la fuente tras la captura. Mitigación: hash + `captured_at`; recapturar solo con el CLI; el runtime nunca actualiza.
7. **Volumen.** 3 markdown (~19 KB) + ~9 imágenes (~ decenas–cientos de KB): irrelevante para la cuota de Postgres; no confundir con los 6,6 MB de `source_blobs`.
8. **Guard AC-0.10 / no-hardcoded-catalog.** Nada de slugs, títulos ni textos educativos en el código; el inventario y el contenido salen de la base; fixtures de test de los ficheros reales (ADR-009) declarados en su manifiesto.
9. **XSS.** El material es externo; el render reutiliza `rehype-raw` + `rehype-sanitize` (allowlist) y añade test de inyección sobre contenido archivado.
10. **Aislamiento de escritura.** Un solo dueño de la migración; el CLI no escribe en SOURCE; tests afirman conteos de `source_*` inalterados.
11. **RLS/secretos.** Tablas nuevas con RLS sin políticas; nunca imprimir/loguear `DATABASE_URL`; errores redactados con `src/lib/redact.ts`.
12. **Marketing intacto.** Tests dedicados con las URL reales; el índice de archivo no contiene hosts de marketing.
13. **Nuevos snapshots.** El archivo es global por URL canónica, independiente del snapshot; re-ejecutar el CLI añade lo nuevo sin duplicar.
14. **`last_error` y estados.** Un fallo de captura no debe tumbar la UI: se registra en `status='error'`/`last_error` y la vista degrada al estado neutro.

### 6.2 Paquetes paralelos (ownership disjunto)

Premisa: 4 workers + QA. **W0 es el único dueño de `platform/package.json`, `platform/pnpm-lock.yaml` y `platform/drizzle/**`**; ningún otro toca el lockfile ni ejecuta `pnpm install`. Las interfaces de §6.3 se congelan antes de empezar.

| Paquete | Nombre                             | Archivos que posee (exclusivos)                                                                                                                                                                                                              | Depende de                 | AC que cubre                                                      | Tests que añade                                                                                                                                                                            |
| ------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W0      | Esquema + migración + deps         | `platform/drizzle/0002_*.sql`, `platform/drizzle/meta/**`, `platform/src/external-archive/schema.ts`, `platform/src/external-archive/store.ts`, `platform/src/external-archive/types.ts`, `platform/package.json`, `platform/pnpm-lock.yaml` | — (ola 0)                  | AC-2.5.9 (soporte), AC-2.5.7 (store)                              | `store.test.ts` con PGlite: migración aplica, upsert idempotente, RLS activo, assets por sha256                                                                                            |
| W1      | Inventario + CLI de captura        | `platform/src/external-archive/{cli,inventory,urls,registry,github,robots,http,images}.ts`, `platform/fixtures/external-archive/**` (+ manifiesto), sus tests                                                                                | W0 (types)                 | AC-2.5.1, AC-2.5.2, AC-2.5.7                                      | `inventory.test.ts` (totales reales por host/clase), `cli.test.ts` (dry-run sin escrituras, doble ejecución sin cambios), `registry.test.ts` (fixtures reales de la API), `images.test.ts` |
| W2      | Capa `course/` + enlaces           | `platform/src/lib/markdown/types.ts`, `platform/src/course/{links,routes,types,reader,external-archive}.ts`, `platform/src/course/*.test.ts` de esos módulos                                                                                 | Contratos W0/W1 congelados | AC-2.5.4, AC-2.5.5 (resolución), AC-2.5.6, AC-2.5.8 (lectura)     | `links.test.ts` (lección→archivo, tool→backup, marketing intacto), `routes.test.ts`, `external-archive.test.ts` (PGlite: variantes de idioma, unavailable)                                 |
| W3      | Vista `/archive` + assets + render | `platform/src/app/archive/**`, `platform/src/app/archive-assets/**`, `platform/src/components/external-material-banner.tsx`, `platform/src/components/source-markdown.tsx`, `platform/src/components/*archive*.test.tsx`                     | Interfaces W2              | AC-2.5.3, AC-2.5.5 (UI), AC-2.5.8 (sin fetch), AC-2.5.10 (render) | Página: banner literal, URL/fecha/hash, original y backup; `archive-assets` route: tipos/ETag/CSP; render sin peticiones externas                                                          |
| QA      | ADR + docs + aceptación            | `DECISIONS.md` (ADR-020), `platform/README.md`, `docs/milestones/M2B_QA_TECHNICAL.md`, `docs/milestones/M2B_QA_FIDELITY.md`, `platform/src/test/**`                                                                                          | W0-W3 integrados           | Evidencia de todos                                                | `m2b-acceptance.test.ts` (reconciliación, idempotencia, guard AC-0.10 verde, sin hardcode), QA read-only y capturas                                                                        |

Cierre de cada worker: `npx --yes pnpm@12.8.1 --dir platform lint && … typecheck && … test` y `npx --yes prettier@3.8.3 --check .` en `platform/`. Solo W0 toca dependencias/migraciones; los demás no esperan a la instalación porque no añaden paquetes (todas las librerías necesarias ya están: `pg`, `drizzle-orm`, `react-markdown`, etc.).

### 6.3 Interfaces congeladas

```ts
// platform/src/lib/markdown/types.ts — dueño W2
export type MarkdownUrl =
  | { kind: "internal"; href: string; targetPath: string }
  | {
      kind: "source";
      href: string;
      targetPath: string;
      targetKind: "blob" | "tree" | "raw";
    }
  | { kind: "broken"; href: null; rawHref: string }
  | {
      // Lección externa archivada (AC-2.5.4): abre la copia propia.
      kind: "external-archive";
      href: string; // /archive/<host>/<path…>
      originalHref: string;
      archiveId: string;
    }
  | {
      kind: "external";
      href: string;
      // Respaldo Wayback opcional de una herramienta (AC-2.5.5).
      backup?: { href: string; capturedAt: string };
    }
  | {
      // Imagen archivada servida por la app (AC-2.5.8).
      kind: "archive-asset";
      href: string; // /archive-assets/<sha256>
      sha256: string;
    };
```

```ts
// platform/src/course/types.ts — dueño W2
export type ExternalArchiveStatus = "captured" | "unavailable" | "error";

export type ExternalArchiveLink = {
  id: string;
  canonicalUrl: string;
  kind: "lesson" | "tool";
  language: "es" | "en" | null;
  status: ExternalArchiveStatus;
  href: string | null; // ruta interna si lesson captured
  waybackUrl: string | null;
  waybackCapturedAt: string | null;
};

export type ExternalArchiveItem = ExternalArchiveLink & {
  originalUrl: string;
  host: string;
  title: string | null;
  content: string | null;
  contentSha256: string | null;
  sourceRepository: string | null;
  sourceCommit: string | null;
  sourcePath: string | null;
  capturedAt: string;
  method: string;
  httpStatus: number | null;
};
```

```ts
// platform/src/course/external-archive.ts — dueño W2 (solo lectura; null/[] sin base)
export function listArchivedItems(): Promise<ExternalArchiveItem[]>;
export function getArchivedItemByCanonicalUrl(
  url: string,
): Promise<ExternalArchiveItem | null>;
export function getArchivedItemByHref(
  href: string,
): Promise<ExternalArchiveItem | null>;
export function resolveArchivedVariant(
  item: ExternalArchiveItem,
  lang: CourseLanguage,
): Promise<{ item: ExternalArchiveItem; isFallback: boolean }>;
export function createExternalArchiveResolver(
  item: ExternalArchiveItem,
): (rawHref: string) => MarkdownUrl; // mapea imágenes a archive-asset y enlaces a archive/external
export function getArchivedAsset(
  sha256: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null>;
```

```ts
// platform/src/course/routes.ts — dueño W2
export function archiveHref(host: string, path: string): string;
export function parseArchiveTarget(
  segments: readonly string[],
): { host: string; path: string } | null;

// platform/src/course/links.ts — nueva clave opcional del contexto (dueño W2)
export type MarkdownResolutionContext = {
  // …campos actuales…
  externalArchive?: ReadonlyMap<string, ExternalArchiveLink>; // clave: URL canónica
};
```

### 6.4 Olas y cierre

```text
Ola 0: W0 (migración + tipos/store + package.json/lockfile)
Ola 1: W1 (inventario y CLI)          W2 (links/reader/routes con contratos congelados)
Ola 2: W3 (vista y render)            [W1/W2 integrados]
Ola 3: QA (ADR-020, docs, aceptación, QA read-only)
```

Gate final (QA, desde limpio): `install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build` sin `DATABASE_URL`, verificación read-only de que `source_files`/`source_snapshots` no cambiaron, `platform/src/test/no-hardcoded-catalog.test.ts` verde y captura de `/archive/4geeks.com/lesson/how-to-start-a-project`.

---

## 7. Preguntas para el usuario (máximo 3)

1. **"Save Page Now" para las URL sin captura Wayback** (`diagram.4geeks.com`, `learn.4geeks.com`, `playground…/api/v1` —hoy 404— y los 3 slugs retirados). Opciones: (a) **recomendada**: no enviar nada (es una escritura externa y dos destinos son inarchivables); mostrar solo el original con estado neutro; (b) autorizar un modo explícito `--request-wayback` del CLI para pedir captura de las URL vivas. ¿Cuál?
2. **Slugs de lección retirados sin fuente pública** (`como-iniciar-un-proyecto-de-programacion` y `how-to-start-a-coding-project`, 15 ocurrencias). Opciones: (a) **recomendada**: conservar el enlace original y marcar "sin copia archivada" (nunca inventar ni reconstruir el contenido); (b) aportar tú una copia manual si la tienes (el CLI tendría método `manual`); (c) ocultarlos de la UI (rompería la fidelidad del corpus). ¿Cuál?
3. **Licencia de la fuente.** `breatheco-de/knowledge-base` es público pero no declara licencia. Opciones: (a) **recomendada**: confirmar el archivado literal para consulta personal offline, marcado como externo y sin redistribución; (b) limitar la captura a los metadatos (título/URL) y enlazar siempre al original (no cumpliría AC-2.5.2/8). ¿Confirmas (a)?

---

## Apéndice A — Comandos y peticiones de la auditoría (reproducibles, sin secretos)

- Baseline: `git status --porcelain` (limpio), `git branch --show-current` = `m2b-autonomy`, `git log --oneline -3`.
- Reconciliación: `git ls-tree -r HEAD -- content/` (899) contra `SELECT path, blob_sha FROM source_files WHERE snapshot_id = …` (899) en `BEGIN READ ONLY`; 0 faltantes, 0 hashes distintos.
- Inventario: script Node efímero fuera del repo que recorre `content/`, extrae `https?://…`, filtra hosts propios, normaliza `/` final y puntuación, agrupa por URL y clase, y lista documentos e idioma.
- Consulta de verificación en base (READ ONLY):
  ```sql
  WITH matches AS (
    SELECT regexp_matches(f.raw_content, 'https?://[^ )"<>`]+', 'g') AS m
    FROM source_files f
    WHERE f.snapshot_id = $1 AND f.raw_content IS NOT NULL
  )
  SELECT (regexp_matches(m[1], '^https?://([^/]+)'))[1] AS host, count(*)::int AS n
  FROM matches
  WHERE m[1] ~* '://([a-z0-9-]+\.)*(4geeks\.com|4geeksacademy\.com)([/?#]|$)'
     OR m[1] ~* '://breathecode\.herokuapp\.com([/?#]|$)'
  GROUP BY 1 ORDER BY n DESC;
  ```
  Resultado: `4geeksacademy.com 1143`, `4geeks.com 294`, `breathecode.herokuapp.com 80`, `diagram.4geeks.com 14`, `playground.4geeks.com 6` (2 URL pegadas a Markdown malformado), `learn.4geeks.com 4`.
- Peticiones GET externas (solo lectura, sin login): 5+2+1+1+1 `robots.txt`; 6 redirects/estados de lección; 12 a `api.github.com`/`raw.githubusercontent.com`; 8 a la API del registro; 15 a `archive.org/wayback/available`; 1 al HTML de la captura Wayback. Total ≈ 50. Sin escrituras ni envíos a Save Page Now.
- No se ejecutó `pnpm install/build/test/ingest/db:migrate`; no se escribió en la base; `DATABASE_URL` nunca se imprimió.

## Apéndice B — Documentos de origen por URL de lección y herramienta

Leyenda: `[R]` documento con vista Markdown en la app; `[—]` sin vista (no renderiza enlaces).

**Lecciones**

- `https://4geeks.com/lesson/how-to-start-a-project` (90 ocurrencias, 67 docs: 26 `.es.md` + 41 `.md`): `agent-hub-ui-specs-and-prompts/README.md (x2)`; `ai-basic-inventory-agent-loop/README.es.md (x2)` y `README.md (x2)`; `ai-eng-architectural-proposal/README.{es.,}md`; `ai-eng-building-bullet-proof-applications/README.md (x2)`; `ai-eng-error-handling/README.{es.,}md`; `ai-eng-milestone-frontend-development/README.{es.,}md`; `ai-eng-milestone-web-fundamentals/README.md`; `ai-eng-performance-caching/README.md`; `ai-eng-performance-serialization/README.{es.,}md`; `ai-eng-performance-web-vitals/README.{es.,}md`; `ai-eng-real-time-communication/README.{es.,}md`; `ai-eng-real-time-notification/README.{es.,}md`; `ai-eng-user-authentication-api/README.md`; `ai-eng-user-authentication-flows/README.md`; `ai-eng-user-authentication-restore/README.md`; `branch-queue/README.{es.,}md (x2 c/u)`; `collaborative-project-html-tailwind-online-store/README.md`; `company-financial-dashboard-context-project/README.{es.,}md`; `company-financial-dashboard-skills-project/README.{es.,}md` y `README.md (x2)`; `company-financial-dashboard-specs-project/README.es.md` y `README.md (x2)`; `data-modeling-and-class-diagrams-digital-wallet/README.md`; `data-modeling-and-class-diagrams-music-player/README.md`; `designing-data-pipeline/README.{es.,}md`; `edutrack-data-audit-sql-related-tables/README.{es.,}md`; `edutrack-data-audit-sql/README.{es.,}md`; `existing-model-sentiment-analysis-reviews/README.{es.,}md (x2 c/u)`; `html-css-artist-landing-seo-access/README.md`; `launch-ready-containerized-mvp/README.{es.,}md (x2 c/u)`; `nextjs-airbnb-ui-clone/README.md (x2)`; `nextjs-wanderlust-explorer/README.es.md` y `README.md (x2)`; `openclaw-connection/README.{es.,}md`; `openclaw-integration/README.{es.,}md`; `openclaw-memory/README.{es.,}md (x2 c/u)`; `openclaw-setup/README.{es.,}md`; `openclaw-skills/README.{es.,}md (x2 c/u)`; `seats-management-typescript/README.es.md` y `README.md (x2)`; `simple-dashboard-tailwind-css/README.md`; `streamloop-churn-model-tuning/README.md (x2)`; `triage-queue/README.{es.,}md (x2 c/u)`; `voice-to-do-list-api/README.md (x2)`; `vps-ssh-resource-optimization/README.{es.,}md`. Todos `[R]`.
- `https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion` (9, 7 docs `.es.md`, todos `[R]`): `ai-eng-building-bullet-proof-applications (x2)`; `ai-eng-user-authentication-api`; `ai-eng-user-authentication-flows`; `ai-eng-user-authentication-restore`; `data-modeling-and-class-diagrams-digital-wallet`; `data-modeling-and-class-diagrams-music-player`; `streamloop-churn-model-tuning (x2)`. **[unavailable]**
- `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` (8, 8 docs `.es.md`, todos `[R]`): `ai-eng-milestone-web-fundamentals`; `collaborative-project-html-tailwind-online-store`; `company-financial-dashboard-skills-project`; `company-financial-dashboard-specs-project`; `html-css-artist-landing-seo-access`; `nextjs-wanderlust-explorer`; `seats-management-typescript`; `simple-dashboard-tailwind-css`.
- `https://4geeks.com/lesson/what-is-github-codespaces` (6, 6 docs: 3 `.es.md` + 3 `.md`, todos `[R]`): `collaborative-project-html-tailwind-online-store`, `html-css-artist-landing-seo-access`, `simple-dashboard-tailwind-css` (par completo).
- `https://4geeks.com/es/lesson/how-to-start-a-coding-project` (5, 3 docs `.es.md`, todos `[R]`): `agent-hub-ui-specs-and-prompts (x2)`; `chat-interface-real-ai-api`; `voice-to-do-list-api (x2)`. **[unavailable]**
- `https://4geeks.com/lesson/como-comenzar-un-proyecto-de-codificacion` (2, 1 doc `.es.md` `[R]`): `nextjs-airbnb-ui-clone (x2)`.
- `https://4geeks.com/es/lesson/how-to-start-a-project` (1, 1 doc `.es.md` `[R]`): `ai-eng-performance-caching/README.es.md`.
- `https://4geeks.com/lesson/how-to-start-a-coding-project` (1, 1 doc `.md` `[R]`): `chat-interface-real-ai-api/README.md`. **[unavailable]**

**Herramientas**

- `https://diagram.4geeks.com` (14, 10 docs): `data-modeling-and-class-diagrams-digital-wallet/README.{es.,}md` `[R]` y `.learn/example/README.{es.,}md` `[—]`; `data-modeling-and-class-diagrams-music-player` ídem; `edutrack-data-audit-sql-related-tables/README.{es.,}md (x3 c/u)` `[R]`. (`content/projects/README.{es.,}md` menciona el host en texto plano, sin URL: no cuenta como ocurrencia.)
- `https://playground.4geeks.com/tracker/api/v1/docs` (6, 4 docs): `ai-eng-milestone-frontend-development/README.{es.,}md (x2 c/u)` `[R]`; `.learn/example/README.{es.,}md` `[—]`.
- `https://learn.4geeks.com` (4, 2 docs): `openclaw-integration/README.{es.,}md (x2 c/u)` `[R]`.
- `https://playground.4geeks.com/tracker/api/v1` (2, 2 docs): `ai-eng-milestone-frontend-development/README.{es.,}md` `[R]` (bloque `NEXT_PUBLIC_API_URL`).

## Apéndice C — Inventario completo de URL canónicas propias (49)

**Lecciones (8)** — §2.4. **Herramientas (4)** — §2.5.

**Marketing (37)** — no se archiva (AC-2.5.6), listado para reproducibilidad:

`https://4geeksacademy.com` (344 occ, 172 docs) · `https://4geeks.com` (172, 172) · `https://4geeksacademy.com/es/comparar-programas` (82, 82) · `…/es/programas-de-carrera/ingenieria-ia` (49, 49) · `…/es/programas-de-carrera/ciberseguridad` (48, 48) · `…/es/programas-de-carrera/desarrollo-full-stack` (48, 48) · `…/es/programas-de-carrera/ciencia-de-datos-ml` (45, 45) · `…/en/career-programs/data-science-ml` (41, 41) · `…/en/career-programs/ai-engineering` (40, 39) · `…/en/career-programs/cybersecurity` (39, 39) · `…/en/career-programs/full-stack` (38, 38) · `…/compare-programs` (36, 36) · `…/en/coding-bootcamps/ai-engineering` (36, 36) · `…/en/coding-bootcamps/cybersecurity` (36, 36) · `…/en/coding-bootcamps/data-science-ml` (36, 36) · `…/en/coding-bootcamps/full-stack-developer` (36, 36) · `…/es/coding-bootcamps/ingenieria-ia` (36, 36) · `…/es/coding-bootcamps/curso-ciberseguridad` (34, 34) · `…/es/coding-bootcamps/curso-datascience-machine-learning` (34, 34) · `…/es/coding-bootcamps/programador-full-stack` (34, 34) · `…/us/coding-bootcamps/datascience-machine-learning` (10, 8) · `…/us/coding-bootcamps/ai-engineering` (9, 9) · `…/us/coding-bootcamps/cybersecurity` (8, 8) · `…/us/coding-bootcamps` (5, 5) · `…/us/coding-bootcamps/coding-full-time` (3, 3) · `…/us/coding-bootcamps/full-stack-developer` (2, 2) · `…/es/coding-bootcamps/ciberseguridad` (2, 2) · `…/es/coding-bootcamps/data-science-ml` (2, 2) · `…/es/coding-bootcamps/full-stack-developer` (2, 2) · `…/coding-bootcamps/ai-engineering` (1) · `…/coding-bootcamps/cybersecurity` (1) · `…/coding-bootcamps/data-science-ml` (1) · `…/coding-bootcamps/full-stack-developer` (1) · `…/en/career-programs/full-stack-developer` (1) · `…/en/program-comparison` (1) · `…/es/coding-bootcamps/ingenieria-ia?lang=es` (1) · `…/es/programas-de-carrera/data-science-ml` (1).

---

## 8. Decisiones del usuario (2026-10-02) y ajustes al plan

1. **Save Page Now: NO.** No se envía nada a archive.org. Las herramientas muestran el original y, solo si ya existe captura (hoy `playground.4geeks.com/tracker/api/v1/docs`), el respaldo Wayback. No se implementa `--request-wayback`.
2. **Licencia: archivar literal** (opción a de la pregunta 3): copia literal para consulta personal offline, marcada como material externo, sin redistribución.
3. **Lecciones retiradas → página dedicada con la lección equivalente** (decisión explícita del usuario: "una página dedicada con cómo levantar el proyecto con datos de cómo levantar el proyecto"). Las 3 URL retiradas NO quedan `unavailable`: se registran como **alias decididos por el usuario** hacia la lección archivada real sobre cómo comenzar un proyecto:

   | URL retirada (canónica)                                                 | Alias de (canónica archivada)                                            |
   | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
   | `https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion` | `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` |
   | `https://4geeks.com/es/lesson/how-to-start-a-coding-project`            | `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` |
   | `https://4geeks.com/lesson/how-to-start-a-coding-project`               | `https://4geeks.com/lesson/how-to-start-a-project`                       |

   (Regla general para futuras variantes retiradas: `/es/` → variante ES, resto → variante EN.)

   Reglas: (a) el mapa vive como **dato versionado** (`platform/src/external-archive/aliases.json`, con `decidedBy: "user"`, `decidedAt: "2026-10-02"` y motivo), no en código; (b) el contenido mostrado es el Markdown **literal** de la lección destino (sin copiar bytes: la fila alias apunta a la fila destino); (c) la página `/archive/<url retirada>` muestra, además del aviso de material externo, un aviso visible y persistente de sustitución: la lección original fue retirada y no tiene copia; se muestra en su lugar la lección de 4Geeks «<título literal del destino>» elegida por el usuario como equivalente, con enlace a la URL original retirada y a la copia archivada del destino; (d) el idioma global (ADR-019) elige la variante del destino como en cualquier lección archivada; (e) los enlaces del Markdown hacia una URL retirada abren esa página (AC-2.5.4).

**Ajustes al modelo (§5.1):** `external_archive_items.status` admite `'alias'`; `method` admite `'user-alias'`; nueva columna `alias_of_canonical_url text null` (FK lógica a `canonical_url`, check: no nula si y solo si `status = 'alias'`). `ExternalArchiveStatus` = `"captured" | "unavailable" | "error" | "alias"`; `ExternalArchiveLink`/`ExternalArchiveItem` añaden `aliasOfCanonicalUrl: string | null`. Un enlace a un item `alias` se resuelve como `kind: "external-archive"` igual que una lección `captured`.
