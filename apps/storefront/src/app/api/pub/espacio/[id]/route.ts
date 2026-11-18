// Anuncios vigentes de un espacio, para los componentes del navegador que no
// pueden leer la base (Cotizar y Diseñar viven dentro de componentes cliente).
//   GET /api/pub/espacio/cotizar_disenar
// Sólo campos públicos. Misma memoria de 60 s que el resto (consultas.ts).
import { NextResponse } from "next/server"

import { piezasDe } from "@/lib/publicidad/consultas"
import { esEspacio } from "@/lib/publicidad/tipos"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!esEspacio(id)) return NextResponse.json({ piezas: [] }, { status: 404 })
  const piezas = (await piezasDe(id)).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    subtitulo: p.subtitulo,
    boton: p.boton,
    imagen_url: p.imagen_url,
    anunciante: p.anunciante,
    es_publicidad: p.es_publicidad,
  }))
  return NextResponse.json({ piezas }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } })
}
