#!/usr/bin/env bash
# Instala la búsqueda automática de prospectos en el servidor (una sola vez):
#   bash scripts/prospectos/instalar_servidor.sh
# Crea un entorno de Python aparte, instala ScrapeGraphAI + Chromium y deja un
# cron que corre todas las noches a las 2:30 (hora del servidor).
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AQUI"

command -v python3 >/dev/null || { echo "Falta python3"; exit 1; }
python3 -m venv --help >/dev/null 2>&1 || apt-get install -y python3-venv
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
.venv/bin/playwright install --with-deps chromium

if [ ! -f .env ]; then
  cat > .env <<'ENV'
# Groq (plan gratuito): crea la llave en https://console.groq.com/keys
LLM_MODEL=groq/llama-3.1-8b-instant
LLM_API_KEY=PEGA_AQUI_TU_LLAVE_DE_GROQ
# Búsquedas por noche (cada una revisa hasta 10 sitios)
TANDA=15
N8N_IMPORTAR_URL=https://n8n.hetnacnc.com/webhook/hetna-prospectos-importar
ENV
  chmod 600 .env
  echo ">> Edita $AQUI/.env y pega tu llave de Groq en LLM_API_KEY"
fi

chmod +x correr_diario.sh
LINEA="30 2 * * * $AQUI/correr_diario.sh"
( crontab -l 2>/dev/null | grep -v 'prospectos/correr_diario.sh' ; echo "$LINEA" ) | crontab -
echo ">> Cron instalado: $LINEA"
echo ">> Para probar ya:  $AQUI/correr_diario.sh && tail -n 40 $AQUI/datos/busqueda.log"
