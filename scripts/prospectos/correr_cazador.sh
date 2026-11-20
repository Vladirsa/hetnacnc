#!/usr/bin/env bash
# Agente «Cazador de solicitudes»: busca gente pidiendo servicios CNC (última
# semana) y lo manda a n8n (Telegram + invitación por correo a empresas).
# Lo llama cron cada mañana; ver README.md.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AQUI"
mkdir -p datos
exec > >(tee -a "datos/cazador.log") 2>&1
echo "===== $(date '+%F %T') ====="
[ -f "$AQUI/.env" ] || { echo "Falta $AQUI/.env: corre instalar_servidor.sh"; exit 1; }
set -a; source "$AQUI/.env"; set +a
"$AQUI/.venv/bin/python" cazar_solicitudes.py --enviar "${N8N_CAZADOR_URL:-http://127.0.0.1:5678/webhook/hetna-cazador}"
