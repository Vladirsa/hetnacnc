#!/usr/bin/env bash
#
# Despliega hetnacnc.com desde main. Un solo comando, siempre el mismo.
#
# Por qué existe: el 19 de octubre el sitio se cayó tres veces en una tarde.
# Ninguna falla fue del código que se estaba publicando. Fueron secuencias
# improvisadas -- un build que faltó, una rama que no era, un pull que se
# abortó a medias y nadie leyó. Este guion hace siempre los mismos pasos en
# el mismo orden, y se detiene en el primero que falle en vez de seguir.
#
# Las tres reglas que lo gobiernan:
#
#   1. Sólo despliega desde main. Si el servidor está en otra rama, se para.
#   2. Sólo avanza en línea recta (--ff-only). Si el servidor tiene commits
#      propios, se para y lo dice -- nunca mezcla a tus espaldas, que es
#      justo como se formaron las tres ramas divergentes.
#   3. Si el build falla, NO reinicia nada. El sitio se queda sirviendo lo
#      que ya tenía, que funciona.
#
# Uso, en el VPS (srv2007412). El repo vive aquí:
#
#   cd /root/hetnacnc
#   ./scripts/desplegar.sh
#
# La comprobación final reintenta hasta 150 segundos antes de darse por
# vencida. Si la máquina está cargada y hace falta más, se le sube:
#
#   DESPLIEGUE_ESPERA=300 ./scripts/desplegar.sh
#
# Desde /root a secas falla con "not a git repository": hay que entrar primero.
# No hace falta empujar nada desde el servidor -- el guion hace el pull de main
# él solo.
#
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

RAMA_ESPERADA="main"
SITIO="${SITIO_URL:-https://hetnacnc.com}"

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

