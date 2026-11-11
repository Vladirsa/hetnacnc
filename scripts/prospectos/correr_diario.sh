#!/usr/bin/env bash
# Corre una tanda de búsquedas de ScrapeGraphAI y manda lo nuevo a la hoja de
# prospectos (n8n quita duplicados). Lo llama cron cada noche; ver instalar_servidor.sh.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AQUI"
set -a; source "$AQUI/.env"; set +a          # LLM_MODEL, LLM_API_KEY, TANDA, N8N_IMPORTAR_URL
mkdir -p datos
exec >>"datos/busqueda.log" 2>&1
echo "===== $(date '+%F %T') ====="
"$AQUI/.venv/bin/python" buscar_prospectos.py \
  --auto "${TANDA:-15}" --max-por-consulta 10 \
  --enviar "${N8N_IMPORTAR_URL:-https://n8n.hetnacnc.com/webhook/hetna-prospectos-importar}"
