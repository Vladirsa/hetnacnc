// Panel del taller > Reclamos: los problemas que reportaron sus clientes.
//   GET /vendor/hetna-reclamos
// No trae datos de contacto del cliente: todo se responde dentro de HETNA.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  DIAS_HABILES_RESPUESTA,
  MAX_EVIDENCIAS,
  MAX_MB_EVIDENCIA,
  T_RECLAMO,
  asegurarTablasReclamo,
  evidenciasDe,
  vistaReclamo,
} from "../../../lib/reclamos-pedido"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasReclamo(knex)
  const filas = await knex(T_RECLAMO).where({ seller_id: sellerId }).orderBy("creado", "desc").limit(100)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const ids = filas.map((f: any) => f.order_id)
  const { data: pedidos } = ids.length
    ? await query.graph({ entity: "order", fields: ["id", "items.title", "items.quantity"], filters: { id: ids } })
    : { data: [] as any[] }
  const productos = new Map((pedidos as any[]).map((o) => [o.id, (o.items || []).map((i: any) => `${i.quantity} × ${i.title}`)]))
  const reclamos: any[] = []
  for (const f of filas) {
    const v = vistaReclamo(f, await evidenciasDe(knex, f.id))
    reclamos.push({ ...v, productos: productos.get(f.order_id) || [] })
  }
  res.json({ reclamos, dias_respuesta: DIAS_HABILES_RESPUESTA, max_evidencias: MAX_EVIDENCIAS, max_mb: MAX_MB_EVIDENCIA })
}
