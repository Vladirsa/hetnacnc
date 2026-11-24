// GET /store/simulador/certificado — constancia de los ejercicios del simulador
// (sólo si el alumno los aprobó todos).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { constancia } from "../../../../lib/simulador/progreso"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = await constancia(req.scope, req.auth_context.actor_id)
  if (!c) return res.status(403).json({ message: "Aprueba todos los ejercicios para obtener tu constancia." })
  res.setHeader("Cache-Control", "private, no-store")
  res.json(c)
}
