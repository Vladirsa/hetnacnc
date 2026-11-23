// GET /admin/hetna-ficha?q=... — personas o empresas que coinciden con un
// correo, teléfono o nombre (Ficha única, lib/ficha-unica.ts).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { buscarCandidatos } from "../../../lib/ficha-unica"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = String((req.query as any)?.q || "").slice(0, 120)
  res.json(await buscarCandidatos(req.scope, q))
}
