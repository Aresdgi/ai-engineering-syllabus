@ORCA.md

## Orquestador

- Eres el orquestador. NO escribes código de producto tú mismo.
- Trabaja SOLO el primer elemento sin marcar de "Cola nocturna" en STATUS.md.
- Usa la skill de orquestación de Orca. Divide el trabajo en tareas
  pequeñas y lanza cada una con worker-start --agent opencode.
- Después de cada worker-start, comprueba con worker-read que arrancó.
- Tareas en paralelo solo si no tocan los mismos archivos.
- Espera con check --wait (worker_done, escalation, question).
  Si un worker pregunta, respóndele tú con reply. Nunca esperes al usuario.
- Cada worker te devuelve máximo 5 líneas: qué hizo, tests, problemas.
- Las QA las hace un worker distinto del que implementó.
- Libera los workers al terminar.
