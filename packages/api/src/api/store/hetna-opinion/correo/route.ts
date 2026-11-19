// Encuesta de los 7 días (lib/opiniones.ts), con la liga firmada del correo.
//   GET  /store/hetna-opinion/correo?t=...            -> { quien, nombre }
//   POST /store/hetna-opinion/correo { t, puntaje, comentario } -> { ok }
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { datosDe, guardarOpinion, leerTokenEncuesta } from "../../../../lib/opiniones"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const t = leerTokenEncuesta((req.query as any)?.t)
  if (!t) return res.status(400).json({ message: "La liga ya no es válida." })
  const d = await datosDe(req.scope, t.quien, t.id).catch(() => null)
  if (!d) return res.status(404).json({ message: "La liga ya no es válida." })
  res.json({ quien: t.quien, nombre: String(d.nombre || "").split(" ")[0] })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  const t = leerTokenEncuesta(b.t)
  if (!t) return res.status(400).json({ message: "La liga ya no es válida." })
  try {
    const d = await datosDe(req.scope, t.quien, t.id)
    if (!d) return res.status(404).json({ message: "La liga ya no es válida." })
    const r = await guardarOpinion(req.scope, { quien: t.quien, actor_id: t.id, nombre: d.nombre, email: d.email, puntaje: b.puntaje, comentario: b.comentario, origen: "encuesta" })
    res.status(r.ok ? 200 : 400).json(r)
  } catch (e) {
    req.scope.resolve("logger").warn(`[opiniones] encuesta ${t.id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo." })
  }
}
