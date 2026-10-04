# M2B — Inventario reproducible de enlaces externos (AC-2.5.1)

Generado desde la salida real del CLI de archivo externo, sin contenido inventado:
solo URL canónicas, ocurrencias, documentos de origen e idioma del snapshot SOURCE.

- Fecha de generación (UTC): `2026-10-02T18:47:09.961Z`
- Snapshot activo: `1b8fb5cc-ea2f-49c1-9179-91b0d6edeb0a` · commit `962c1e5fc8ebad273abaa348fb3d161568ce8707` · repositorio `4GeeksAcademy/ai-engineering-syllabus`
- Archivos textuales inspeccionados: **781**
- Ocurrencias de hosts de 4Geeks: **1543** (clases archivables lección+herramienta+marketing: **1463**)
- URL canónicas: **127** (clases archivables: **49**)
- Documentos únicos con enlaces de las clases archivables: **180**

Comando reproducible (desde la raíz del repositorio):

```sh
npx --yes pnpm@12.8.1 --dir platform archive:external --dry-run --resolve --report text --inventory-out /tmp/m2b-inventory.json
```

> `--dry-run --resolve` hace los GET de validación (registro BreatheCode, GitHub y Wayback) sin escribir en la base; el inventario es un SELECT de solo lectura del snapshot activo. `--from-dir content/` produce el mismo inventario sin base de datos.

## Totales por host

| Host                        | Ocurrencias |
| --------------------------- | ----------: |
| `4geeksacademy.com`         |        1143 |
| `4geeks.com`                |         294 |
| `breathecode.herokuapp.com` |          80 |
| `diagram.4geeks.com`        |          14 |
| `playground.4geeks.com`     |           8 |
| `learn.4geeks.com`          |           4 |

## Totales por clase

| Clase        | Ocurrencias | URL canónicas | Documentos |
| ------------ | ----------: | ------------: | ---------: |
| lesson       |         122 |             8 |         84 |
| tool         |          26 |             4 |         16 |
| marketing    |        1315 |            37 |        174 |
| out-of-scope |          80 |            78 |         80 |

## Lecciones (8 URL canónicas)

### `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion`

- Ocurrencias: **8** · documentos: **8**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/ai-eng-milestone-web-fundamentals/README.es.md` (es, 1)
  - `content/projects/collaborative-project-html-tailwind-online-store/README.es.md` (es, 1)
  - `content/projects/company-financial-dashboard-skills-project/README.es.md` (es, 1)
  - `content/projects/company-financial-dashboard-specs-project/README.es.md` (es, 1)
  - `content/projects/html-css-artist-landing-seo-access/README.es.md` (es, 1)
  - `content/projects/nextjs-wanderlust-explorer/README.es.md` (es, 1)
  - `content/projects/seats-management-typescript/README.es.md` (es, 1)
  - `content/projects/simple-dashboard-tailwind-css/README.es.md` (es, 1)

### `https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion`

- Ocurrencias: **9** · documentos: **7**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/ai-eng-building-bullet-proof-applications/README.es.md` (es, 2)
  - `content/projects/ai-eng-user-authentication-api/README.es.md` (es, 1)
  - `content/projects/ai-eng-user-authentication-flows/README.es.md` (es, 1)
  - `content/projects/ai-eng-user-authentication-restore/README.es.md` (es, 1)
  - `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.es.md` (es, 1)
  - `content/projects/data-modeling-and-class-diagrams-music-player/README.es.md` (es, 1)
  - `content/projects/streamloop-churn-model-tuning/README.es.md` (es, 2)

### `https://4geeks.com/es/lesson/how-to-start-a-coding-project`

- Ocurrencias: **5** · documentos: **3**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/agent-hub-ui-specs-and-prompts/README.es.md` (es, 2)
  - `content/projects/chat-interface-real-ai-api/README.es.md` (es, 1)
  - `content/projects/voice-to-do-list-api/README.es.md` (es, 2)

### `https://4geeks.com/es/lesson/how-to-start-a-project`

- Ocurrencias: **1** · documentos: **1**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/ai-eng-performance-caching/README.es.md` (es, 1)

### `https://4geeks.com/lesson/como-comenzar-un-proyecto-de-codificacion`

