#!/usr/bin/env bash
#
# Baja la base gratuita de DB-IP "IP to City Lite" (licencia CC BY 4.0) a
# ~/hetna-data/dbip-city-lite.mmdb. La usa la tienda en /api/ubicacion para
# adivinar el estado del visitante y ordenar "talleres cerca de ti" sin
# mandar su IP a nadie (todo se busca en este servidor).
#
# Uso (desde ~/hetnacnc):  bash scripts/actualizar-ubicacion-ip.sh
# DB-IP publica una versión al inicio de cada mes. Para dejarlo solo, en cron:
#   15 4 3 * * cd /root/hetnacnc && bash scripts/actualizar-ubicacion-ip.sh >> /root/hetna-data/ubicacion-ip.log 2>&1
set -euo pipefail

DESTINO="${DBIP_CIUDAD_MMDB:-$HOME/hetna-data/dbip-city-lite.mmdb}"
mkdir -p "$(dirname "$DESTINO")"
TMP="$(mktemp "${DESTINO}.XXXXXX")"
trap 'rm -f "$TMP" "$TMP.gz"' EXIT

# Este mes y, si todavía no sale, el anterior
for MES in "$(date +%Y-%m)" "$(date -d "$(date +%Y-%m-15) -1 month" +%Y-%m)"; do
  URL="https://download.db-ip.com/free/dbip-city-lite-${MES}.mmdb.gz"
  if curl -fsSL --retry 3 -o "$TMP.gz" "$URL"; then
    gunzip -c "$TMP.gz" > "$TMP"
    # un .mmdb válido trae este marcador cerca del final
    if ! grep -aq "MaxMind.com" "$TMP"; then
      echo "El archivo de $MES no parece una base .mmdb; no se cambia nada." >&2
      exit 1
    fi
    chmod 644 "$TMP"
    mv -f "$TMP" "$DESTINO" # cambio atómico: la tienda nunca lee un archivo a medias
    echo "$(date '+%F %T') Base de ubicación por IP actualizada ($MES): $DESTINO"
    exit 0
  fi
done
echo "No se pudo bajar la base de DB-IP (ni de este mes ni del anterior)." >&2
exit 1
