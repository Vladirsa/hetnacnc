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
bun install

paso "Construyendo (si esto falla, el sitio NO se toca)"
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
pm2 restart hetna-api hetna-web --update-env

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
# /mx/taller ya no: desde el 30 de octubre redirige (308) a la app del cotizador.
for ruta in "/" "/mx/herramientas-cnc" "/mx/laboratorio-cam"; do
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
  echo "    git reset --hard $antes && bun run build && pm2 restart hetna-api hetna-web"
  exit 1
fi

paso "Listo"
verde "$(git log --oneline -1)"
