// Dashboard > Opiniones (lib/opiniones.ts)
//   GET /admin/hetna-opiniones?quien=taller|cliente -> { opiniones[], nps }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listarOpiniones } from "../../../lib/opiniones"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, string>
  res.json(await listarOpiniones(req.scope, { quien: q.quien, limite: Number(q.limite) || 200 }))
}
