// La misma lista de precios y comisiones (lib/tarifas.ts), para la portada
// del panel del taller.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { tarifasHetna } from "../../../lib/tarifas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await tarifasHetna(req.scope))
}
