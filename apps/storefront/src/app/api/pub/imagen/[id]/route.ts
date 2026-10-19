// Sirve la imagen de un anuncio pagado (guardada en la base). Los pedidos sin pagar no se muestran.

import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/foro/db"
import { UUID } from "@/lib/publicidad/pedidos"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 })
  try {
    const r = await db().query(
      `select imagen, imagen_tipo from publicidad.pedidos where id = $1 and estado = 'pagado' and imagen is not null`,
      [id]
    )
    const f = r.rows[0]
    if (!f) return new NextResponse(null, { status: 404 })
    return new NextResponse(new Uint8Array(f.imagen as Buffer), {
      headers: { "Content-Type": f.imagen_tipo, "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    })
  } catch (e) {
    console.error("[publicidad] imagen", e instanceof Error ? e.message : e)
    return new NextResponse(null, { status: 500 })
  }
}
