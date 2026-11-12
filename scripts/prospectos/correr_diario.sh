#!/usr/bin/env bash
# Corre una tanda de búsquedas de ScrapeGraphAI y manda lo nuevo a la hoja de
# prospectos (n8n quita duplicados). Lo llama cron cada noche; ver instalar_servidor.sh.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AQUI"
mkdir -p datos
exec > >(tee -a "datos/busqueda.log") 2>&1
echo "===== $(date '+%F %T') ====="
[ -f "$AQUI/.env" ] || { echo "Falta $AQUI/.env: corre instalar_servidor.sh"; exit 1; }
[ -x "$AQUI/.venv/bin/python" ] || { echo "Falta el entorno .venv: corre instalar_servidor.sh"; exit 1; }
set -a; source "$AQUI/.env"; set +a          # LLM_MODEL, LLM_API_KEY, TANDA, N8N_IMPORTAR_URL
case "${LLM_API_KEY:-}" in ""|PEGA_AQUI*) echo "Pega tu llave de Groq en $AQUI/.env (LLM_API_KEY)"; exit 1;; esac
"$AQUI/.venv/bin/python" buscar_prospectos.py \
  --auto "${TANDA:-15}" --max-por-consulta 10 \
  --enviar "${N8N_IMPORTAR_URL:-https://n8n.hetnacnc.com/webhook/hetna-prospectos-importar}"
