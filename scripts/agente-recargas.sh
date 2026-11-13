#!/usr/bin/env bash
#
# Agente de recargas y vencimientos: ¿qué tiene configurado el servidor?
#
#   bash ~/hetnacnc/scripts/agente-recargas.sh
#
# Sólo dice SÍ / NO por cada variable del .env de la API. NUNCA imprime los
# valores (llaves, tokens), así que la salida se puede pegar en el chat.
set -uo pipefail

ENV_API="${ENV_API:-/root/hetnacnc/packages/api/.env}"
[ -f "$ENV_API" ] || ENV_API="$HOME/hetnacnc/packages/api/.env"
if [ ! -f "$ENV_API" ]; then
  echo "No encontré el .env de la API ($ENV_API)."
  exit 1
fi

tiene() { grep -Eq "^[[:space:]]*(export[[:space:]]+)?$1=[^[:space:]#]" "$ENV_API"; }

revisar() {
  # revisar "Nombre del servicio" VAR1 VAR2 ...
  local nombre="$1"; shift
  local faltan=()
  for v in "$@"; do tiene "$v" || faltan+=("$v"); done
  if [ ${#faltan[@]} -eq 0 ]; then
    printf '  ✅ %-34s listo\n' "$nombre"
  else
    printf '  ⬜ %-34s falta: %s\n' "$nombre" "${faltan[*]}"
  fi
}

echo "Agente de recargas y vencimientos — $(date '+%d %b %Y %H:%M')"
echo
echo "Saldos"
revisar "RunPod (escaneo 3D)"            RUNPOD_API_KEY
revisar "Meta Ads"                       META_ADS_TOKEN META_AD_ACCOUNT_ID
revisar "Google Ads"                     GOOGLE_ADS_DEVELOPER_TOKEN GOOGLE_ADS_CLIENT_ID GOOGLE_ADS_CLIENT_SECRET GOOGLE_ADS_REFRESH_TOKEN GOOGLE_ADS_CUSTOMER_ID
echo
echo "Uso"
revisar "Resend (correos)"               RESEND_API_KEY
echo   "  ✅ Disco del servidor                siempre (no necesita llave)"
revisar "Cloudflare R2 (archivos)"       CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
revisar "Supabase de la app"             COTIZADOR_SUPABASE_URL COTIZADOR_SUPABASE_SERVICE_KEY
echo
echo "Vencimientos"
echo   "  ✅ Dominio y certificado SSL         siempre (hetnacnc.com)"
revisar "Hostinger (VPS y servicios)"    HOSTINGER_API_TOKEN
revisar "Lista manual (Workspace, etc.)" VENCIMIENTOS
echo
echo "Avisos"
revisar "Correo de la mañana"            RESEND_API_KEY
tiene CONTROL_AVISOS_PARA && echo "  ✅ Destinatarios propios (CONTROL_AVISOS_PARA)" \
  || echo "  ·  Destinatarios: la cuenta de la casa (CONTROL_AVISOS_PARA no está puesto)"
grep -Eq "^CONTROL_AVISOS=off" "$ENV_API" && echo "  ⚠ CONTROL_AVISOS=off: los avisos están APAGADOS"
echo
echo "Telegram: se vincula en el panel (Social Hub → Telegram). Supabase: pegar el SQL"
echo "de hetna_uso y hetna_consultas (ver la guía) para el espacio y el detector de bucles."
