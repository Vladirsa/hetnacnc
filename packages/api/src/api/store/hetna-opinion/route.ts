// Mi cuenta > ¿Qué mejorarías? (lib/opiniones.ts)
//   POST /store/hetna-opinion { puntaje?: 0-10, comentario, pagina? } -> { ok }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { datosDe, guardarOpinion } from "../../../lib/opiniones"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const b = (req.body || {}) as Record<string, unknown>
  try {
    const d = await datosDe(req.scope, "cliente", id)
    const r = await guardarOpinion(req.scope, { quien: "cliente", actor_id: id, nombre: d?.nombre, email: d?.email, puntaje: b.puntaje, comentario: b.comentario, pagina: b.pagina })
    res.status(r.ok ? 200 : 400).json(r)
  } catch (e) {
    req.scope.resolve("logger").warn(`[opiniones] cliente ${id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo." })
  }
}
