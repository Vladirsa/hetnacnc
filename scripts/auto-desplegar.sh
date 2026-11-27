#!/usr/bin/env bash
#
# Despliegue automático: cada 10 min (cron) revisa si main cambió en GitHub y,
# si sí, corre scripts/desplegar.sh -- el mismo guion de siempre, con todas
# sus revisiones (sólo main, sólo en línea recta, si el build falla el sitio se
# queda como estaba). Al terminar avisa por Telegram si salió bien o mal.
#
# Instalación (una vez, como root en el VPS):
#   bash /root/hetnacnc/scripts/auto-desplegar.sh --instalar
# Apagarlo:
#   bash /root/hetnacnc/scripts/auto-desplegar.sh --apagar
# Ver qué ha hecho:
#   tail -50 /var/log/hetna-auto-desplegar.log
#   ls -t /var/log/hetna-despliegues/ | head      (un log completo por despliegue)
#
# Si un despliegue falla, NO lo reintenta cada 10 min con el mismo commit (sería
# un build fallido tras otro): espera a que llegue un commit nuevo a main. Para
# reintentar el mismo a mano: bash scripts/desplegar.sh
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON=/etc/cron.d/hetna-auto-desplegar
LOGS=/var/log/hetna-despliegues
FALLIDO=/var/lib/hetna-auto-desplegar.fallido

case "${1:-}" in
  --instalar)
    {
      echo "# Despliegue automático de hetnacnc.com (scripts/auto-desplegar.sh)"
      echo "PATH=/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
      echo "HOME=/root"
      echo "*/10 * * * * root bash $RAIZ/scripts/auto-desplegar.sh >> /var/log/hetna-auto-desplegar.log 2>&1"
    } > "$CRON"
    chmod 644 "$CRON"
    echo "✓ Instalado en $CRON: revisa main cada 10 minutos."
    echo "  Prueba del aviso por Telegram:"
    (cd "$RAIZ" && bun scripts/avisar-telegram.mjs "✅ Despliegue automático encendido: cada 10 min reviso si main cambió y despliego solo. Te aviso aquí cada vez.") || true
    exit 0 ;;
  --apagar)
    rm -f "$CRON" && echo "✓ Despliegue automático apagado (se borró $CRON)."
    exit 0 ;;
esac

# Una sola revisión a la vez (desplegar.sh tiene además su propio candado)
exec 8>/tmp/hetna-auto-desplegar.lock
flock -n 8 || exit 0

cd "$RAIZ"
[ "$(git branch --show-current)" = "main" ] || exit 0
git fetch -q origin main 2>/dev/null || { echo "$(date '+%F %T') no pude hacer git fetch"; exit 0; }
local_sha="$(git rev-parse HEAD)"
remoto="$(git rev-parse origin/main)"
[ "$local_sha" = "$remoto" ] && exit 0
# El mismo commit ya falló: esperar a uno nuevo
[ -f "$FALLIDO" ] && [ "$(cat "$FALLIDO")" = "$remoto" ] && exit 0

avisar() { bun scripts/avisar-telegram.mjs "$1" >/dev/null 2>&1 || echo "   (no se pudo mandar el aviso por Telegram)"; }

nuevos="$(git log --oneline --no-merges -8 "$local_sha..$remoto" | sed 's/^[0-9a-f]* /• /')"
cuantos="$(git rev-list --count --no-merges "$local_sha..$remoto")"
mkdir -p "$LOGS"
log="$LOGS/$(date '+%Y%m%d-%H%M').log"
inicio=$(date +%s)
echo "$(date '+%F %T') main cambió ($cuantos commit(s)); desplegando → $log"

if bash scripts/desplegar.sh > "$log" 2>&1; then
  min=$(( ($(date +%s) - inicio + 59) / 60 ))
  rm -f "$FALLIDO"
  echo "$(date '+%F %T') ✓ desplegado en ${min} min"
  avisar "✅ hetnacnc.com desplegado solo (${min} min, $cuantos cambio(s)):
$nuevos"
else
  echo "$remoto" > "$FALLIDO"
  echo "$(date '+%F %T') ✗ falló; el sitio sigue con la versión anterior"
  ultimas="$(sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -v '^\s*$' | tail -8)"
  avisar "❌ El despliegue automático falló y el sitio SIGUE con la versión anterior (no se cayó).

Últimas líneas:
$ultimas

Log completo en el servidor: $log"
fi

# Sólo los últimos 30 logs de despliegue
ls -1t "$LOGS"/*.log 2>/dev/null | tail -n +31 | xargs -r rm -f