abortar() {
  rojo "✗ $1"
  [ $# -gt 1 ] && printf '\n  %s\n' "$2"
  exit 1
}

# --- 1. ¿Estamos donde debemos? ---

paso "Revisando el estado del repositorio"

rama="$(git branch --show-current)"
if [ "$rama" != "$RAMA_ESPERADA" ]; then
  abortar "El servidor está en la rama '$rama', no en '$RAMA_ESPERADA'." \
    "Producción vive en $RAMA_ESPERADA. Cámbiate con: git checkout $RAMA_ESPERADA"
fi

# Archivos que el propio build reescribe en cada corrida. Están rastreados en
# git, así que después de construir el árbol siempre queda "sucio" por ellos --
# si contaran como cambios, este guion bloquearía todos los despliegues desde
# el segundo. No son trabajo de nadie: se regeneran solos.
GENERADOS=(
  "packages/api/.mercur/routes.d.ts"
  # `bun install` reescribe el lockfile en el servidor (los parches de Mercur
  # le cambian entradas): se descarta antes de instalar, nunca es trabajo.
  "bun.lock"
)

sucios="$(git status --porcelain --untracked-files=no)"
for g in "${GENERADOS[@]}"; do
  sucios="$(printf '%s\n' "$sucios" | grep -v -F -- "$g" || true)"
done
sucios="$(printf '%s' "$sucios" | sed '/^[[:space:]]*$/d')"

if [ -n "$sucios" ]; then
  printf '%s\n' "$sucios"
  abortar "Hay cambios sin guardar en el servidor." \
    "Guárdalos con un commit o descártalos antes de desplegar. Editar archivos directo en el servidor es como empiezan las ramas divergentes."
fi

# Los generados se descartan para que el avance en línea recta no choque con
# ellos. Van a volver a escribirse en el build de más abajo.
for g in "${GENERADOS[@]}"; do
  git checkout -- "$g" 2>/dev/null || true
done

# --- 2. Traer lo nuevo, sin mezclar nunca ---

paso "Trayendo $RAMA_ESPERADA"

antes="$(git rev-parse HEAD)"
git fetch origin "$RAMA_ESPERADA"

if ! git merge-base --is-ancestor HEAD "origin/$RAMA_ESPERADA"; then
  abortar "El servidor tiene commits que no están en origin/$RAMA_ESPERADA." \
    "Eso es una rama divergente. Súbelos (git push origin $RAMA_ESPERADA) o descártalos; no los mezcles aquí."
fi

git merge --ff-only "origin/$RAMA_ESPERADA"
despues="$(git rev-parse HEAD)"

if [ "$antes" = "$despues" ]; then
  echo "   Ya estaba al día en $(git log --oneline -1)"
else
  echo "   $(git rev-list --count "$antes..$despues") commit(s) nuevos:"
  git log --oneline "$antes..$despues" | head -10 | sed 's/^/     /'
fi

# --- 3. Construir. Si truena, aquí se acaba. ---

paso "Revisando que no falte ningún import de componente"
# Barato y antes de todo lo demás: este repo publica con
# `typescript: { ignoreBuildErrors: true }`, así que un <Componente> sin
# importar compila y tumba la página al dibujarla. Ya pasó una vez.
node scripts/revisar-jsx.mjs

paso "Instalando dependencias"
# El lockfile bueno es el de GitHub: si la corrida anterior lo tocó, se vuelve
# a dejar como viene del repositorio antes de instalar.
git checkout -- bun.lock 2>/dev/null || true
bun install

# La Fábrica de contenido (Marketing HETNA) arma los videos con FFmpeg. Si el
# servidor no lo tiene, se instala una sola vez. Si no se puede, sólo avisa:
# el resto del sitio no depende de esto.
if ! command -v ffmpeg >/dev/null 2>&1; then
  paso "Instalando FFmpeg (videos de la Fábrica de contenido)"
  (apt-get install -y ffmpeg >/dev/null 2>&1 || (apt-get update >/dev/null 2>&1 && apt-get install -y ffmpeg >/dev/null 2>&1)) \
    && verde "✓ FFmpeg instalado" \
    || printf '\033[33m%s\033[0m\n' "No se pudo instalar FFmpeg; los cortos de video no se producirán hasta instalarlo (apt-get install -y ffmpeg)."
fi

# Voz de respaldo para los videos (Piper, licencia MIT, corre en CPU): si
# RunPod no responde, la voz se hace aquí. Voces es_MX y en_US. Si no se puede
# descargar, sólo avisa. (Autorizado por el dueño el 11 nov 2026.)
PIPER_DIR=/opt/piper
if [ ! -x "$PIPER_DIR/piper/piper" ]; then
  paso "Instalando la voz de respaldo (Piper)"
  mkdir -p "$PIPER_DIR/voces" \
    && curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz | tar -xz -C "$PIPER_DIR" \
    && verde "✓ Piper instalado" \
    || printf '\033[33m%s\033[0m\n' "No se pudo instalar Piper; los videos usarán sólo la voz de RunPod."
fi
if [ -x "$PIPER_DIR/piper/piper" ]; then
  for v in es/es_MX/claude/high/es_MX-claude-high en/en_US/lessac/medium/en_US-lessac-medium; do
    f="$PIPER_DIR/voces/$(basename "$v").onnx"
    if [ ! -s "$f" ]; then
      curl -fsSL -o "$f" "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/$v.onnx" \
        && curl -fsSL -o "$f.json" "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/$v.onnx.json" \
        && verde "✓ Voz $(basename "$v")" || { rm -f "$f"; printf '\033[33m%s\033[0m\n' "No se pudo bajar la voz $(basename "$v")."; }
    fi
  done
fi

# Videos animados de la Fábrica (HyperFrames, Apache-2.0) + Chrome sin pantalla
# para hacerlos. HyperFrames queda en /opt/hyperframes y Chrome en ~/.cache/hyperframes, fuera del sitio. Los videos se
# hacen uno a la vez con prioridad mínima; si esto no se instala, la Fábrica
# sigue con los videos de FFmpeg. (Chrome autorizado por el dueño el 11 nov 2026.)
HF_DIR=/opt/hyperframes
HF_VERSION=0.8.217
if [ "$(cat "$HF_DIR/.version" 2>/dev/null)" != "$HF_VERSION" ]; then
  paso "Instalando HyperFrames $HF_VERSION y Chrome (videos animados)"
  mkdir -p "$HF_DIR"
  HF_LOG="$HF_DIR/instalacion.log"
  : > "$HF_LOG"
  # Librerías de Chrome sin pantalla. Una por una: en Ubuntu 24 varias se llaman
  # con "t64" al final (libatk1.0-0t64…) y si se piden juntas y una no existe,
  # no se instala ninguna.
  apt-get update >>"$HF_LOG" 2>&1 || true
  for pkg in libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 libxshmfence1 fonts-liberation; do
    apt-get install -y "$pkg" >>"$HF_LOG" 2>&1 || apt-get install -y "${pkg}t64" >>"$HF_LOG" 2>&1 || echo "falta librería: $pkg" >>"$HF_LOG"
  done
  HF_PASO="npm"
  (cd "$HF_DIR" && { [ -f package.json ] || echo '{"name":"hetna-hyperframes","private":true}' > package.json; } \
    && npm install --no-audit --no-fund --omit=dev "hyperframes@$HF_VERSION" gsap@3.15.0 >>"$HF_LOG" 2>&1) \
    && HF_PASO="descargar Chrome" \
    && (cd "$HF_DIR" && HF_CLI_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 node_modules/.bin/hyperframes browser ensure >>"$HF_LOG" 2>&1) \
    && HF_PASO="arrancar Chrome" \
    && HF_CHROME="$(cd "$HF_DIR" && HF_CLI_TELEMETRY_DISABLED=1 node_modules/.bin/hyperframes browser path 2>>"$HF_LOG" | tail -1)" \
    && "$HF_CHROME" --version >>"$HF_LOG" 2>&1 \
    && echo "$HF_VERSION" > "$HF_DIR/.version" \
    && verde "✓ HyperFrames y Chrome listos" \
    || {
      printf '\033[33m%s\033[0m\n' "✗ No se pudo instalar HyperFrames/Chrome (paso: $HF_PASO); los videos seguirán con FFmpeg. Detalle: $HF_LOG"
      # Qué librerías le faltan a Chrome (si ya se descargó)
      [ -n "$HF_CHROME" ] && [ -x "$HF_CHROME" ] && ldd "$HF_CHROME" 2>/dev/null | grep "not found" | sed 's/^/✗ Chrome necesita: /' | head -8
      grep -aE "falta librería|npm ERR|Error|error" "$HF_LOG" | tail -6 | sed 's/^/✗ /'
    }
fi

paso "Construyendo (si esto falla, el sitio NO se toca)"
# La tienda se construye en la carpeta que NO está sirviendo (.next-a o
# .next-b) y se cambia de carpeta al reiniciar. Antes se construía encima de
# .next mientras el sitio la usaba: se caían páginas durante el build y a veces
# el build mismo tronaba con "ENOENT pages-manifest.json".
DIST_ACTUAL="$(cat apps/storefront/.dist-actual 2>/dev/null || echo .next)"
if [ "$DIST_ACTUAL" = ".next-a" ]; then DIST_NUEVA=".next-b"; else DIST_NUEVA=".next-a"; fi
rm -rf "apps/storefront/$DIST_NUEVA"
export NEXT_DIST_DIR="$DIST_NUEVA"
echo "   tienda: sirviendo desde $DIST_ACTUAL, construyendo en $DIST_NUEVA"
bun run build

# --- 4. Base de datos ---

paso "Aplicando migraciones"
(cd packages/api && ./node_modules/.bin/medusa db:migrate)

# La base del foro va aparte (HETNA_FORO_DB, en Supabase). Corre sólo las
# migraciones de infra/foro que falten. Si la base del foro no responde, avisa
# y sigue: el sitio no se queda sin publicar por el foro.
paso "Aplicando migraciones del foro"
node scripts/migrar-foro.mjs --suave

# --- 5. Reiniciar, ya con todo verificado ---

paso "Reiniciando los procesos"
# Primero el API y, sólo cuando ya contesta, la tienda. Antes se reiniciaban
# juntos: la tienda queda lista en ~1 s pero Medusa tarda decenas de segundos,
# y en ese hueco cada página que pide datos daba 500 ("fetch failed" y
# "la API no contestó al pedir las regiones" en pm2 logs hetna-web). Lo
# detectó la prueba k6 del 11 de noviembre: 11 de 14 productos con 500/502.
# Así la tienda vieja sigue sirviendo (con lo que tenga en caché) y la nueva
# arranca con el API ya arriba.
pm2 restart hetna-api --update-env
echo "   esperando a que el API conteste antes de reiniciar la tienda…"
inicio_api="$(date +%s)"
while :; do
  codigo_api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:9000/health 2>/dev/null || true)"
  [ "$codigo_api" = "200" ] && break
  [ $(( $(date +%s) - inicio_api )) -ge "${DESPLIEGUE_ESPERA:-150}" ] && break
  sleep 2
