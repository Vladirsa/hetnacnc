// GET /store/customers/me/cursos-terminados — los cursos de la Academia que
// el cliente terminó (todas sus lecciones vistas). Para su perfil profesional.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cursosTerminados } from "../../../../../lib/cursos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión." })
  res.setHeader("Cache-Control", "private, no-store")
  res.json({ cursos: await cursosTerminados(req.scope, customerId) })
}
