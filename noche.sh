#!/bin/zsh
FUSIBLES=(AGENT_STOP AGENT_BLOCKED AGENT_FAILED)
cola() { awk '/^## Cola nocturna/{f=1;next} /^## /{f=0} f' STATUS.md; }
pendientes() { cola | grep -c '^- \[ \]'; }
fusible() { for f in $FUSIBLES; do [ -f "$f" ] && { echo "$f: $(cat $f)"; return 0; }; done; return 1; }
# Red de seguridad: un [!] en la cola sin fusible deja AGENT_FAILED explicando la parada.
marcado_sin_fusible() {
  local l
  l=$(cola | grep -m1 '^- \[!\]') || return 1
  echo "elemento marcado [!] sin fusible: $l" > AGENT_FAILED
}

if fusible; then echo "Hay un fusible activo. Revísalo y bórralo antes de lanzar."; exit 1; fi

GOAL="/goal El primer elemento sin marcar de 'Cola nocturna' en STATUS.md está cerrado según 'Modo nocturno' de ORCA.md: verificación inicial hecha, cierre escrito en docs/cierres/ con la plantilla completa, build, typecheck, lint y tests en verde con la salida impresa en la conversación, commits en su rama y, lo último, el elemento marcado [x]. O, si ha saltado un fusible, AGENT_BLOCKED o AGENT_FAILED escrito con el motivo y el elemento marcado [!]. O para tras 60 turnos."

fallos=0
while [ "$(pendientes)" -gt 0 ]; do
  fusible && break
  marcado_sin_fusible && break
  antes=$(pendientes)

  h=$(orca terminal create --worktree active --title "Orquestador" --command "claude --permission-mode auto" --json | jq -r '[.. | .handle? | strings][0]')
  orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 120000 --json > /dev/null
  orca terminal send --terminal "$h" --text "$GOAL" --enter --json > /dev/null

  for m in {1..240}; do
    sleep 60
    [ "$(pendientes)" -lt "$antes" ] && break
    [ -f AGENT_BLOCKED ] || [ -f AGENT_FAILED ] && break
  done
  orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 600000 --json > /dev/null
  orca terminal close --terminal "$h" --json > /dev/null

  if [ "$(pendientes)" -lt "$antes" ]; then fallos=0; else fallos=$((fallos+1)); fi
  if [ $fallos -ge 3 ] && ! fusible > /dev/null; then
    echo "3 intentos sin cerrar: $(cola | grep -m1 '^- \[ \]')" > AGENT_FAILED
    break
  fi
done
fusible > /dev/null || marcado_sin_fusible
fusible || echo "Cola vacía. Noche terminada."
