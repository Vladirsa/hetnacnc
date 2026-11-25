// GET /mx/planos/[slug]/redes/[n] → SVG 1080 × 1350 (n = 1 a 4) del carrusel de
// redes de un plano (lib/planos/redes.ts). No va en /api: en el servidor /api/*
// lo atiende el backend. El PNG lo hace el backend (packages/api/src/lib/
// planos-imagen.ts, /api/planos-redes/[slug]/[n]): en la tienda de producción
// sharp no carga dentro de la ruta.
import { buscarPlano } from "@/lib/planos/fuente"
import { svgRedes } from "@/lib/planos/redes"

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params
  const pl = await buscarPlano(slug)
  const svg = pl ? svgRedes(pl, Number(n)) : null
  if (!svg) return new Response("No existe", { status: 404 })
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } })
}
