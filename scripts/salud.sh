#!/usr/bin/env bash
#
# Salud del VPS → n8n → Telegram. Cada 30 min (cron) manda disco, RAM y carga
# al flujo "HETNA Mantenimiento - Salud del VPS", que avisa a Vlado sólo cuando
# el servidor entra o sale de riesgo (disco > 85 %, RAM > 90 %, carga > 4).
#
# Instalación (una vez, como root en el VPS):
#   bash /root/hetnacnc/scripts/salud.sh --instalar
# Probar a mano:
#   bash /root/hetnacnc/scripts/salud.sh
#
# El token sale del .env de la API (N8N_REDES_TOKEN, el mismo que ya usa el
# sitio con n8n). No hay que copiar ninguna llave a mano.
set -euo pipefail

ENV_API=/root/hetnacnc/packages/api/.env
WEBHOOK="${SALUD_WEBHOOK:-https://n8n.hetnacnc.com/webhook/salud-vps}"
CRON=/etc/cron.d/hetna-salud

if [ "${1:-}" = "--instalar" ]; then
  printf '*/30 * * * * root bash /root/hetnacnc/scripts/salud.sh >> /var/log/hetna-salud.log 2>&1\n' > "$CRON"
  chmod 644 "$CRON"
  echo "✓ Cron instalado en $CRON (cada 30 min). Primera prueba:"
  exec bash "$0"
fi

token="$(grep -E '^N8N_REDES_TOKEN=' "$ENV_API" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "$token" ]; then
  echo "✗ No encontré N8N_REDES_TOKEN en $ENV_API" >&2
  exit 1
fi

disco="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
read -r mem_total mem_usada < <(free -m | awk '/^Mem:/ {print $2, $3}')
carga="$(cut -d' ' -f1 /proc/loadavg)"

codigo="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "x-hetna-token: $token" -H 'content-type: application/json' \
  -d "{\"disco\":$disco,\"mem_total\":$mem_total,\"mem_usada\":$mem_usada,\"carga\":$carga}" \
  "$WEBHOOK")"

echo "$(date '+%F %T') disco=${disco}% mem=${mem_usada}/${mem_total}MB carga=${carga} → n8n ${codigo}"
[ "$codigo" = "200" ]
