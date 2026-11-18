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
# Lo que de verdad usa cada proceso. Un valor puede estar en varios lugares y
# gana el primero: lo que pm2 guardó al arrancar el proceso, luego los archivos.
#   API (Medusa):  pm2 > .env.production > .env
#   Tienda (Next): pm2 > .env.production.local > .env.local > .env.production > .env
# El 18 nov 2026 el API corría con el secreto de ejemplo guardado en pm2 aunque
# el .env tenía uno bueno: por eso aquí NO basta con leer el .env.
command -v node >/dev/null || { echo "Falta node en el PATH: no se puede revisar."; exit 2; }
# Una sola pasada: "proceso<TAB>NOMBRE<TAB>origen<TAB>valor" por cada llave, y
# "proceso<TAB>@pm2<TAB>si|no" para saber si se pudo leer lo que guarda pm2.
TABLA="$( (pm2 jlist 2>/dev/null || true) | node -e '
  const fs=require("fs"),path=require("path");const raiz=process.argv[1];let d="";
  process.stdin.on("data",c=>d+=c).on("end",()=>{
    // Igual que dotenv: export opcional, comillas, comentario al final, CRLF
    const leer=f=>{const o={};let t;try{t=fs.readFileSync(f,"utf8")}catch{return o}
      for(const l0 of t.split(/\r?\n/)){const m=/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l0);if(!m)continue;let v=m[2];
        const q=/^(["\x27`])((?:\\.|(?!\1).)*)\1/.exec(v);v=q?q[2]:v.replace(/\s+#.*$/,"").trim();o[m[1]]=v}
      return o};
    let ps=[];let leido=false;try{const i=d.indexOf("[");ps=JSON.parse(i>=0?d.slice(i):d);leido=Array.isArray(ps)}catch{}
    const uno=(nombre,dirPorOmision,archivos)=>{
      const p=leido?ps.find(x=>x&&x.name===nombre):null;const e=(p&&p.pm2_env)||{};
      const pm=p?Object.assign({},e.env||{},e):{};const dir=(p&&e.pm_cwd)||dirPorOmision;
      console.log([nombre,"@pm2",p?"si":"no"].join("\t"));console.log([nombre,"@dir",dir].join("\t"));
      const capas=archivos.map(a=>[a,leer(path.join(dir,a))]);
      const llaves=new Set();for(const[,o]of capas)for(const k of Object.keys(o))llaves.add(k);
      for(const k of Object.keys(pm))if(typeof pm[k]==="string"&&/^[A-Z][A-Z0-9_]*$/.test(k))llaves.add(k);
      for(const k of llaves){let de="",v="";if(typeof pm[k]==="string"){de="pm2";v=pm[k]}else for(const[a,o]of capas)if(k in o){de=a;v=o[k];break}
        console.log([nombre,k,de,String(v).replace(/[\t\n\r]/g," ")].join("\t"))}
    };
    uno("hetna-api",path.join(raiz,"packages/api"),[".env.production",".env"]);
    uno("hetna-web",path.join(raiz,"apps/storefront"),[".env.production.local",".env.local",".env.production",".env"]);
  })' "$R" 2>/dev/null)"
campo() { printf '%s\n' "$TABLA" | awk -F'\t' -v p="$1" -v k="$2" -v n="$3" '$1==p && $2==k {print $n; exit}'; }
valor_fila() { printf '%s\n' "$TABLA" | awk -F'\t' -v p="$1" -v k="$2" '$1==p && $2==k {sub(/^[^\t]*\t[^\t]*\t[^\t]*\t/,""); print; exit}'; }
# valor <archivo .env del API o de la tienda> <NOMBRE>: el valor que de verdad se usa
valor() { case "$1" in "$API") valor_fila hetna-api "$2" ;; *) valor_fila hetna-web "$2" ;; esac; }
origen() { campo hetna-api "$1" 3; }
PM2_API="$(campo hetna-api @pm2 3)"

echo "== ¿Se pudo leer lo que guarda pm2?"
if [ "$PM2_API" = si ]; then bien "proceso hetna-api encontrado en pm2 (carpeta: $(campo hetna-api @dir 3))"
else falla "no pude leer el proceso hetna-api de pm2 (¿otro usuario, otro nombre o pm2 sin instalar?). Lo de abajo sale SÓLO de los archivos .env y puede no ser lo que usa el API: corre esto con el mismo usuario que corre pm2"; fi

