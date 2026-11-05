// POST /vendor/hetna-cloud/importar-pedidos — trae los pedidos pagados de la
// tienda del taller (últimos 90 días) como proyectos de HetNa Cloud.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarCloud, importarPedidos } from "../../../../lib/cloud"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  try {
    const n = await importarPedidos(req.scope, knex, sellerId)
    return res.json({ importados: n })
  } catch (e) {
    logger.error(`[cloud] no se importaron pedidos de ${sellerId}: ${(e as Error).message}`)
    return res.status(503).json({ message: "No pudimos traer tus pedidos. Intenta en un momento." })
  }
}
