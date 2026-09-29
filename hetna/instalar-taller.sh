#!/usr/bin/env bash
# HetNa Taller: crea las tablas del Cotizador y del Copiloto IA CNC y conecta la tienda con la base de datos.
# Se puede correr varias veces sin problema.
set -e
cd "$(dirname "$0")/.."

echo "== 1/4 Tablas del Cotizador y del Copiloto (esquema taller)"
docker exec -i hetnacnc-postgres psql -U postgres -d hetnacnc -v ON_ERROR_STOP=1 -q < hetna/taller-001.sql
docker exec -i hetnacnc-postgres psql -U postgres -d hetnacnc -v ON_ERROR_STOP=1 -q < hetna/copiloto-001.sql
docker exec hetnacnc-postgres psql -U postgres -d hetnacnc -tAc "select 'tablas listas: ' || count(*) from information_schema.tables where table_schema='taller'"

echo "== 2/4 Conexion de la tienda con la base (sin mostrar la contrasena)"
ENV_TIENDA=apps/storefront/.env.local
if grep -q '^HETNA_TALLER_DB=' "$ENV_TIENDA" 2>/dev/null; then
  echo "ya estaba configurada"
else
  URL=$(grep -E '^DATABASE_URL=' packages/api/.env | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')
  if [ -z "$URL" ]; then echo "ERROR: no encontre DATABASE_URL en packages/api/.env"; exit 1; fi
  printf "\nHETNA_TALLER_DB='%s'\n" "$URL" >> "$ENV_TIENDA"
  echo "configurada en $ENV_TIENDA"
fi

echo "== 3/4 Libreria de base de datos para la tienda"
if [ -d apps/storefront/node_modules/pg ] || [ -d node_modules/pg ]; then
  echo "pg disponible"
else
  echo "instalando pg..."
  BUN=$(command -v bun || echo /root/.bun/bin/bun)
  (cd apps/storefront && "$BUN" add pg@^8.11.3) || { echo "ERROR: no se pudo instalar pg"; exit 1; }
fi
echo "== 4/4 Armando el cotizador"
python3 hetna/cotizador/build-cotizador.py
echo "== Copiloto IA"
if grep -q '^ANTHROPIC_API_KEY=.\+' "$ENV_TIENDA" 2>/dev/null; then
  echo "llave de IA configurada"
else
  echo "FALTA la llave de IA: el chat queda en espera y las calculadoras funcionan."
  echo "Cuando la tengas corre:  bash hetna/llave-ia.sh"
fi
echo "== LISTO"
