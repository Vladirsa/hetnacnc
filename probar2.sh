#!/usr/bin/env bash
set -euo pipefail
SITIO="$1"
verde(){ echo "VERDE $*"; }; rojo(){ echo "ROJO $*"; }
ESPERA_MAXIMA="${DESPLIEGUE_ESPERA:-150}"; ESPERA_ENTRE=2
fallas=0
for ruta in "/"; do
  inicio="$(date +%s)"; codigo=""; listo=0
  while :; do
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITIO$ruta" 2>/dev/null || true)"
    [ -n "$codigo" ] || codigo="000"
    if [ "$codigo" = "200" ] || [ "$codigo" = "307" ]; then listo=1; break; fi
    transcurrido=$(( $(date +%s) - inicio ))
    if [ "$transcurrido" -ge "$ESPERA_MAXIMA" ]; then break; fi
    echo "   … $ruta → $codigo (reintentando, ${transcurrido}s de ${ESPERA_MAXIMA}s)"
    sleep "$ESPERA_ENTRE"
  done
  if [ "$listo" = "1" ]; then verde "✓ $ruta → $codigo"; else rojo "✗ $ruta → $codigo"; fallas=$((fallas+1)); fi
done
echo "fallas=$fallas"
