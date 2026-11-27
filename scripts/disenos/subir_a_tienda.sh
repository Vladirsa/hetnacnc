#!/usr/bin/env bash
# Genera los diseños de esta carpeta, los guarda en Backblaze y los pasa a la tienda EN BORRADOR
# (foto con IA, ficha con IA, producto con su oferta). No publica nada: los revisas en el admin.
#   ~/hetnacnc/scripts/disenos/subir_a_tienda.sh
# Diseños que ya tienen producto y no se deben duplicar (separados por coma):
SALTAR="plantilla-bisagra-35"
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$DIR/../.." && pwd)"
VENV="$HOME/.venv-disenos"
SALIDA="$(mktemp -d /tmp/disenos-XXXXXX)"

if [ ! -x "$VENV/bin/python" ]; then
  echo "Instalando lo necesario (sólo la primera vez)…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -q libglu1-mesa libxcursor1 libxft2 libxinerama1 libxrender1 libgl1 python3-venv >/dev/null
  fi
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q ezdxf matplotlib gmsh
fi

cd "$SALIDA"
for g in "$DIR"/*.py; do
  "$VENV/bin/python" "$g" >/dev/null 2>&1 || echo "✘ falló $(basename "$g")"
done

cd "$RAIZ/packages/api"
echo "== Backblaze =="
./node_modules/.bin/medusa exec ./src/scripts/guardar-disenos-b2.ts "$SALIDA" 2>&1 | grep -E '^(✔|✘|[0-9]+ de )' || true
echo "== Tienda (borrador) =="
./node_modules/.bin/medusa exec ./src/scripts/importar-disenos-tienda.ts "$SALIDA" "$SALTAR" 2>&1 | grep -E '^(✔|✘|·|    nota|[0-9]+ diseños)' || true
rm -rf "$SALIDA"
