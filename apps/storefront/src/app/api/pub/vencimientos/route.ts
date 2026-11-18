// Lo llama n8n una vez al día. Apaga los anuncios vencidos y devuelve a los anunciantes que vencen en
// 5 días o menos (una sola vez cada uno) para mandarles el recordatorio de renovación.
// Protegido con el mismo token de n8n (N8N_REDES_TOKEN) en la cabecera x-hetna-token.

import { secretoIgual } from "@/lib/seguridad/secreto-igual"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/foro/db"
import { asegurarEsquema } from "@/lib/publicidad/esquema"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const esperado = process.env.N8N_REDES_TOKEN
  if (!esperado || !secretoIgual(req.headers.get("x-hetna-token"), esperado)) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    await asegurarEsquema()
    // Vencen por fecha (periodo) o porque ya se cumplieron las vistas compradas (paquete)
    const vencidos = await db().query(
      `update publicidad.pedidos p set estado = 'vencido'
       where p.estado = 'pagado' and (
         p.vence < now()
         or (p.modalidad = 'vistas' and exists (select 1 from publicidad.piezas z where z.id = p.pieza_id and z.vistas >= p.vistas_compradas))
       )
       returning p.pieza_id`
    )
    const piezas = vencidos.rows.map((r) => r.pieza_id).filter(Boolean)
    if (piezas.length) await db().query(`update publicidad.piezas set activo = false where id = any($1::uuid[])`, [piezas])
    if (vencidos.rowCount) revalidateTag("publicidad")

    // Recordatorio: a 5 días de vencer, o un paquete de vistas que ya va en 90%
    const porVencer = await db().query(
      `update publicidad.pedidos p set recordado = true
       where p.estado = 'pagado' and p.recordado = false and (
         (p.modalidad <> 'vistas' and p.vence < now() + interval '5 days')
         or (p.modalidad = 'vistas' and exists (select 1 from publicidad.piezas z where z.id = p.pieza_id and z.vistas >= p.vistas_compradas * 0.9))
       )
       returning p.id, p.anunciante, p.nombre, p.correo, p.telefono, p.espacio, p.vence, p.modalidad, p.token`
    )
    return NextResponse.json({
      vencidos: vencidos.rowCount || 0,
      // Cada uno trae la liga de su panel (estadísticas y renovar)
      porVencer: (porVencer.rows as { id: string; token: string | null }[]).map(({ token, ...f }) => ({
        ...f,
        panel: token ? `https://hetnacnc.com/mx/anunciate/mi-anuncio?pedido=${f.id}&t=${token}` : null,
      })),
      renovar: "https://hetnacnc.com/mx/anunciate",
    })
  } catch (e) {
    console.error("[publicidad] vencimientos", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error al revisar vencimientos." }, { status: 500 })
  }
}
