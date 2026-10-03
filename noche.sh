#!/bin/zsh
mkdir -p logs
rm -f logs/PARADA.txt
cola() { awk '/^## Cola nocturna/{f=1;next} /^## /{f=0} f' STATUS.md; }
pendientes() { cola | grep -c '^- \[ \]'; }
GOAL="/goal El primer elemento sin marcar de 'Cola nocturna' en STATUS.md está cerrado según 'Final de tarea' y 'Final de hito' de ORCA.md: build, typecheck, lint y tests en verde con la salida impresa en la conversación, QA hechas, STATUS actualizado, commit en su rama y, lo último, el elemento marcado [x]. O, si necesita una decisión del usuario, marcado [!] con el motivo. O para tras 60 turnos."

fallos=0
while [ "$(pendientes)" -gt 0 ]; do
  [ -f AGENT_STOP ] && { echo "Parado con AGENT_STOP" > logs/PARADA.txt; break; }
  cola | grep -q '^- \[!\]' && { cola | grep '^- \[!\]' > logs/PARADA.txt; break; }
  antes=$(pendientes)

  h=$(orca terminal create --worktree active --title "Orquestador" --command "claude --permission-mode auto" --json | jq -r '[.. | .handle? | strings][0]')
  orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 120000 --json > /dev/null
  orca terminal send --terminal "$h" --text "$GOAL" --enter --json > /dev/null

  for m in {1..240}; do
    sleep 60
    [ "$(pendientes)" -lt "$antes" ] && break
  done
  orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 600000 --json > /dev/null
  orca terminal close --terminal "$h" --json > /dev/null

  if [ "$(pendientes)" -lt "$antes" ]; then fallos=0; else fallos=$((fallos+1)); fi
  [ $fallos -ge 3 ] && { cola | grep -m1 '^- \[ \]' > logs/PARADA.txt; break; }
done
