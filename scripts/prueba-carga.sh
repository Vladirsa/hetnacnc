#!/usr/bin/env bash
# Prueba de carga ligera (auditoría tecnológica del 21 nov 2026, prueba 1).
# Simula visitantes al mismo tiempo en las páginas que más se usan y dice
# cuántas peticiones por segundo aguanta y cuánto tarda en responder.
#
# Sólo hace lecturas (GET): no compra, no cotiza, no crea cuentas.
# Córrela en horario de poco tráfico (de noche) y desde TU computadora,
# no desde el VPS (si no, mides el VPS contra sí mismo):
#
#   bash scripts/prueba-carga.sh                      # 20 visitantes, 30 s por página
#   bash scripts/prueba-carga.sh https://hetnacnc.com 50 60
#
# Necesita Node.js (usa autocannon con npx, no instala nada permanente).
H="${1:-https://hetnacnc.com}"
CONEXIONES="${2:-20}"
SEGUNDOS="${3:-30}"
PAGINAS=(/mx /mx/tienda /mx/categories /mx/talleres /mx/fabricacion /mx/cnc/corte-laser-mdf /mx/servicios/cotizador-cnc)

echo "Prueba de carga contra $H — $CONEXIONES visitantes a la vez, $SEGUNDOS s por página"
echo "(Cloudflare puede frenar la prueba si la ve como ataque: si ves muchos 429/403, baja los visitantes)"
echo
printf '%-34s %10s %10s %10s %8s\n' "Página" "pet/seg" "prom ms" "p99 ms" "errores"
for p in "${PAGINAS[@]}"; do
  r=$(npx --yes autocannon@7 -j -c "$CONEXIONES" -d "$SEGUNDOS" "$H$p" 2>/dev/null)
  node -e '
    const r = JSON.parse(process.argv[1] || "{}"); const p = process.argv[2]
    const err = (r.errors || 0) + (r.non2xx || 0)
    console.log(p.padEnd(34), String(Math.round(r.requests?.average || 0)).padStart(10), String(Math.round(r.latency?.average || 0)).padStart(10), String(Math.round(r.latency?.p99 || 0)).padStart(10), String(err).padStart(8))
  ' "$r" "$p"
done
echo
echo "Cómo leerlo: 'prom ms' debajo de 800 está bien; 'p99 ms' arriba de 3000 o errores > 0 hay que revisar."
