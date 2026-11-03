// Lista pública de precios y comisiones de HETNA (lib/tarifas.ts), para los
// Términos para vendedores.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { tarifasHetna } from "../../../lib/tarifas"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "public, max-age=600")
  res.json(await tarifasHetna(req.scope))
}
