#!/usr/bin/env bash
#
# Respaldo diario de hetnacnc.com: base de datos + documentos privados.
#
# Qué respalda:
#   - La base de datos completa (pg_dumpall del contenedor hetnacnc-postgres).
#   - /root/hetna-privado: documentos de verificación de talleres (INE, fotos).
#   - Los .env de la API y de la tienda (llaves): sin ellos, restaurar el
#     servidor implicaría volver a sacar todas las llaves.
#
# Dónde queda:
#   - Copia local en /root/respaldos (últimos 14 días).
#   - Copia CIFRADA en Backblaze B2 con restic (14 diarios, 8 semanales,
#     12 mensuales). Los archivos van cifrados antes de salir del servidor:
#     ni Backblaze puede leerlos. Sin la contraseña de restic NO se pueden
#     recuperar: guárdala también fuera del servidor (gestor de contraseñas).
#
# Las llaves NO viven en este archivo ni en el repositorio: se leen de
# /root/.respaldo.env (permisos 600), con:
#   B2_ACCOUNT_ID=...        (keyID de la Application Key de Backblaze)
#   B2_ACCOUNT_KEY=...       (applicationKey)
#   RESTIC_REPOSITORY=b2:<bucket>:hetnacnc
#   RESTIC_PASSWORD=...      (contraseña de cifrado de restic)
#
# Uso manual:   bash /root/hetnacnc/scripts/respaldar.sh
# Programado:   /etc/cron.d/hetna-respaldo (todos los días en la madrugada)
# Ver respaldos en B2:   set -a; . /root/.respaldo.env; set +a; restic snapshots
# Restaurar (ejemplo):   restic restore latest --target /root/restaurado
#
set -euo pipefail

LLAVES=/root/.respaldo.env
LOCAL=/root/respaldos
DIAS_LOCAL=14
HOY="$(date +%F)"

echo "==> $(date '+%F %T') inicio del respaldo"

[ -r "$LLAVES" ] || { echo "✗ Falta $LLAVES con las llaves de Backblaze y restic"; exit 1; }
set -a
# shellcheck disable=SC1090
. "$LLAVES"
set +a
: "${RESTIC_REPOSITORY:?falta RESTIC_REPOSITORY en $LLAVES}"
: "${RESTIC_PASSWORD:?falta RESTIC_PASSWORD en $LLAVES}"

umask 077
mkdir -p "$LOCAL"
chmod 700 "$LOCAL"

# --- 1. Base de datos ---
DUMP="$LOCAL/db-$HOY.sql.gz"
docker exec hetnacnc-postgres sh -c 'pg_dumpall -U "${POSTGRES_USER:-postgres}"' | gzip > "$DUMP.tmp"
# Un respaldo vacío o cortado no debe reemplazar a uno bueno
if [ "$(stat -c %s "$DUMP.tmp")" -lt 10000 ] || ! zcat "$DUMP.tmp" | grep -q 'connect.*hetnacnc'; then
  rm -f "$DUMP.tmp"
  echo "✗ El respaldo de la base salió vacío o incompleto"
  exit 1
fi
mv "$DUMP.tmp" "$DUMP"
echo "    base de datos: $(du -h "$DUMP" | cut -f1)"

# Copias locales viejas
find "$LOCAL" -name 'db-*.sql.gz' -mtime +"$DIAS_LOCAL" -delete

# --- 2. Copia cifrada en Backblaze B2 ---
RUTAS=("$LOCAL")
for r in /root/hetna-privado /root/hetnacnc/packages/api/.env /root/hetnacnc/apps/storefront/.env /root/hetnacnc/apps/storefront/.env.local; do
  [ -e "$r" ] && RUTAS+=("$r")
done

restic backup --tag diario --host srv2007412 "${RUTAS[@]}"
restic forget --tag diario --host srv2007412 --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

echo "✓ $(date '+%F %T') respaldo completo"
