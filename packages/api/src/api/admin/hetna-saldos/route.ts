// Pagos a talleres: cuánto se le debe a cada uno.
//   GET /admin/hetna-saldos              -> por taller: pendiente, disponible, pagado
//   GET /admin/hetna-saldos?seller_id=…  -> los pedidos de ese taller
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SALDO, asegurarTablaSaldos, diasLiberacion, filaParaRespuesta, netoTaller } from "../../../lib/saldos-talleres"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  await asegurarTablaSaldos(knex)
  const sellerId = String((req.query as any)?.seller_id || "")

  if (sellerId) {
    const filas = await knex(T_SALDO).where({ seller_id: sellerId }).orderBy("creado", "desc").limit(300)
    return res.json({ movimientos: filas.map(filaParaRespuesta) })
  }

  const filas = await knex(T_SALDO).select("seller_id", "estado", "moneda", "productos", "envio", "comision", "envio_al_taller")
  const porTaller = new Map<string, { seller_id: string; moneda: string; pendiente: number; disponible: number; pagado: number; retenido: number }>()
  for (const f of filas) {
    const k = `${f.seller_id}|${f.moneda}`
    const t = porTaller.get(k) || { seller_id: f.seller_id, moneda: f.moneda, pendiente: 0, disponible: 0, pagado: 0, retenido: 0 }
    ;(t as any)[f.estado] = Math.round(((t as any)[f.estado] + netoTaller(f)) * 100) / 100
    porTaller.set(k, t)
  }
  const ids = [...new Set([...porTaller.values()].map((t) => t.seller_id))]
  const { data: sellers } = ids.length
    ? await query.graph({ entity: "seller", fields: ["id", "name", "email", "payment_details.*"], filters: { id: ids } })
    : { data: [] as any[] }
  const info = new Map((sellers as any[]).map((s) => [s.id, s]))
  res.json({
    dias_liberacion: diasLiberacion(),
    talleres: [...porTaller.values()]
      .map((t) => {
        const s = info.get(t.seller_id) || {}
        const pd = Array.isArray(s.payment_details) ? s.payment_details[0] : s.payment_details
        return {
          ...t,
          nombre: s.name || t.seller_id,
          email: s.email || null,
          // Para hacer el SPEI: titular y cuenta/CLABE que el taller guardó en su panel
          titular: pd?.holder_name || null,
          cuenta: pd?.account_number || pd?.iban || null,
        }
      })
      .sort((a, b) => b.disponible - a.disponible),
  })
}
