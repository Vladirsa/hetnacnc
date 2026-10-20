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
# Uso:
#   ./scripts/desplegar.sh
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

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  abortar "Hay cambios sin guardar en el servidor." \
    "Guárdalos con un commit o descártalos antes de desplegar. Editar archivos directo en el servidor es como empiezan las ramas divergentes."
fi

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

paso "Instalando dependencias"
bun install

paso "Construyendo (si esto falla, el sitio NO se toca)"
bun run build

# --- 4. Base de datos ---

paso "Aplicando migraciones"
(cd packages/api && ./node_modules/.bin/medusa db:migrate)

# --- 5. Reiniciar, ya con todo verificado ---

paso "Reiniciando los procesos"
pm2 restart hetna-api hetna-web --update-env

# --- 6. Comprobar que de verdad quedó arriba ---

paso "Comprobando el sitio"
echo "   Esperando a que arranquen…"
sleep 15

fallas=0
for ruta in "/" "/mx/taller" "/mx/cam"; do
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITIO$ruta" || echo "000")"
  # 200 y 307 son normales: 307 es el redirect de idioma o el envío al login.
  if [ "$codigo" = "200" ] || [ "$codigo" = "307" ]; then
    verde "   ✓ $ruta → $codigo"
  else
    rojo  "   ✗ $ruta → $codigo"
    fallas=$((fallas + 1))
  fi
done

if [ "$fallas" -gt 0 ]; then
  rojo ""
  rojo "El sitio no responde bien después de reiniciar."
  echo "  Revisa:  pm2 logs hetna-web --lines 40 --nostream"
  echo "  Volver:  git reset --hard $antes && bun run build && pm2 restart hetna-api hetna-web"
  exit 1
fi

paso "Listo"
verde "$(git log --oneline -1)"
