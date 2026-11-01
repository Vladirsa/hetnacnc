// Videos del curso: las lecciones de vista previa para cualquiera; todas para
// quien está inscrito. Sesión opcional.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { accesoCurso } from "../../../../../lib/cursos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const acceso = await accesoCurso(req.scope, req.params.slug, req.auth_context?.actor_id || null)
  if (!acceso) return res.status(404).json({ message: "Ese curso no existe" })
  res.setHeader("Cache-Control", "private, no-store")
  res.json(acceso)
}
