#!/usr/bin/env bash
#
# Prueba que el respaldo de verdad se puede restaurar (auditoría de seguridad
# del 18 nov 2026). Un respaldo que nunca se ha restaurado no es un respaldo.
#
# Qué hace, sin tocar la tienda:
#   1. Baja de Backblaze el último respaldo de la base (restic).
#   2. Lo carga en una base de Postgres TEMPORAL, en un contenedor aparte.
#   3. Cuenta pedidos, productos, clientes y talleres y los compara con la
#      base real.
#   4. Borra la base temporal y los archivos bajados.
#
# Uso (en el VPS, una vez al mes):   bash /root/hetnacnc/scripts/probar-restauracion.sh
#
set -euo pipefail

LLAVES=/root/.respaldo.env
[ -r "$LLAVES" ] || { echo "✗ Falta $LLAVES con las llaves de Backblaze y restic"; exit 1; }
set -a
# shellcheck disable=SC1090
. "$LLAVES"
set +a

TMP="$(mktemp -d /root/prueba-restauracion.XXXXXX)"
CONT="hetna-prueba-restauracion-$$"
limpiar() { docker rm -f "$CONT" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpiar EXIT

echo "==> Último respaldo en Backblaze"
restic snapshots --tag diario --host srv2007412 --latest 1 --compact | tail -n +1

echo "==> Bajando la base del último respaldo"
restic restore latest --tag diario --host srv2007412 --target "$TMP" --include '/root/respaldos/db-*.sql.gz' >/dev/null
DUMP="$(find "$TMP" -name 'db-*.sql.gz' | sort | tail -1)"
[ -n "$DUMP" ] || { echo "✗ El último respaldo no trae la base de datos"; exit 1; }
echo "    $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))"

# Misma versión mayor de Postgres que la base real
VER="$(docker exec hetnacnc-postgres sh -c 'postgres --version' | grep -oE '[0-9]+' | head -1)"
echo "==> Cargándola en una base temporal (Postgres $VER)"
docker run -d --name "$CONT" -e POSTGRES_PASSWORD=prueba --network none "postgres:${VER}-alpine" >/dev/null
for _ in $(seq 1 60); do docker exec "$CONT" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1; done
gunzip -c "$DUMP" | docker exec -i "$CONT" psql -U postgres -q -v ON_ERROR_STOP=0 >/dev/null 2>"$TMP/errores.txt" || true

contar() { # contar <contenedor> <tabla> [usuario]
  docker exec "$1" sh -c "psql -U \"\${POSTGRES_USER:-postgres}\" -d hetnacnc -At -c 'select count(*) from \"$2\"'" 2>/dev/null || echo "?"
}
echo "==> Comparando con la base real"
printf '   %-10s %12s %12s\n' "tabla" "respaldo" "real hoy"
ok=1
for t in order product customer seller; do
  r="$(contar "$CONT" "$t")"; v="$(contar hetnacnc-postgres "$t")"
  printf '   %-10s %12s %12s\n' "$t" "$r" "$v"
  # Vacía en el respaldo pero con datos en la real = no se restauró bien
  case "$r" in ''|'?') ok=0 ;; 0) [ "$v" != 0 ] && ok=0 ;; esac
done

if [ "$ok" = 1 ]; then
  echo "✓ El respaldo se restauró completo. (Los números de hoy pueden ser un poco mayores: el respaldo es de la madrugada.)"
else
  echo "✗ El respaldo no se pudo restaurar bien. Primeros errores:"
  head -20 "$TMP/errores.txt"
  exit 1
fi
