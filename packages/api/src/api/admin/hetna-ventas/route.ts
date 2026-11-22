// GET /admin/hetna-ventas?dias=30 — Vista "Ventas": tienda, licitaciones y cobros
// por liga de la app del Cotizador en una sola lista (lib/ventas-unificadas.ts).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listarVentas } from "../../../lib/ventas-unificadas"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = await listarVentas(req.scope, { dias: Number(req.query.dias) || 30 })
  res.json(r)
}
