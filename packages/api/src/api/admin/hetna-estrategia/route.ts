// HETNA Panel → Estrategia (sólo el dueño): indicadores de la estrategia de
// liderazgo con la comparación contra los 30 días anteriores (lib/tablero-estrategia).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { tableroEstrategia } from "../../../lib/tablero-estrategia"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    res.json(await tableroEstrategia(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
  } catch (e) {
    res.status(502).json({ message: `No se pudo leer: ${(e as Error).message}` })
  }
}