echo "== Archivos .env"
for f in "$API" "$WEB"; do
  [ -f "$f" ] || { aviso "no existe $f"; continue; }
  p=$(stat -c '%a' "$f"); [ "$p" = 600 ] && bien "$f sólo lo lee su dueño (600)" || falla "$f tiene permisos $p → corre: chmod 600 $f"
done
git -C "$R" ls-files --error-unmatch packages/api/.env >/dev/null 2>&1 && falla "packages/api/.env está dentro de git" || bien "el .env no está en git"

echo "== Secretos de sesión y de firma (lo que de verdad usa el API)"
for v in JWT_SECRET COOKIE_SECRET; do
  x=$(valor "$API" $v); de=$(origen $v)
  if [ -z "$x" ]; then falla "$v está vacío"; elif [ "$x" = supersecret ]; then falla "$v vale el de ejemplo (supersecret); sale de: $de. Con la versión anterior del API cualquiera podía fabricar sesiones; con la actual se usa uno al azar y las sesiones se cierran en cada reinicio. Pon uno propio"; elif [ ${#x} -lt 32 ]; then falla "$v es corto (${#x} letras; sale de: $de; usa openssl rand -hex 64)"; else bien "$v propio y largo (sale de: $de)"; fi
done
[ "$(valor "$API" JWT_SECRET)" != "$(valor "$API" COOKIE_SECRET)" ] && bien "JWT_SECRET y COOKIE_SECRET son distintos" || falla "JWT_SECRET y COOKIE_SECRET son iguales"
for v in BAJA_SECRET ARCHIVOS_SECRETO STOREFRONT_REVALIDATE_SECRET N8N_REDES_TOKEN ESCANEO_CALLBACK_SECRET; do
  x=$(valor "$API" $v); [ -n "$x" ] && [ "$x" != supersecret ] && bien "$v puesto" || aviso "$v vacío o de ejemplo (si usas esa función, ponle un secreto propio)"
done

echo "== Valores del .env que NO se están usando (otro lugar le gana)"
otros=0
if [ -f "$API" ]; then
  for k in $(grep -oE '^[A-Za-z0-9_]+=' "$API" | tr -d '=' | sort -u); do
    de=$(origen "$k"); enarchivo=$(grep -E "^$k=" "$API" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    if [ -n "$de" ] && [ "$de" != ".env" ] && [ "$(valor "$API" "$k")" != "$enarchivo" ]; then aviso "$k: manda $de, no el .env"; otros=$((otros + 1)); fi
  done
fi
if [ "$PM2_API" != si ]; then aviso "sin pm2 no se puede saber si algo le gana al .env"; elif [ "$otros" = 0 ]; then bien "todo lo del .env del API es lo que se usa"; fi

echo "== Modo de producción"
[ "$(valor "$API" NODE_ENV)" = production ] && bien "API con NODE_ENV=production" || aviso "el API no tiene NODE_ENV=production ni en pm2 ni en sus .env (medusa start lo pone solo; confírmalo con: pm2 logs hetna-api --lines 5 --nostream)"
for v in PAYPAL_SANDBOX SKYDROPX_SANDBOX META_CAPI_TEST_CODE CSP_SOLO_REPORTE; do
  x="$(valor "$API" $v)$(valor "$WEB" $v)"; case "$x" in ""|0|false|off) bien "$v apagado";; *) falla "$v está encendido en producción";; esac
done
case "$(valor "$API" MERCADOPAGO_ACCESS_TOKEN)" in TEST-*) falla "Mercado Pago con llave de PRUEBA";; "") aviso "MERCADOPAGO_ACCESS_TOKEN vacío";; *) bien "Mercado Pago con llave real";; esac
case "$(valor "$API" FILE_BACKEND_URL)" in https://*) bien "FILE_BACKEND_URL con https";; *) falla "FILE_BACKEND_URL vacío o sin https (las ligas de archivos salen mal)";; esac

echo "== CORS"
for v in STORE_CORS ADMIN_CORS VENDOR_CORS AUTH_CORS APP_CORS; do
  x=$(valor "$API" $v); case "$x" in *localhost*|*127.0.0.1*) falla "$v incluye localhost";; *docs.medusajs.com*|*http://*) falla "$v incluye un origen de fábrica o sin https";; "") [ $v = APP_CORS ] && bien "$v vacío" || falla "$v vacío";; *"*"*) falla "$v incluye *";; *) bien "$v sin localhost ni *";; esac
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
