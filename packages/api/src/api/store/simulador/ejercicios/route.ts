// GET /store/simulador/ejercicios — ejercicios calificados (sin las soluciones)
// y, con sesión, el avance del alumno.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listaParaAlumno } from "../../../../lib/simulador/progreso"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cliente = req.auth_context?.actor_id || null
  res.setHeader("Cache-Control", cliente ? "private, no-store" : "public, max-age=300")
  res.json(await listaParaAlumno(req.scope, cliente))
}
