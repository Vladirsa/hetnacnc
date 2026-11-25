// Ver una foto o video de un reclamo del taller.
//   GET /vendor/hetna-reclamos/:id/archivos/:archivo
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_RECLAMO, asegurarTablasReclamo, encabezadosEvidencia, leerEvidencia } from "../../../../../../lib/reclamos-pedido"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasReclamo(knex)
  const r = await knex(T_RECLAMO).where({ id: String(req.params.id || ""), seller_id: sellerId }).first()
  if (!r) return res.status(404).json({ message: "No encontrado." })
  const a = await leerEvidencia(knex, r.order_id, String(req.params.archivo || ""))
  // Lo del cliente ya enviado en el reclamo y lo suyo (aunque esté suelto)
  const visible = a && (a.autor === "taller" ? a.autor_id === sellerId : a.reclamo_id === r.id)
  if (!visible) return res.status(404).json({ message: "No encontrado." })
  res.set(encabezadosEvidencia(a!.mime)).send(a!.datos)
}
