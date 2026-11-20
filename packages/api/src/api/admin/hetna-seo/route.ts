// Agente SEO a mano (lib/seo-titulos.ts)
//   POST /admin/hetna-seo { probar?: true, max?: 3 } -> { revisados, aplicados, sugeridos }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { correrAgenteSeo } from "../../../lib/seo-titulos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as { probar?: boolean; max?: number }
  try {
    res.json(await correrAgenteSeo(req.scope, { probar: b.probar === true, max: Math.min(30, Math.max(1, Number(b.max) || 5)) }))
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}
