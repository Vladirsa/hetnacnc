#!/usr/bin/env bash
# Revisa la seguridad del servidor (auditoría del 18 nov 2026).
# Se corre EN EL VPS:   cd ~/hetnacnc && ./scripts/revisar-seguridad.sh
#
# Sólo lee. Nunca enseña el valor de una llave: dice BIEN, FALLA o AVISO.
R="$(cd "$(dirname "$0")/.." && pwd)"
API="$R/packages/api/.env"
WEB="$R/apps/storefront/.env"
[ -f "$WEB" ] || WEB="$R/apps/storefront/.env.local"
fallas=0
bien()  { printf '  BIEN   %s\n' "$1"; }
falla() { printf '  FALLA  %s\n' "$1"; fallas=$((fallas + 1)); }
aviso() { printf '  AVISO  %s\n' "$1"; }
valor() { [ -f "$1" ] && grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }

echo "== Archivos .env"
for f in "$API" "$WEB"; do
  [ -f "$f" ] || { aviso "no existe $f"; continue; }
  p=$(stat -c '%a' "$f"); [ "$p" = 600 ] && bien "$f sólo lo lee su dueño (600)" || falla "$f tiene permisos $p → corre: chmod 600 $f"
done
git -C "$R" ls-files --error-unmatch packages/api/.env >/dev/null 2>&1 && falla "packages/api/.env está dentro de git" || bien "el .env no está en git"

echo "== Secretos de sesión y de firma (API)"
for v in JWT_SECRET COOKIE_SECRET; do
  x=$(valor "$API" $v)
  if [ -z "$x" ]; then falla "$v está vacío"; elif [ "$x" = supersecret ]; then falla "$v vale el de ejemplo (supersecret)"; elif [ ${#x} -lt 32 ]; then falla "$v es corto (${#x} letras; usa openssl rand -hex 64)"; else bien "$v propio y largo"; fi
done
[ "$(valor "$API" JWT_SECRET)" != "$(valor "$API" COOKIE_SECRET)" ] && bien "JWT_SECRET y COOKIE_SECRET son distintos" || falla "JWT_SECRET y COOKIE_SECRET son iguales"
for v in BAJA_SECRET ARCHIVOS_SECRETO STOREFRONT_REVALIDATE_SECRET N8N_REDES_TOKEN ESCANEO_CALLBACK_SECRET; do
  x=$(valor "$API" $v); [ -n "$x" ] && [ "$x" != supersecret ] && bien "$v puesto" || aviso "$v vacío o de ejemplo (si usas esa función, ponle un secreto propio)"
done

echo "== Modo de producción"
[ "$(valor "$API" NODE_ENV)" = production ] && bien "API con NODE_ENV=production" || aviso "NODE_ENV no está en el .env del API: confirma que pm2 lo pone (pm2 env <id> | grep NODE_ENV)"
for v in PAYPAL_SANDBOX SKYDROPX_SANDBOX META_CAPI_TEST_CODE CSP_SOLO_REPORTE; do
  x="$(valor "$API" $v)$(valor "$WEB" $v)"; case "$x" in ""|0|false|off) bien "$v apagado";; *) falla "$v está encendido en producción";; esac
done
case "$(valor "$API" MERCADOPAGO_ACCESS_TOKEN)" in TEST-*) falla "Mercado Pago con llave de PRUEBA";; "") aviso "MERCADOPAGO_ACCESS_TOKEN vacío";; *) bien "Mercado Pago con llave real";; esac
case "$(valor "$API" FILE_BACKEND_URL)" in https://*) bien "FILE_BACKEND_URL con https";; *) falla "FILE_BACKEND_URL vacío o sin https (las ligas de archivos salen mal)";; esac

echo "== CORS"
for v in STORE_CORS ADMIN_CORS VENDOR_CORS AUTH_CORS APP_CORS; do
  x=$(valor "$API" $v); case "$x" in *localhost*|*127.0.0.1*) falla "$v incluye localhost";; "") [ $v = APP_CORS ] && bien "$v vacío" || falla "$v vacío";; *"*"*) falla "$v incluye *";; *) bien "$v sin localhost ni *";; esac
done

echo "== Archivos peligrosos ya subidos a /static"
S="$R/packages/api/static"; [ -d "$R/packages/api/.medusa/server/static" ] && S="$S $R/packages/api/.medusa/server/static"
n=$(find $S -type f \( -iname '*.html' -o -iname '*.htm' -o -iname '*.svg' -o -iname '*.svgz' -o -iname '*.xml' -o -iname '*.js' -o -iname '*.php' -o -iname '*.exe' -o -iname '*.xhtml' \) 2>/dev/null | wc -l)
if [ "$n" = 0 ]; then bien "ninguna página, SVG ni script en /static"; else falla "$n archivo(s) peligrosos en /static:"; find $S -type f \( -iname '*.html' -o -iname '*.htm' -o -iname '*.svg' -o -iname '*.svgz' -o -iname '*.xml' -o -iname '*.js' -o -iname '*.php' -o -iname '*.exe' -o -iname '*.xhtml' \) 2>/dev/null | head -20 | sed 's/^/         /'; fi

echo "== Servidor"
if command -v ufw >/dev/null; then ufw status 2>/dev/null | grep -q "Status: active" && bien "firewall ufw activo" || falla "firewall ufw apagado"; else aviso "ufw no está instalado"; fi
command -v fail2ban-client >/dev/null && bien "fail2ban instalado" || aviso "fail2ban no está instalado"
grep -qE '^\s*PasswordAuthentication\s+no' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null && bien "SSH sólo con llave" || aviso "SSH acepta contraseña (PasswordAuthentication no)"
abiertos=$(ss -tlnH 2>/dev/null | awk '{print $4}' | grep -vE '^(127\.|\[::1\])' | sed 's/.*://' | sort -un | tr '\n' ' ')
echo "  puertos abiertos hacia fuera: $abiertos"
for p in 5432 6379 9000 3000 5678; do echo " $abiertos " | grep -q " $p " && falla "el puerto $p (base de datos, Redis, API, tienda o n8n) escucha hacia fuera: debe ser sólo 127.0.0.1"; done
command -v clamscan >/dev/null || command -v clamdscan >/dev/null && bien "antivirus ClamAV instalado" || aviso "ClamAV no está instalado: los .rar y .7z se rechazan y los demás archivos se revisan sin antivirus"
[ -f /etc/nginx/conf.d/hetna-limites.conf ] && { grep -q hetna_costosa /etc/nginx/conf.d/hetna-limites.conf && bien "límites de nginx al día" || aviso "hetna-limites.conf es la versión anterior: vuelve a copiarlo"; } || falla "falta /etc/nginx/conf.d/hetna-limites.conf"
grep -rqs hetna-static-seguro /etc/nginx/sites-enabled/ && bien "nginx bloquea páginas en /static" || aviso "falta incluir infra/nginx/hetna-static-seguro.conf en el server de hetnacnc.com"
[ "$(id -un)" = root ] && aviso "esto corre como root: lo ideal es un usuario propio para la tienda"

echo "== Dependencias con avisos de seguridad"
if command -v bun >/dev/null; then (cd "$R" && bun audit 2>/dev/null | tail -2 | sed 's/^/  /'); else aviso "bun no está en el PATH"; fi

echo
[ "$fallas" = 0 ] && echo "Sin FALLAS. Revisa los AVISOS." || echo "$fallas FALLA(S): corrígelas y vuelve a correr."
