// Ver una foto o video de un reclamo (dashboard).
//   GET /admin/hetna-reclamos-compras/:id/archivos/:archivo
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_RECLAMO, asegurarTablasReclamo, encabezadosEvidencia, leerEvidencia } from "../../../../../../lib/reclamos-pedido"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasReclamo(knex)
  const r = await knex(T_RECLAMO).where({ id: String(req.params.id || "") }).first()
  if (!r) return res.status(404).json({ message: "No encontrado." })
  const a = await leerEvidencia(knex, r.order_id, String(req.params.archivo || ""))
  if (!a || a.reclamo_id !== r.id) return res.status(404).json({ message: "No encontrado." })
  res.set(encabezadosEvidencia(a.mime)).send(a.datos)
}
