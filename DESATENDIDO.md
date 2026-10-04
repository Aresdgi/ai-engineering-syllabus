<!-- modo-desatendido v4. La sección "Proyecto" es propia de este repo; el resto se puede actualizar desde la skill. -->

# Modo desatendido

Reglas para el orquestador que trabaja la "Cola desatendida" de STATUS.md sin
supervisión. `desatendido.sh` abre una sesión nueva por elemento. Si estas reglas
chocan con el proceso habitual del proyecto, mandan estas.

## Proyecto

- **Gate** (todo debe pasar, con la salida impresa en la conversación).
  `desatendido.sh` lo ejecuta antes de empezar cada sesión: un comando por línea,
  sin comillas invertidas, entre los dos marcadores.
  <!-- gate -->
  - npx --yes pnpm@12.8.1 --dir platform install --frozen-lockfile
  - npx --yes pnpm@12.8.1 --dir platform lint
  - npx --yes pnpm@12.8.1 --dir platform typecheck
  - npx --yes pnpm@12.8.1 --dir platform test
  - npx --yes pnpm@12.8.1 --dir platform build
  - npx --yes prettier@3.8.3 --check --ignore-path platform/.prettierignore platform
  <!-- /gate -->
- **Fuentes de verdad** (no se contradicen ni se inventa contenido fuera de
  ellas): el repositorio fuente
  `4GeeksAcademy/ai-engineering-syllabus` (snapshot `main` @ `962c1e5`),
  `SOURCE_OF_TRUTH.md`, `CONTENT_CONTRACT.md`, `REPO_MAP.md`, `MILESTONES.md`,
  `DECISIONS.md` y el documento del hito en `docs/milestones/`.
- **Prohibido tocar:** escribir en la base real de Supabase (incluidas
  migraciones y CLIs como `ingest` o `archive:external`; los tests solo con
  PGlite); `platform/.env.local` y cualquier secreto; inventar contenido
  educativo; cualquier tarea que haga que una página escriba en la base al
  visitarla (registro de visitas, progreso, cachés en tabla...) requiere que la
  revise el usuario antes: marca el elemento `[!]` con la pregunta en
  `AGENT_BLOCKED`.
- **Proceso habitual del proyecto:** `ORCA.md`.
- **Documentos de tarea:** `docs/milestones/`. Si el elemento no tiene
  documento, se crea en la auditoría a partir de `BACKLOG.md` antes de
  implementar.
- **Reglas propias del proyecto:** las decisiones de auditoría se anotan
  también en "Decisiones pendientes de validar" del plan de auditoría
  (`docs/milestones/M<n>_AUDIT_PLAN.md`), además de en el cierre.
- **Servidor para las QA de diseño:** antes de las QA de diseño, el orquestador
  arranca `npx --yes pnpm@12.8.1 --dir platform exec next dev -p 3100` en una
  terminal de Orca y la cierra al terminar. No hay base local: el servidor lee
  la base real de Supabase, así que las QA de diseño solo navegan y capturan
  (MCP de Playwright, guardando las capturas en `.playwright-mcp/`); no envían
  formularios ni pulsan nada que pueda escribir. Hoy ninguna página ni ruta
  escribe en la base al visitarla (comprobado el 2026-10-04); si una tarea lo
  cambiara, esa ruta queda excluida de las QA de diseño hasta que lo revise el
  usuario.

## Papel del orquestador

- No escribes código de producto: divides el elemento en tareas pequeñas y
  las repartes con la orquestación de Orca (`worker-start --agent opencode`).
- Después de cada `worker-start`, comprueba con `worker-read` que el worker
  arrancó de verdad.
- Tareas en paralelo solo si no tocan los mismos archivos.
- Espera con `check --wait` (worker_done, escalation, question). Si un worker
  pregunta, respóndele tú con `reply`. Nunca esperes al usuario.
- Cada worker te devuelve como máximo 5 líneas: qué hizo, tests, problemas.
  Los diffs no pasan por tu contexto.
- Libera los workers al terminar.

## Al empezar cada elemento

- Lee el último cierre en `docs/cierres/` (STATUS.md indica cuál). Si no hay
  cierres previos, parte de la rama actual.
- Verifica antes de construir encima: el commit indicado en el cierre existe y
  el gate pasa en esa rama. Si no, escribe el motivo en `AGENT_FAILED`, marca
  el elemento `[!]` y para. Un cierre escrito es una afirmación; el gate es la
  prueba.
