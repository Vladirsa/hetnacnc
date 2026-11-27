#!/usr/bin/env bash
# Genera todos los diseños de esta carpeta y los guarda en Backblaze (bucket privado,
# disenos-generados/<nombre>/). Se corre en el servidor:
#   ~/hetnacnc/scripts/disenos/guardar_en_b2.sh
# La primera vez instala lo necesario (ezdxf y gmsh en un entorno de Python aparte).
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
  echo "→ $(basename "$g")"
  "$VENV/bin/python" "$g" 2>&1 | grep -vE '^\[|^\*|^ *$|Info|WorkSession|Step File' || true
done

cd "$RAIZ/packages/api"
./node_modules/.bin/medusa exec ./src/scripts/guardar-disenos-b2.ts "$SALIDA" 2>&1 | grep -E '^(✔|✘|[0-9]+ de )' || true
rm -rf "$SALIDA"
