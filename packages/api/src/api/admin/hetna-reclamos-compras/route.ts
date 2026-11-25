// Dashboard > Reclamos: compras de la tienda con un problema reportado.
//   GET /admin/hetna-reclamos-compras?estado=abierto|respondido|resuelto
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DECISIONES, MOTIVOS, T_RECLAMO, asegurarTablasReclamo, evidenciasDe, vistaReclamo } from "../../../lib/reclamos-pedido"
import { T_SALDO, asegurarTablaSaldos, netoTaller } from "../../../lib/saldos-talleres"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasReclamo(knex)
  await asegurarTablaSaldos(knex)
  const estado = String((req.query as any)?.estado || "")
  let q = knex(T_RECLAMO).orderBy("creado", "desc").limit(200)
  if (["abierto", "respondido", "resuelto"].includes(estado)) q = q.where({ estado })
  else q = q.whereNot({ estado: "resuelto" })
  const filas = await q
  const ids = filas.map((f: any) => f.order_id)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const sellerIds = [...new Set(filas.map((f: any) => f.seller_id))] as string[]
  const [{ data: pedidos }, { data: sellers }, saldos] = await Promise.all([
    ids.length ? query.graph({ entity: "order", fields: ["id", "email", "items.title", "items.quantity"], filters: { id: ids } }) : { data: [] as any[] },
    sellerIds.length ? query.graph({ entity: "seller", fields: ["id", "name"], filters: { id: sellerIds } }) : { data: [] as any[] },
    ids.length ? knex(T_SALDO).whereIn("order_id", ids).select("*") : [],
  ])
  const ped = new Map((pedidos as any[]).map((o) => [o.id, o]))
  const sel = new Map((sellers as any[]).map((s) => [s.id, s.name]))
  const sal = new Map((saldos as any[]).map((s) => [s.order_id, s]))
  const reclamos: any[] = []
  for (const f of filas) {
    const s = sal.get(f.order_id)
    const o = ped.get(f.order_id)
    reclamos.push({
      ...vistaReclamo(f, await evidenciasDe(knex, f.id)),
      taller: sel.get(f.seller_id) || f.seller_id,
      cliente_email: o?.email || null,
      productos: (o?.items || []).map((i: any) => `${i.quantity} × ${i.title}`),
      saldo: s
        ? { estado: s.estado, moneda: s.moneda, neto: netoTaller(s), cobrado: Math.round(((Number(s.productos) || 0) + (Number(s.envio) || 0)) * 100) / 100 }
        : null,
      saldo_estado_previo: f.saldo_estado_previo,
      guia_sugerida: MOTIVOS[f.motivo as keyof typeof MOTIVOS]?.guia || "taller",
    })
  }
  res.json({ reclamos, decisiones: DECISIONES })
}