- Ocurrencias: **2** · documentos: **1**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/nextjs-airbnb-ui-clone/README.es.md` (es, 2)

### `https://4geeks.com/lesson/how-to-start-a-coding-project`

- Ocurrencias: **1** · documentos: **1**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/chat-interface-real-ai-api/README.md` (en, 1)

### `https://4geeks.com/lesson/how-to-start-a-project`

- Ocurrencias: **90** · documentos: **67**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/agent-hub-ui-specs-and-prompts/README.md` (en, 2)
  - `content/projects/ai-basic-inventory-agent-loop/README.es.md` (es, 2)
  - `content/projects/ai-basic-inventory-agent-loop/README.md` (en, 2)
  - `content/projects/ai-eng-architectural-proposal/README.es.md` (es, 1)
  - `content/projects/ai-eng-architectural-proposal/README.md` (en, 1)
  - `content/projects/ai-eng-building-bullet-proof-applications/README.md` (en, 2)
  - `content/projects/ai-eng-error-handling/README.es.md` (es, 1)
  - `content/projects/ai-eng-error-handling/README.md` (en, 1)
  - `content/projects/ai-eng-milestone-frontend-development/README.es.md` (es, 1)
  - `content/projects/ai-eng-milestone-frontend-development/README.md` (en, 1)
  - `content/projects/ai-eng-milestone-web-fundamentals/README.md` (en, 1)
  - `content/projects/ai-eng-performance-caching/README.md` (en, 1)
  - `content/projects/ai-eng-performance-serialization/README.es.md` (es, 1)
  - `content/projects/ai-eng-performance-serialization/README.md` (en, 1)
  - `content/projects/ai-eng-performance-web-vitals/README.es.md` (es, 1)
  - `content/projects/ai-eng-performance-web-vitals/README.md` (en, 1)
  - `content/projects/ai-eng-real-time-communication/README.es.md` (es, 1)
  - `content/projects/ai-eng-real-time-communication/README.md` (en, 1)
  - `content/projects/ai-eng-real-time-notification/README.es.md` (es, 1)
  - `content/projects/ai-eng-real-time-notification/README.md` (en, 1)
  - `content/projects/ai-eng-user-authentication-api/README.md` (en, 1)
  - `content/projects/ai-eng-user-authentication-flows/README.md` (en, 1)
  - `content/projects/ai-eng-user-authentication-restore/README.md` (en, 1)
  - `content/projects/branch-queue/README.es.md` (es, 2)
  - `content/projects/branch-queue/README.md` (en, 2)
  - `content/projects/collaborative-project-html-tailwind-online-store/README.md` (en, 1)
  - `content/projects/company-financial-dashboard-context-project/README.es.md` (es, 1)
  - `content/projects/company-financial-dashboard-context-project/README.md` (en, 1)
  - `content/projects/company-financial-dashboard-skills-project/README.es.md` (es, 1)
  - `content/projects/company-financial-dashboard-skills-project/README.md` (en, 2)
  - `content/projects/company-financial-dashboard-specs-project/README.es.md` (es, 1)
  - `content/projects/company-financial-dashboard-specs-project/README.md` (en, 2)
  - `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.md` (en, 1)
  - `content/projects/data-modeling-and-class-diagrams-music-player/README.md` (en, 1)
  - `content/projects/designing-data-pipeline/README.es.md` (es, 1)
  - `content/projects/designing-data-pipeline/README.md` (en, 1)
  - `content/projects/edutrack-data-audit-sql-related-tables/README.es.md` (es, 1)
  - `content/projects/edutrack-data-audit-sql-related-tables/README.md` (en, 1)
  - `content/projects/edutrack-data-audit-sql/README.es.md` (es, 1)
  - `content/projects/edutrack-data-audit-sql/README.md` (en, 1)
  - `content/projects/existing-model-sentiment-analysis-reviews/README.es.md` (es, 2)
  - `content/projects/existing-model-sentiment-analysis-reviews/README.md` (en, 2)
  - `content/projects/html-css-artist-landing-seo-access/README.md` (en, 1)
  - `content/projects/launch-ready-containerized-mvp/README.es.md` (es, 2)
  - `content/projects/launch-ready-containerized-mvp/README.md` (en, 2)
  - `content/projects/nextjs-airbnb-ui-clone/README.md` (en, 2)
  - `content/projects/nextjs-wanderlust-explorer/README.es.md` (es, 1)
  - `content/projects/nextjs-wanderlust-explorer/README.md` (en, 2)
  - `content/projects/openclaw-connection/README.es.md` (es, 1)
  - `content/projects/openclaw-connection/README.md` (en, 1)
  - `content/projects/openclaw-integration/README.es.md` (es, 1)
  - `content/projects/openclaw-integration/README.md` (en, 1)
  - `content/projects/openclaw-memory/README.es.md` (es, 2)
  - `content/projects/openclaw-memory/README.md` (en, 2)
  - `content/projects/openclaw-setup/README.es.md` (es, 1)
  - `content/projects/openclaw-setup/README.md` (en, 1)
  - `content/projects/openclaw-skills/README.es.md` (es, 2)
  - `content/projects/openclaw-skills/README.md` (en, 2)
  - `content/projects/seats-management-typescript/README.es.md` (es, 1)
  - `content/projects/seats-management-typescript/README.md` (en, 2)
  - `content/projects/simple-dashboard-tailwind-css/README.md` (en, 1)
  - `content/projects/streamloop-churn-model-tuning/README.md` (en, 2)
  - `content/projects/triage-queue/README.es.md` (es, 2)
  - `content/projects/triage-queue/README.md` (en, 2)
  - `content/projects/voice-to-do-list-api/README.md` (en, 2)
  - `content/projects/vps-ssh-resource-optimization/README.es.md` (es, 1)
  - `content/projects/vps-ssh-resource-optimization/README.md` (en, 1)

### `https://4geeks.com/lesson/what-is-github-codespaces`

