import sharp from "sharp"

import { planoPorSlug } from "@/lib/planos/modelos"
import { svgRedes } from "@/lib/planos/redes"

// GET /api/planos/[slug]/redes/[n] → PNG 1080 × 1350 (n = 1 a 4) del carrusel
// para redes de un plano. Lo baja el promotor semanal del backend.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params
  const pl = planoPorSlug(slug)
  const svg = pl ? svgRedes(pl, Number(n)) : null
  if (!svg) return new Response("No existe", { status: 404 })
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } })
}
