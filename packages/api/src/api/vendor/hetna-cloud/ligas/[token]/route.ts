// DELETE /vendor/hetna-cloud/ligas/:token — revoca una liga compartida.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_LIGA, asegurarCloud } from "../../../../../lib/cloud"

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  await knex(T_LIGA).where({ token: String(req.params.token), seller_id: sellerId }).update({ revocada_en: knex.fn.now() })
  return res.json({ ok: true })
}
