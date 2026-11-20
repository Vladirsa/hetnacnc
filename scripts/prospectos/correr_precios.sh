#!/usr/bin/env bash
# Agente «Monitor de precios de materiales»: cada lunes mide precios públicos de
# MDF, acrílico, lámina, aluminio y filamento y los manda a n8n (historial + Telegram).
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AQUI"
mkdir -p datos
exec > >(tee -a "datos/precios.log") 2>&1
echo "===== $(date '+%F %T') ====="
[ -f "$AQUI/.env" ] && { set -a; source "$AQUI/.env"; set +a; }
"$AQUI/.venv/bin/python" precios_materiales.py --enviar "${N8N_PRECIOS_URL:-http://127.0.0.1:5678/webhook/hetna-precios}"
