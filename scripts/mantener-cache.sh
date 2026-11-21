#!/usr/bin/env bash
# Mantiene caliente la microcaché de nginx (infra/nginx/CACHE-PAGINAS.md) en las
# páginas a donde llegan los anuncios y los buscadores, para que un visitante
# nuevo nunca espere a que la tienda arme la página (~0.6-1 s → ~0.1 s).
#
# Cada corrida pide las páginas dos veces, con 30 s entre una y otra, con la
# cabecera X-Hetna-Refrescar: nginx las arma de nuevo y guarda la copia (vive
# 60 s), así siempre hay una copia fresca y nunca se sirve una vencida.
#
# Instalar (una vez, en el VPS, como root):
#   ( crontab -l 2>/dev/null | grep -v mantener-cache; echo '* * * * * bash /root/hetnacnc/scripts/mantener-cache.sh >/dev/null 2>&1' ) | crontab -
# Quitar:
#   crontab -l | grep -v mantener-cache | crontab -
set -u
SITIO="${SITIO:-https://hetnacnc.com}"
PAGINAS="/mx /us /mx/cotizar /mx/cotizar/corte-laser /mx/cotizar/router-cnc /mx/cotizar/corte-plasma /mx/cotizar/impresion-3d
/mx/talleres /mx/talleres/ranking /mx/calculadora-cnc /mx/herramientas-cnc /mx/fabricacion /mx/distribuidores
/mx/latinoamerica /mx/creadores /mx/cnc"

exec 9>/tmp/hetna-mantener-cache.lock
flock -n 9 || exit 0

pasada() {
  for p in $PAGINAS; do
    galleta="_medusa_cache_id=calentar-cache"
    case "$p" in /us|/us/*) ;; *) galleta="$galleta; hetna_lang=es" ;; esac
    curl -s -o /dev/null --max-time 20 -A 'Mozilla/5.0 (hetna-calentar)' \
      -H "Cookie: $galleta" -H 'X-Hetna-Refrescar: calentar' "$SITIO$p" || true
  done
}

pasada
sleep 30
pasada
