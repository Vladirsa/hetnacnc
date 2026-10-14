// Lo llama n8n una vez al día. Apaga los anuncios vencidos y devuelve a los anunciantes que vencen en
// 5 días o menos (una sola vez cada uno) para mandarles el recordatorio de renovación.
// Protegido con el mismo token de n8n (N8N_REDES_TOKEN) en la cabecera x-hetna-token.

import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/foro/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const esperado = process.env.N8N_REDES_TOKEN
  if (!esperado || req.headers.get("x-hetna-token") !== esperado) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    const vencidos = await db().query(
      `update publicidad.pedidos set estado = 'vencido' where estado = 'pagado' and vence < now() returning pieza_id`
    )
    const piezas = vencidos.rows.map((r) => r.pieza_id).filter(Boolean)
    if (piezas.length) await db().query(`update publicidad.piezas set activo = false where id = any($1::uuid[])`, [piezas])
    if (vencidos.rowCount) revalidateTag("publicidad")

    const porVencer = await db().query(
      `update publicidad.pedidos set recordado = true
       where estado = 'pagado' and recordado = false and vence < now() + interval '5 days'
       returning id, anunciante, nombre, correo, telefono, espacio, vence`
    )
    return NextResponse.json({
      vencidos: vencidos.rowCount || 0,
      porVencer: porVencer.rows,
      renovar: "https://hetnacnc.com/mx/anunciate",
    })
  } catch (e) {
    console.error("[publicidad] vencimientos", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error al revisar vencimientos." }, { status: 500 })
  }
}
