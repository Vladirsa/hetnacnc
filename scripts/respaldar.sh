#!/usr/bin/env bash
#
# Respaldo diario de hetnacnc.com: base de datos + documentos privados.
#
# Qué respalda:
#   - La base de datos completa (pg_dumpall del contenedor hetnacnc-postgres).
#   - /root/hetna-privado: documentos de verificación de talleres (INE, fotos).
#   - Los .env de la API y de la tienda (llaves): sin ellos, restaurar el
#     servidor implicaría volver a sacar todas las llaves.
#   - Desde el 18 nov 2026 también:
#       · packages/api/static: fotos y archivos que suben talleres y panel
#         (viven en el disco del servidor, no en la base);
#       · las bases y volúmenes de n8n y de WhatsApp (Evolution): flujos,
#         credenciales cifradas de n8n y la sesión de WhatsApp.
#   - Al terminar bien deja /root/respaldos/ultimo-ok: el Centro de control
#     avisa si tiene más de 26 horas (el respaldo dejó de correr).
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
# Bases en Supabase (opcional, una línea por base; el nombre es libre):
#   RESPALDO_DB_COTIZADOR=postgresql://...   (cadena "Session pooler" del
#                                             proyecto: Connect > Session pooler)
# Cada una se respalda con pg_dump 17 desde un contenedor y queda junto a la
# base principal (supabase-<nombre>-<fecha>.sql.gz). Si una falla, se avisa y
# el resto del respaldo sigue: una base externa caída no deja sin respaldo a
# la tienda.
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
# (zgrep y no "zcat | grep -q": con pipefail, grep -q corta la tubería al
# encontrar la línea, zcat sale con error y el respaldo bueno se daba por malo)
if [ "$(stat -c %s "$DUMP.tmp")" -lt 10000 ] || ! zgrep -q 'connect.*hetnacnc' "$DUMP.tmp"; then
  rm -f "$DUMP.tmp"
  echo "✗ El respaldo de la base salió vacío o incompleto"
  exit 1
fi
mv "$DUMP.tmp" "$DUMP"
echo "    base de datos: $(du -h "$DUMP" | cut -f1)"

# --- 1b. Bases en Supabase (RESPALDO_DB_<NOMBRE> en $LLAVES) ---
# La cadena va por variable de entorno al contenedor, no en la línea de
# comando: así no aparece en "ps" ni en el historial.
fallas_externas=0
for var in $(compgen -v | grep '^RESPALDO_DB_' || true); do
  nombre="$(echo "${var#RESPALDO_DB_}" | tr 'A-Z' 'a-z')"
  destino="$LOCAL/supabase-$nombre-$HOY.sql.gz"
  if docker run --rm -e PGURL="${!var}" postgres:17-alpine \
       sh -c 'pg_dump --no-owner --no-privileges "$PGURL"' 2>/tmp/respaldo-$nombre.err | gzip > "$destino.tmp" \
     && [ "$(stat -c %s "$destino.tmp")" -gt 2000 ]; then
    mv "$destino.tmp" "$destino"
    echo "    supabase $nombre: $(du -h "$destino" | cut -f1)"
  else
    rm -f "$destino.tmp"
    fallas_externas=$((fallas_externas + 1))
    echo "⚠ No se pudo respaldar supabase $nombre: $(head -c 300 /tmp/respaldo-$nombre.err 2>/dev/null)"
  fi
  rm -f /tmp/respaldo-$nombre.err
done

# --- 1c. Bases de n8n y de WhatsApp (Evolution), en contenedores Docker ---
# Se buscan por la etiqueta de docker compose (infra/n8n/docker-compose.yml).
for servicio in n8n-postgres evolution-postgres; do
  cont="$(docker ps --filter "label=com.docker.compose.service=$servicio" --format '{{.Names}}' | head -1)"
  [ -n "$cont" ] || continue
  destino="$LOCAL/$servicio-$HOY.sql.gz"
  if docker exec "$cont" sh -c 'pg_dumpall -U "${POSTGRES_USER:-postgres}"' 2>/tmp/respaldo-$servicio.err | gzip > "$destino.tmp" \
     && [ "$(stat -c %s "$destino.tmp")" -gt 2000 ]; then
    mv "$destino.tmp" "$destino"
    echo "    $servicio: $(du -h "$destino" | cut -f1)"
  else
    rm -f "$destino.tmp"
    fallas_externas=$((fallas_externas + 1))
    echo "⚠ No se pudo respaldar $servicio: $(head -c 300 /tmp/respaldo-$servicio.err 2>/dev/null)"
  fi
  rm -f /tmp/respaldo-$servicio.err
done

# Copias locales viejas
find "$LOCAL" \( -name 'db-*.sql.gz' -o -name 'supabase-*.sql.gz' -o -name '*-postgres-*.sql.gz' \) -mtime +"$DIAS_LOCAL" -delete

# --- 2. Copia cifrada en Backblaze B2 ---
RUTAS=("$LOCAL")
for r in /root/hetna-privado /root/hetnacnc/packages/api/static \
         /root/hetnacnc/packages/api/.env /root/hetnacnc/packages/api/.env.production \
         /root/hetnacnc/apps/storefront/.env /root/hetnacnc/apps/storefront/.env.local /root/hetnacnc/apps/storefront/.env.production; do
  [ -e "$r" ] && RUTAS+=("$r")
done
# Volúmenes de n8n (trae la llave con la que n8n cifra sus credenciales) y de
# la sesión de WhatsApp: sin ellos habría que reconectar todo a mano
for vol in $(docker volume ls --format '{{.Name}}' | grep -E '(^|_)(n8n_data|evolution_data)$' || true); do
  dir="$(docker volume inspect "$vol" --format '{{.Mountpoint}}' 2>/dev/null || true)"
  [ -n "$dir" ] && [ -d "$dir" ] && RUTAS+=("$dir")
done

restic backup --tag diario --host srv2007412 "${RUTAS[@]}"
restic forget --tag diario --host srv2007412 --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

# Marca para el Centro de control: el respaldo de la tienda sí quedó en B2
date '+%s %F %T' > "$LOCAL/ultimo-ok"
chmod 644 "$LOCAL/ultimo-ok"

if [ "$fallas_externas" -gt 0 ]; then
  echo "⚠ $(date '+%F %T') respaldo completo, pero $fallas_externas base(s) de Supabase fallaron"
  exit 2
fi
echo "✓ $(date '+%F %T') respaldo completo"
