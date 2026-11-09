// GET /hooks/social-hub/clic?c=<codigo> -> { destino } y cuenta el clic.
// Lo usa la tienda en hetnacnc.com/r/<codigo> (Social Hub, Fase 5A).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { registrarClic } from "../../../../lib/social-hub"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const codigo = String((req.query as any)?.c || "")
  if (!/^[a-z0-9]{7}$/.test(codigo)) return res.status(404).json({ message: "Liga no encontrada." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const r = await registrarClic(knex, codigo).catch(() => null)
  if (!r) return res.status(404).json({ message: "Liga no encontrada." })
  res.json(r)
}