- Ocurrencias: **6** · documentos: **6**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/collaborative-project-html-tailwind-online-store/README.es.md` (es, 1)
  - `content/projects/collaborative-project-html-tailwind-online-store/README.md` (en, 1)
  - `content/projects/html-css-artist-landing-seo-access/README.es.md` (es, 1)
  - `content/projects/html-css-artist-landing-seo-access/README.md` (en, 1)
  - `content/projects/simple-dashboard-tailwind-css/README.es.md` (es, 1)
  - `content/projects/simple-dashboard-tailwind-css/README.md` (en, 1)

## Herramientas (4 URL canónicas)

### `https://diagram.4geeks.com`

- Ocurrencias: **14** · documentos: **10**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/data-modeling-and-class-diagrams-digital-wallet/.learn/example/README.es.md` (es, 1)
  - `content/projects/data-modeling-and-class-diagrams-digital-wallet/.learn/example/README.md` (en, 1)
  - `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.es.md` (es, 1)
  - `content/projects/data-modeling-and-class-diagrams-digital-wallet/README.md` (en, 1)
  - `content/projects/data-modeling-and-class-diagrams-music-player/.learn/example/README.es.md` (es, 1)
  - `content/projects/data-modeling-and-class-diagrams-music-player/.learn/example/README.md` (en, 1)
  - `content/projects/data-modeling-and-class-diagrams-music-player/README.es.md` (es, 1)
  - `content/projects/data-modeling-and-class-diagrams-music-player/README.md` (en, 1)
  - `content/projects/edutrack-data-audit-sql-related-tables/README.es.md` (es, 3)
  - `content/projects/edutrack-data-audit-sql-related-tables/README.md` (en, 3)

### `https://learn.4geeks.com`

- Ocurrencias: **4** · documentos: **2**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/openclaw-integration/README.es.md` (es, 2)
  - `content/projects/openclaw-integration/README.md` (en, 2)

### `https://playground.4geeks.com/tracker/api/v1`

- Ocurrencias: **2** · documentos: **2**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/ai-eng-milestone-frontend-development/README.es.md` (es, 1)
  - `content/projects/ai-eng-milestone-frontend-development/README.md` (en, 1)

### `https://playground.4geeks.com/tracker/api/v1/docs`