done
if [ "$codigo_api" = "200" ]; then
  verde "   ✓ API arriba en $(( $(date +%s) - inicio_api ))s"
else
  rojo "   ✗ El API no contestó (${codigo_api:-000}); se reinicia la tienda de todos modos"
fi
# NEXT_DIST_DIR va en el entorno: hetna-web arranca ya desde la carpeta nueva
pm2 restart hetna-web --update-env
# Microcaché de nginx (infra/nginx/CACHE-PAGINAS.md): las copias guardadas
# apuntan a los archivos /_next/static del build anterior y hay que tirarlas,
# pero SÓLO cuando la tienda nueva ya contesta. Mientras Next arranca, esas
# copias son lo único que nginx puede servir; vaciarlas antes dejó 14 s con
# 502/500 en la medición k6 del 11 de noviembre. Si la microcaché no está
# instalada, la carpeta no existe y esto no hace nada.
if [ -d /var/cache/nginx/hetna-paginas ]; then
  inicio_web="$(date +%s)"
  while :; do
    codigo_web="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -H 'Cookie: _medusa_cache_id=despliegue; hetna_lang=es' http://127.0.0.1:3000/mx 2>/dev/null || true)"
    [ "$codigo_web" = "200" ] && break
    [ $(( $(date +%s) - inicio_web )) -ge 90 ] && break
    sleep 1
  done
  find /var/cache/nginx/hetna-paginas -type f -delete 2>/dev/null || true
  echo "   microcaché de nginx vaciada (tienda nueva: ${codigo_web:-000} en $(( $(date +%s) - inicio_web ))s)"
