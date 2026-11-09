// DELETE /vendor/hetna-certificaciones/:id -> el taller quita una certificación suya.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_CERT, asegurarCertificaciones, sincronizarCertificacionesPerfil } from "../../../../lib/confianza"

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCertificaciones(knex)
  const n = await knex(T_CERT).where({ id: String(req.params.id), seller_id: sellerId }).delete()
  if (!n) return res.status(404).json({ message: "No encontrada." })
  await sincronizarCertificacionesPerfil(knex, sellerId)
  res.json({ ok: true })
}