- Ocurrencias: **6** · documentos: **4**
- Documentos de origen (idioma ADR-012, ocurrencias):
  - `content/projects/ai-eng-milestone-frontend-development/.learn/example/README.es.md` (es, 1)
  - `content/projects/ai-eng-milestone-frontend-development/.learn/example/README.md` (en, 1)
  - `content/projects/ai-eng-milestone-frontend-development/README.es.md` (es, 2)
  - `content/projects/ai-eng-milestone-frontend-development/README.md` (en, 2)

## Marketing (37 URL canónicas, nunca se archiva)

| URL canónica                                                                       | Ocurrencias | Documentos |
| ---------------------------------------------------------------------------------- | ----------: | ---------: |
| `https://4geeks.com`                                                               |         172 |        172 |
| `https://4geeksacademy.com`                                                        |         344 |        172 |
| `https://4geeksacademy.com/coding-bootcamps/ai-engineering`                        |           1 |          1 |
| `https://4geeksacademy.com/coding-bootcamps/cybersecurity`                         |           1 |          1 |
| `https://4geeksacademy.com/coding-bootcamps/data-science-ml`                       |           1 |          1 |
| `https://4geeksacademy.com/coding-bootcamps/full-stack-developer`                  |           1 |          1 |
| `https://4geeksacademy.com/compare-programs`                                       |          36 |         36 |
| `https://4geeksacademy.com/en/career-programs/ai-engineering`                      |          40 |         40 |
| `https://4geeksacademy.com/en/career-programs/cybersecurity`                       |          39 |         39 |
| `https://4geeksacademy.com/en/career-programs/data-science-ml`                     |          41 |         41 |
| `https://4geeksacademy.com/en/career-programs/full-stack`                          |          38 |         38 |
| `https://4geeksacademy.com/en/career-programs/full-stack-developer`                |           1 |          1 |
| `https://4geeksacademy.com/en/coding-bootcamps/ai-engineering`                     |          36 |         36 |
| `https://4geeksacademy.com/en/coding-bootcamps/cybersecurity`                      |          36 |         36 |
| `https://4geeksacademy.com/en/coding-bootcamps/data-science-ml`                    |          36 |         36 |
| `https://4geeksacademy.com/en/coding-bootcamps/full-stack-developer`               |          36 |         36 |
| `https://4geeksacademy.com/en/program-comparison`                                  |           1 |          1 |
| `https://4geeksacademy.com/es/coding-bootcamps/ciberseguridad`                     |           2 |          2 |
| `https://4geeksacademy.com/es/coding-bootcamps/curso-ciberseguridad`               |          34 |         34 |
| `https://4geeksacademy.com/es/coding-bootcamps/curso-datascience-machine-learning` |          34 |         34 |
| `https://4geeksacademy.com/es/coding-bootcamps/data-science-ml`                    |           2 |          2 |
| `https://4geeksacademy.com/es/coding-bootcamps/full-stack-developer`               |           2 |          2 |
| `https://4geeksacademy.com/es/coding-bootcamps/ingenieria-ia`                      |          36 |         36 |
| `https://4geeksacademy.com/es/coding-bootcamps/ingenieria-ia?lang=es`              |           1 |          1 |
| `https://4geeksacademy.com/es/coding-bootcamps/programador-full-stack`             |          34 |         34 |
| `https://4geeksacademy.com/es/comparar-programas`                                  |          82 |         82 |
| `https://4geeksacademy.com/es/programas-de-carrera/ciberseguridad`                 |          48 |         48 |
| `https://4geeksacademy.com/es/programas-de-carrera/ciencia-de-datos-ml`            |          45 |         45 |
| `https://4geeksacademy.com/es/programas-de-carrera/data-science-ml`                |           1 |          1 |
| `https://4geeksacademy.com/es/programas-de-carrera/desarrollo-full-stack`          |          48 |         48 |
| `https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia`                  |          49 |         49 |
| `https://4geeksacademy.com/us/coding-bootcamps`                                    |           5 |          5 |
| `https://4geeksacademy.com/us/coding-bootcamps/ai-engineering`                     |           9 |          9 |
| `https://4geeksacademy.com/us/coding-bootcamps/coding-full-time`                   |           3 |          3 |
| `https://4geeksacademy.com/us/coding-bootcamps/cybersecurity`                      |           8 |          8 |
| `https://4geeksacademy.com/us/coding-bootcamps/datascience-machine-learning`       |          10 |          8 |
| `https://4geeksacademy.com/us/coding-bootcamps/full-stack-developer`               |           2 |          2 |