fi
echo "$DIST_NUEVA" > apps/storefront/.dist-actual
# Que un reinicio del servidor arranque con la misma carpeta
pm2 save >/dev/null 2>&1 || true

# --- 6. Comprobar que de verdad quedó arriba ---

paso "Comprobando el sitio"

# Se espera a que arranquen reintentando, no con una espera fija.
#
# Antes esto era `sleep 15` y UN intento por ruta. El 24 de octubre dio por
# caído un sitio que estaba perfectamente bien: el API de Medusa tarda más que
# eso en estar listo (carga módulos, enlaces, workflows y subscribers), y ese
# despliegue venía con el build en frío. La comprobación midió antes de tiempo,
# imprimió 500 y 502, y nos mandó a revertir un despliegue bueno.
#
# Una falsa alarma aquí es peor que no comprobar nada: un guion que grita
# "se cayó" cuando no se cayó enseña a desconfiar de él, y entonces el día que
# de verdad se caiga nadie le va a creer. Así que ahora insiste hasta el plazo
# y sólo falla si se le acaba.
ESPERA_MAXIMA="${DESPLIEGUE_ESPERA:-150}"   # segundos
ESPERA_ENTRE=5

fallas=0
# /mx/cam ya no: desde el 28 de octubre redirige (308) a /mx/herramientas-cnc.
# /mx/taller tampoco: desde el 30 de octubre redirige (308) a la página del
# Cotizador, que es la que se revisa ahora, junto con el Laboratorio CAM.
for ruta in "/" "/mx/servicios/cotizador-cnc" "/mx/herramientas-cnc" "/mx/laboratorio-cam"; do
  inicio="$(date +%s)"
  codigo=""
  listo=0

  while :; do
    # `curl` ya escribe 000 cuando no pudo ni conectarse, así que NO se le
    # añade otro con `|| echo`: eso imprimía "000000" y confundía al leerlo.
    # El `|| true` es para que un fallo de curl no aborte el guion (set -e).
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITIO$ruta" 2>/dev/null || true)"
    [ -n "$codigo" ] || codigo="000"
    # Cualquier 2xx o 3xx es un sitio que responde: 307 es el redirect de
    # idioma o el envío al login, y 308 una dirección que se mudó (el 30 de
    # octubre /mx/taller empezó a dar 308 y el guion dio por caído un sitio
    # que estaba bien). Con el API caído, la tienda da 500, no un redirect.
    if [[ "$codigo" =~ ^[23][0-9][0-9]$ ]]; then
      listo=1
      break
    fi
    transcurrido=$(( $(date +%s) - inicio ))
    if [ "$transcurrido" -ge "$ESPERA_MAXIMA" ]; then
      break
    fi
    # Se dice en qué va, para que una espera larga no parezca un cuelgue.
    echo "   … $ruta → $codigo (reintentando, ${transcurrido}s de ${ESPERA_MAXIMA}s)"
    sleep "$ESPERA_ENTRE"
  done

  if [ "$listo" = "1" ]; then
    verde "   ✓ $ruta → $codigo"
  else
    rojo  "   ✗ $ruta → $codigo (sigue mal después de ${ESPERA_MAXIMA}s)"
    fallas=$((fallas + 1))
  fi
