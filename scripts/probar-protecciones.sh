#!/usr/bin/env bash
# Prueba desde fuera las protecciones de hetnacnc.com (auditoría del 18 nov 2026).
# Sólo hace peticiones inofensivas: no crea cuentas ni cambia nada.
#
#   ./scripts/probar-protecciones.sh                 # contra https://hetnacnc.com
#   ./scripts/probar-protecciones.sh https://otro    # contra otro dominio
#
# Córrelo después de cada despliegue. Cada línea dice BIEN o FALLA.
H="${1:-https://hetnacnc.com}"
fallas=0
bien()  { printf '  BIEN   %s\n' "$1"; }
falla() { printf '  FALLA  %s\n' "$1"; fallas=$((fallas + 1)); }
codigo() { curl -s -m 20 -o /dev/null -w '%{http_code}' "$@"; }
cab()    { curl -s -m 20 -I "$1" | tr -d '\r' | grep -i "^$2:" | head -1; }

echo "== HTTPS y cabeceras ($H)"
sin_s="http://${H#https://}"
r=$(curl -s -m 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$sin_s/mx")
case "$r" in 30[1278]\ https://*) bien "http:// redirige a https://";; *) falla "http:// no redirige a https:// (respondió: $r)";; esac
[ -n "$(cab "$H/mx" strict-transport-security)" ] && bien "HSTS (obliga HTTPS)" || falla "falta Strict-Transport-Security"
[ -n "$(cab "$H/mx" x-content-type-options)" ] && bien "X-Content-Type-Options" || falla "falta X-Content-Type-Options"
[ -n "$(cab "$H/mx" x-frame-options)" ] && bien "X-Frame-Options (no se puede incrustar el sitio)" || falla "falta X-Frame-Options"
[ -n "$(cab "$H/mx" content-security-policy)" ] && bien "Content-Security-Policy" || falla "falta Content-Security-Policy"
[ -n "$(cab "$H/mx" referrer-policy)" ] && bien "Referrer-Policy" || falla "falta Referrer-Policy"
[ -z "$(cab "$H/mx" x-powered-by)" ] && bien "no anuncia la tecnología (X-Powered-By)" || falla "sobra X-Powered-By"

echo "== Rutas de administración sin sesión (deben rechazar)"
for p in /admin/users /admin/orders /admin/api-keys /admin/hetna-saldos /admin/hetna-social /admin/hetna-conta /vendor/sellers /vendor/products; do
  c=$(codigo "$H$p"); [ "$c" = 401 ] && bien "$p → 401" || falla "$p → $c (se esperaba 401)"
done

echo "== Archivos que no deben servirse"
for p in /.env /.env.production /.git/config /.git/HEAD /backup.sql /bun.lock /_next/static/chunks/main.js.map; do
  cuerpo=$(curl -s -m 20 -L "$H$p" | head -c 400)
  if echo "$cuerpo" | grep -q -E 'DATABASE_URL|JWT_SECRET|\[core\]|ref: refs/|CREATE TABLE|"mappings"'; then falla "$p se está sirviendo"; else bien "$p no se sirve"; fi
done
for p in /static/prueba-seguridad.html /static/prueba-seguridad.svg; do
  c=$(codigo "$H$p"); [ "$c" = 403 ] && bien "$p → 403 (nginx bloquea páginas en /static)" || echo "  AVISO  $p → $c: falta instalar infra/nginx/hetna-static-seguro.conf (el API ya rechaza subirlas)"
done

echo "== CORS: un sitio ajeno no debe recibir permiso"
o=$(curl -s -m 20 -o /dev/null -D - -H "Origin: https://sitio-ajeno.example" "$H/store/regions" | tr -d '\r' | grep -i '^access-control-allow-origin:')
[ -z "$o" ] && bien "sin Access-Control-Allow-Origin para un origen ajeno" || falla "responde $o"

echo "== Límite de intentos de inicio de sesión (40 intentos con contraseña mala)"
n429=$(seq 1 40 | xargs -P 10 -I{} curl -s -m 20 -o /dev/null -w '%{http_code}\n' -X POST "$H/auth/customer/emailpass" \
  -H 'content-type: application/json' -d '{"email":"prueba-seguridad@hetnacnc.invalid","password":"mala-{}"}' | grep -c 429)
[ "$n429" -gt 0 ] && bien "bloqueó $n429 de 40 intentos (429)" || falla "ningún 429: falta infra/nginx/hetna-limites.conf"

echo "== Recuperar contraseña no dice si el correo existe"
c=$(codigo -X POST "$H/auth/customer/emailpass/reset-password" -H 'content-type: application/json' -d '{"identifier":"prueba-seguridad@hetnacnc.invalid"}')
[ "$c" = 201 ] || [ "$c" = 200 ] || [ "$c" = 429 ] && bien "misma respuesta para un correo que no existe ($c)" || falla "respondió $c"

echo "== La API pública no enseña datos privados de los talleres (auditoría 21 nov 2026)"
# Necesita la llave pública de la tienda. En el VPS se toma sola del .env de la tienda.
PK="${PK:-$(grep -h '^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=' "$(dirname "$0")/../apps/storefront/.env" "$(dirname "$0")/../apps/storefront/.env.local" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')}"
if [ -z "$PK" ]; then
  echo "  AVISO  sin llave pública (PK): córrelo en el VPS o con PK=... para esta prueba"
else
  for ruta in "/store/sellers?limit=20&fields=id,email,phone,metadata,payment_details.id" "/store/products?limit=20&fields=id,*seller,seller.payment_details.id"; do
    cuerpo=$(curl -s -m 20 -H "x-publishable-api-key: $PK" "$H$ruta")
    # Sólo se buscan los NOMBRES de los campos; no se imprime ningún valor
    if echo "$cuerpo" | grep -q -E '"(email|phone|payment_details|terminos_ip|terminos_agente|tarjeta|correo_confirmado_email|consentimiento_bancario_en)"'; then
      falla "${ruta%%\?*} devuelve datos privados del taller"
    else
      bien "${ruta%%\?*} sin correo, teléfono, banco ni metadata privada"
    fi
  done
fi

echo
[ "$fallas" = 0 ] && echo "Todo BIEN." || echo "$fallas FALLA(S): revisa arriba."
exit $([ "$fallas" = 0 ] && echo 0 || echo 1)