## Fuera de alcance (78 URL canónicas, solo se documentan)

`breathecode.herokuapp.com` es el servicio de telemetría/API de BreatheCode que aparece en los `learn.json` (no se renderiza en la app): no es contenido educativo ni se archiva. El detalle URL a URL está en el JSON del comando reproducible.

- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=` (3 ocurrencia(s), 3 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3239` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3258` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3260` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3318` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3320` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3343` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3366` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3371` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3377` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3379` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3381` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3383` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3444` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3445` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3469` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3471` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3478` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3501` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3517` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3519` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3521` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3525` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3572` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3573` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3576` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3590` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3592` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3610` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3612` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3614` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3618` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3623` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3625` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3641` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3643` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3645` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3652` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3654` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3666` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3668` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3670` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3672` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3683` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3685` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3687` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3693` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3720` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3722` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3724` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3726` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3771` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3773` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3775` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3778` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3784` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3796` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3798` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3832` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3834` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3836` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3839` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3841` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3843` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3846` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3907` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3909` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3913` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3917` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3919` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3921` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3923` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3925` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3935` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3937` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3947` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3949` (1 ocurrencia(s), 1 documento(s))
- `https://breathecode.herokuapp.com/v1/assignment/me/telemetry?asset_id=3965` (1 ocurrencia(s), 1 documento(s))

## Estado real de la captura (2026-10-02)

Verificado con `SELECT` de solo lectura sobre `external_archive_*` tras la captura real y una segunda ejecución idempotente (0 cambios):

| URL canónica                                                             | Estado   | sha256                                                             | Fichero fuente                         |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------ | -------------------------------------- |
| `https://4geeks.com/lesson/how-to-start-a-project`                       | captured | `9261997020916708e1a9b7f88417a2a5baaacb49f654eb0e6a92126dde6b1a2e` | `content/how-to-start-a-project.md`    |
| `https://4geeks.com/es/lesson/how-to-start-a-project`                    | captured | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` | `content/how-to-start-a-project.es.md` |
| `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` | captured | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` | `content/how-to-start-a-project.es.md` |
| `https://4geeks.com/lesson/como-comenzar-un-proyecto-de-codificacion`    | captured | `5424302d0b6bdbaa54db820f3da959efb0753921cacff7f75a0663a2f8b1030f` | `content/how-to-start-a-project.es.md` |
| `https://4geeks.com/lesson/what-is-github-codespaces`                    | captured | `a14968e4ad5c9991221370e9c9f6ae3c4f114c427b62d59fb5491ed7129734f6` | `content/what-is-github-codespaces.md` |

| URL retirada (alias)                                                    | Destino (alias_of)                                                       | Método       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| `https://4geeks.com/es/lesson/como-iniciar-un-proyecto-de-programacion` | `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` | `user-alias` |
| `https://4geeks.com/es/lesson/how-to-start-a-coding-project`            | `https://4geeks.com/es/lesson/como-comenzar-un-proyecto-de-codificacion` | `user-alias` |
| `https://4geeks.com/lesson/how-to-start-a-coding-project`               | `https://4geeks.com/lesson/how-to-start-a-project`                       | `user-alias` |

| Herramienta                                         | Estado      | Respaldo Wayback                                                                                  |
| --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `https://playground.4geeks.com/tracker/api/v1/docs` | captured    | http://web.archive.org/web/20260613092255/https://playground.4geeks.com/tracker/api/v1/docs (200) |
| `https://diagram.4geeks.com`                        | unavailable | sin captura                                                                                       |
| `https://playground.4geeks.com/tracker/api/v1`      | unavailable | sin captura                                                                                       |
| `https://learn.4geeks.com`                          | unavailable | sin captura                                                                                       |

Totales en base: 12 items (5 lecciones `captured`, 3 `alias`, 1 herramienta `captured`, 3 `unavailable`), 12 assets de imagen (sha256) y 33 enlaces item↔imagen; `source_files` (899) y `source_snapshots` (1) intactos; 0 items de marketing.