done

# El API se revisa directo, sin pasar por la tienda: así un 500 de la tienda
# se puede distinguir de un API que no levantó.
inicio="$(date +%s)"
while :; do
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:9000/health 2>/dev/null || true)"
  [ "$codigo" = "200" ] && break
  [ $(( $(date +%s) - inicio )) -ge "$ESPERA_MAXIMA" ] && break
  sleep "$ESPERA_ENTRE"
done
if [ "$codigo" = "200" ]; then
  verde "   ✓ API (127.0.0.1:9000/health) → 200"
else
  rojo  "   ✗ API (127.0.0.1:9000/health) → ${codigo:-000}"
  fallas=$((fallas + 1))
fi

if [ "$fallas" -gt 0 ]; then
  rojo ""
  rojo "El sitio no responde bien después de reiniciar."
  echo "  Revisa primero si de verdad hay un error, no sólo un arranque lento:"
  echo "    pm2 logs hetna-web --lines 40 --nostream"
  echo "    pm2 logs hetna-api --lines 40 --nostream"
  echo "  Si los logs NO tienen excepciones, lo más probable es que todavía"
  echo "  estuviera arrancando. Comprueba a mano antes de revertir:"
  echo "    curl -s -o /dev/null -w '%{http_code}\n' $SITIO/"
  echo "  Volver (sólo si hay un error de verdad):"
  echo "  La tienda anterior sigue intacta en $DIST_ACTUAL. Volver a ella al instante:"
  echo "    cd $RAIZ && echo $DIST_ACTUAL > apps/storefront/.dist-actual && NEXT_DIST_DIR=$DIST_ACTUAL pm2 restart hetna-web --update-env && pm2 save"
  echo "  Volver todo (código y API):"
  echo "    git reset --hard $antes && bash scripts/desplegar.sh"
  exit 1
fi

# --- 7. Calentar la caché de productos y categorías ---
#
# Cada despliegue arranca la tienda con la caché de fetch vacía (vive dentro de
# .next-a / .next-b). Visitar una vez cada ficha y categoría la llena, y la
# tienda guarda además la última copia buena de cada ficha en memoria
# (lib/data/products.ts). Así, la próxima vez que el API se reinicie, esas
# páginas se sirven igual en vez de dar error. Una por una, sin prisa: es
# tráfico real al VPS. DESPLIEGUE_CALENTAR=0 lo salta.
if [ "${DESPLIEGUE_CALENTAR:-1}" != "0" ]; then
  paso "Calentando la caché de productos y categorías"
  rutas="$(curl -s --max-time 20 "$SITIO/sitemap.xml" \
    | grep -oE '<loc>[^<]+/(products|categories)(/[^<]*)?</loc>' \
    | sed -E 's#</?loc>##g' | sort -u || true)"
  rutas="$SITIO/mx $SITIO/us $rutas"
  ok=0; mal=0
  for url in $rutas; do
    # Con las cookies de un visitante que ya volvió: así la tienda no responde
    # con Set-Cookie y la microcaché de nginx (si está) también guarda la copia.
    # En /us sin hetna_lang, que es como llega un visitante nuevo de EE. UU.
    galleta="_medusa_cache_id=calentar-cache"
    case "$url" in */us|*/us/*) ;; *) galleta="$galleta; hetna_lang=es" ;; esac
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -A 'Mozilla/5.0 (hetna-calentar)' -H "Cookie: $galleta" "$url" 2>/dev/null || true)"
    if [ "$codigo" = "200" ]; then ok=$((ok + 1)); else mal=$((mal + 1)); echo "   ✗ $codigo $url"; fi
  done
  if [ "$mal" -gt 0 ]; then verde "   ✓ $ok páginas en caché ($mal con error)"; else verde "   ✓ $ok páginas en caché"; fi
fi

paso "Listo"
verde "$(git log --oneline -1)"
