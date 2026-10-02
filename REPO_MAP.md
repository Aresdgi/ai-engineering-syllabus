# Repository Map

Mapa observado del repositorio fuente.

## Raíz educativa

```text
content/
├── contexts/
├── lessons/
└── projects/
```

## `content/projects/`

El propio repositorio declara que es el repositorio de proyectos prácticos del programa AI Engineering.

Cada carpeta de proyecto puede contener:

- README;
- README español cuando exista;
- criterios de evaluación;
- `learn.json` cuando corresponda;
- assets;
- archivos auxiliares.

El orden canónico debe obtenerse de:

`content/projects/README.md`

No mantener manualmente una segunda lista independiente dentro de la aplicación.

## `content/contexts/`

El README del repositorio indica que cada carpeta representa contextos utilizados por milestones o proyectos.

El orden y significado deben obtenerse de:

`content/contexts/README.md`

Incluye, entre otros, contextos para:

- general company briefings;
- web fundamentals;
- coding fundamentals;
- frontend development;
- backend development;
- telemetry/data pipelines;
- training & RAG;
- agent engineering;
- workflows;
- realtime;
- proyectos standalone.

Las compañías y datos concretos deben importarse literalmente de sus archivos `CONTEXT-*`.

## `content/lessons/`

La carpeta contiene materiales adicionales del curso.

Actualmente se han observado entradas como:

- `4geeks-student-extension`
- `cursor-github-codespaces`
- `optimize-ubuntu-vps-ram-efficiency`
- `simple-rag-fastapi-qdrant-example`
- `you-have-finished-your-course-now-what`

La plataforma no debe asumir que esta lista es permanente.

## Fuente de orden

Prioridad:

1. orden explícito en README del repo;
2. relaciones explícitas dentro de los proyectos;
3. metadata del propio proyecto;
4. estructura de carpetas.

Nunca inventar orden cuando el repo no lo especifica.

## Sincronización

Este mapa es descriptivo.

El código debe descubrir el contenido desde GitHub en cada sincronización, no depender de esta lista como catálogo hardcodeado.
