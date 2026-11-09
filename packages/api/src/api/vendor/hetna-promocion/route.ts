// GET /vendor/hetna-promocion -> kit de difusión del taller: insignias, liga medida,
// textos listos, resultados de su liga y sus videos (Marketing HETNA: talleres promotores).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { kitDifusion } from "../../../lib/promocion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const kit = await kitDifusion(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), sellerId)
  if (!kit) return res.status(404).json({ message: "Taller no encontrado." })
  res.json(kit)
}
