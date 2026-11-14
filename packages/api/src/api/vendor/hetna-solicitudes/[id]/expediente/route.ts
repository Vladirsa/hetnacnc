// GET /vendor/hetna-solicitudes/:id/expediente — liga de 1 hora al expediente
// del proyecto, sólo para el taller elegido (lib/expediente.ts).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { tokenExpedienteTaller } from "../../../../../lib/expediente"
import { STORE_URL, T_SOLICITUD } from "../../../../../lib/licitacion"
import { relacionTaller } from "../../../../../lib/licitacion-privacidad"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const rel = await relacionTaller(knex, s, sellerId)
  if (!rel.elegido) return res.status(403).json({ message: "El expediente lo ve el taller elegido para el trabajo." })
  return res.json({ url: `${STORE_URL}/mx/expediente/${tokenExpedienteTaller(s.id, sellerId)}` })
}