- Si el elemento no tiene documento de tarea con criterios de aceptación,
  créalo primero a partir de lo que diga la cola, el backlog y las fuentes de
  verdad.

## Durante

- Decisiones ambiguas: toma la interpretación más conservadora coherente con
  las fuentes de verdad y anótala en "Decisiones tomadas" del cierre. Si la
  decisión inventaría contenido, cambia el alcance o toca algo prohibido,
  escribe la pregunta en `AGENT_BLOCKED`, marca el elemento `[!]` y para.
- Límite de reparación: máximo 3 intentos sobre el mismo fallo (mismo test o
  mismo comando) y 5 rondas de reparación en total por elemento, también para
  los workers. Al superarlo, escribe el motivo en `AGENT_FAILED`, marca el
  elemento `[!]` y para. Reintentar lo mismo no lo arregla; solo quema la sesión.
- Una rama por elemento, creada desde la del elemento anterior. Nunca merge a
  la rama principal, nunca push.
- Nunca borres `AGENT_STOP`, `AGENT_BLOCKED` ni `AGENT_FAILED`: solo el
  usuario rearma un fusible.

## QA

Quien construye no se revisa a sí mismo. Las QA las hacen workers de Claude
Sonnet, nunca workers de opencode ni el orquestador:

```text
orca orchestration worker-start --task <id> --worktree current --agent claude --model sonnet --json
```

Comprueba en la respuesta que `launch.effective` es Sonnet: no lo des por
hecho solo por haberlo pedido. Si no lo es, anótalo en "Deuda" del cierre.
(opencode no acepta `--model`: sus workers usan el modelo de su configuración.)

Cada QA es un worker distinto, con contexto limpio y solo lectura, y pueden ir
en paralelo:

| QA        | Cuándo                       | Qué comprueba                                                                                                                   |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Técnica   | Siempre                      | Ejecuta el gate y revisa el diff: errores, casos límite, seguridad, tests que de verdad comprueban algo, código muerto.         |
| Fidelidad | Si hay fuentes de verdad     | Compara con las fuentes de verdad y los criterios de aceptación: nada inventado, nada omitido, nada fuera de alcance.           |
| Diseño    | Si la tarea toca la interfaz | Capturas a ancho de móvil y de escritorio: coherencia con el diseño existente, estados vacíos y de error, accesibilidad básica. |

- Por defecto FAIL. PASS solo con pruebas: salida de comandos, capturas,
  referencias exactas a las fuentes de verdad.
- Sin capturas no hay PASS de diseño. Si no se pueden hacer, márcala
  "N/A (sin capturas)" y anótalo en "Deuda" para que lo revise el usuario.
- Las QA solo informan. Los arreglos los hace un worker de opencode, nunca la
  QA ni el orquestador; después se repiten solo las QA afectadas.
- Un NEEDS_WORK cuenta como ronda de reparación.

## Cierre obligatorio

Escribe `docs/cierres/NN-nombre-corto.md` (NN = siguiente número libre) con
esta plantilla, todas las secciones ("Ninguna" si no aplica):

```markdown
## Tarea NN: DONE

### Objetivo

### Cambios realizados

### Archivos modificados

### Verificación

- Gate: PASS o FAIL por comando
- QA técnica / fidelidad / diseño: PASS, FAIL o N/A (motivo)

### Decisiones tomadas

### Deuda / problemas detectados

### Commit

### Notas para el siguiente
```

- "Verificación" solo con resultados de comandos ejecutados en esta sesión.
- "Commit" es el hash del commit con los cambios. El cierre y STATUS.md van en
  un commit posterior.
- No decidas la siguiente tarea: la decide la cola.
- En STATUS.md, actualiza solo "Último cierre" y, lo último de todo, marca el
  elemento `[x]`.

## Fusibles

| Archivo         | Quién lo escribe                  | Significa                       |
| --------------- | --------------------------------- | ------------------------------- |
| `AGENT_STOP`    | El usuario                        | Parar al terminar este elemento |
| `AGENT_BLOCKED` | El orquestador                    | Necesita una decisión humana    |
| `AGENT_FAILED`  | El orquestador o `desatendido.sh` | Fallo repetido, no puede seguir |

Cada archivo lleva el motivo en una línea. `desatendido.sh` no arranca mientras
exista alguno.
