// POST /store/courses/:slug/avance { lesson_id, completada } — el alumno
// inscrito marca una lección como vista (o la desmarca).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { marcarLeccion } from "../../../../../lib/cursos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const body = (req.body || {}) as { lesson_id?: unknown; completada?: unknown }
  const lessonId = typeof body.lesson_id === "string" ? body.lesson_id : ""
  if (!/^[\w-]{4,80}$/.test(lessonId)) return res.status(400).json({ message: "Lección inválida" })
  const r = await marcarLeccion(req.scope, req.params.slug, req.auth_context.actor_id, lessonId, body.completada !== false)
  if (!r.ok) return res.status(r.status).json({ message: r.mensaje })
  res.json({ ok: true })
}
