// GET /store/courses/:slug/certificado — los datos del certificado, sólo para
// el alumno que terminó todas las lecciones.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { certificadoCurso } from "../../../../../lib/cursos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = await certificadoCurso(req.scope, req.params.slug, req.auth_context.actor_id)
  if (!c) return res.status(403).json({ message: "Termina todas las lecciones para obtener tu certificado." })
  res.setHeader("Cache-Control", "private, no-store")
  res.json(c)
}
