#!/bin/zsh
mkdir -p logs
rm -f logs/PARADA.txt
cola() { awk '/^## Cola nocturna/{f=1;next} /^## /{f=0} f' STATUS.md; }
pendientes() { cola | grep -c '^- \[ \]'; }

fallos=0
while [ "$(pendientes)" -gt 0 ]; do
  [ -f AGENT_STOP ] && { echo "Parado con AGENT_STOP" > logs/PARADA.txt; break; }
  cola | grep -q '^- \[!\]' && { cola | grep '^- \[!\]' > logs/PARADA.txt; break; }
  antes=$(pendientes)
  claude -p "/goal El primer elemento sin marcar de 'Cola nocturna' en STATUS.md está cerrado según 'Final de tarea' y 'Final de hito' de ORCA.md: build, typecheck, lint y tests en verde con la salida impresa en la conversación, QA hechas, STATUS actualizado, commit en su rama, y el elemento marcado [x]. O, si necesita una decisión del usuario, marcado [!] con el motivo. O para tras 60 turnos." --permission-mode auto --output-format stream-json --verbose >> "logs/$(date +%m%d-%H%M).log" 2>&1
  if [ "$(pendientes)" -lt "$antes" ]; then fallos=0; else fallos=$((fallos+1)); sleep 1800; fi
  [ $fallos -ge 3 ] && { cola | grep -m1 '^- \[ \]' > logs/PARADA.txt; break; }
done
