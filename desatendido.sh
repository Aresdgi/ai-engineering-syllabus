#!/bin/zsh
# modo-desatendido v4
# Recorre la "Cola desatendida" de STATUS.md y abre, por cada elemento, un Claude
# orquestador nuevo en una terminal visible de Orca. Las reglas están en DESATENDIDO.md.
# Lánzalo desde una terminal de Orca, en la raíz del checkout:
#   caffeinate -is ./desatendido.sh

cd "${0:A:h}" || exit 1

MAX_MINUTOS=${MAX_MINUTOS:-240}   # tiempo máximo por elemento antes de contarlo como fallo
MAX_FALLOS=${MAX_FALLOS:-3}       # intentos fallidos seguidos antes de AGENT_FAILED
INTERVALO=${INTERVALO:-60}        # segundos entre comprobaciones de la cola

FUSIBLES=(AGENT_STOP AGENT_BLOCKED AGENT_FAILED)
mkdir -p logs
LOG="logs/sesion-$(date +%Y%m%d-%H%M).log"

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }
cola() { awk '/^## Cola desatendida/{f=1;next} /^## /{f=0} f' STATUS.md; }
pendientes() { cola | grep -c '^- \[ \]'; }
fusible() {
  for f in $FUSIBLES; do
    if [ -f "$f" ]; then local m=$(head -1 "$f"); echo "$f: ${m:-(sin motivo)}"; return 0; fi
  done
  return 1
}
bloqueo_sin_fusible() {
  if cola | grep -q '^- \[!\]' && ! fusible > /dev/null; then
    echo "elemento marcado [!] sin fusible: $(cola | grep -m1 '^- \[!\]')" > AGENT_FAILED
    return 0
  fi
  return 1
}
abortar() { log "NO ARRANCA: $*"; exit 1; }

# ---------- Comprobaciones previas ----------
for c in git orca claude jq; do
  command -v $c > /dev/null || abortar "falta el comando '$c'"
done
git rev-parse --is-inside-work-tree > /dev/null 2>&1 || abortar "no estás en un repositorio git"
[ -f DESATENDIDO.md ] || abortar "no existe DESATENDIDO.md en la raíz"
git rev-parse --verify HEAD > /dev/null 2>&1 || abortar "el repo no tiene ningún commit todavía (falta la fase cero)"
grep -q '{{' DESATENDIDO.md && abortar "DESATENDIDO.md tiene huecos sin rellenar ({{...}})"
GATE=("${(@f)$(awk '/<!-- gate -->/{f=1;next} /<!-- \/gate -->/{f=0} f' DESATENDIDO.md \
  | sed -nE 's/^[[:space:]]*-[[:space:]]+//p' | tr -d '`')}")
GATE=(${GATE:#})
[ ${#GATE} -gt 0 ] || abortar "DESATENDIDO.md no define ningún comando de gate (falta la fase cero)"
grep -q '^## Cola desatendida' STATUS.md 2> /dev/null || abortar "STATUS.md no tiene la sección '## Cola desatendida'"
orca terminal list --worktree active --json > /dev/null 2>&1 \
  || abortar "no estás en un checkout que Orca conozca (lánzalo desde una terminal de Orca)"
if [ -z "$DESATENDIDO_SIN_COMPROBAR_OPENCODE" ]; then
  OC=~/.config/opencode/opencode.json
  jq -e '.permission["*"]=="allow" and .permission.question=="deny" and .permission.doom_loop=="deny"' "$OC" > /dev/null 2>&1 \
    || abortar "los permisos de opencode no están listos en $OC (los workers se quedarían esperando)"
fi
if fusible > /dev/null; then abortar "hay un fusible activo. Revísalo y bórralo tú: $(fusible)"; fi
cola | grep -q '^- \[!\]' && abortar "la cola tiene elementos [!] de otra sesión. Resuélvelos antes de lanzar"
[ "$(pendientes)" -gt 0 ] || abortar "la cola está vacía"
if [ -z "$DESATENDIDO_SIN_GATE_INICIAL" ]; then
  log "Gate inicial en $(git rev-parse --abbrev-ref HEAD) ($(git rev-parse --short HEAD))"
  for c in $GATE; do
    log "  \$ $c"
    ( eval "$c" ) >> "$LOG" 2>&1 || abortar "el gate falla antes de empezar: '$c'. La rama de partida está rota; la sesión se construiría encima"
  done
fi

# ---------- Bucle ----------
GOAL="/goal El primer elemento sin marcar de 'Cola desatendida' en STATUS.md está cerrado según DESATENDIDO.md: verificación inicial hecha, gate en verde con la salida impresa en la conversación, QA en PASS, cierre escrito en docs/cierres/ con la plantilla completa, commits en su rama y, lo último, el elemento marcado [x]. O ha saltado un fusible: AGENT_BLOCKED o AGENT_FAILED escrito con el motivo y el elemento marcado [!]. O para tras 60 turnos."

log "Inicio. Pendientes: $(pendientes)"
fallos=0
while [ "$(pendientes)" -gt 0 ]; do
  fusible > /dev/null && break
  bloqueo_sin_fusible && break
  antes=$(pendientes)
  elemento=$(cola | grep -m1 '^- \[ \]')
  log "Empieza: $elemento"

  h=$(orca terminal create --worktree active --title "Orquestador" \
        --command "claude --permission-mode auto" --json \
      | jq -r '.result.terminal.handle // ([.. | .handle? | strings][0]) // empty')
  if [ -z "$h" ]; then
    log "No se pudo abrir la terminal del orquestador"
    fallos=$((fallos + 1))
  else
    orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 120000 --json > /dev/null
    orca terminal send --terminal "$h" --text "$GOAL" --enter --json > /dev/null

    vueltas=$(( MAX_MINUTOS * 60 / INTERVALO )); (( vueltas < 1 )) && vueltas=1
    for m in {1..$vueltas}; do
      sleep $INTERVALO
      [ "$(pendientes)" -lt "$antes" ] && break
      [ -f AGENT_BLOCKED ] || [ -f AGENT_FAILED ] && break
    done
    orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 600000 --json > /dev/null
    orca terminal close --terminal "$h" --json > /dev/null

    if [ "$(pendientes)" -lt "$antes" ]; then
      fallos=0
      log "Resultado: $(cola | grep -F -- "${elemento#- \[ \] }" | head -1)"
    else
      fallos=$((fallos + 1))
      log "Sin cerrar tras el intento $fallos de $MAX_FALLOS"
    fi
  fi

  if [ $fallos -ge $MAX_FALLOS ] && ! fusible > /dev/null; then
    echo "$MAX_FALLOS intentos sin cerrar: $elemento" > AGENT_FAILED
    break
  fi
  [ -z "$h" ] && sleep 300
done

bloqueo_sin_fusible
if fusible > /dev/null; then
  log "Parada por fusible. $(fusible)"
else
  log "Cola vacía. Sesión terminada."
fi
