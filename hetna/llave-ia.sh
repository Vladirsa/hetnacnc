#!/usr/bin/env bash
# Guarda la llave de la API de Claude (Anthropic) para el Copiloto IA CNC.
# La llave se escribe sin mostrarse en pantalla y solo queda en el servidor.
set -e
cd "$(dirname "$0")/.."
ENV_TIENDA=apps/storefront/.env.local
read -r -s -p "Pega la llave de la API (empieza con sk-ant-) y presiona Enter: " LLAVE
echo
case "$LLAVE" in
  sk-ant-*) ;;
  *) echo "Esa no parece una llave de Anthropic (debe empezar con sk-ant-). No se guardó nada."; exit 1 ;;
esac
touch "$ENV_TIENDA"
grep -v '^ANTHROPIC_API_KEY=' "$ENV_TIENDA" > "$ENV_TIENDA.tmp" || true
printf "ANTHROPIC_API_KEY='%s'\n" "$LLAVE" >> "$ENV_TIENDA.tmp"
mv "$ENV_TIENDA.tmp" "$ENV_TIENDA"
chmod 600 "$ENV_TIENDA"
echo "Llave guardada. Reiniciando la tienda..."
systemctl restart hetnacnc
echo "Listo. Abre hetnacnc.com/mx/servicios/copiloto-ia-cnc"
