// Tablero del taller > ¿Qué mejorarías? (lib/opiniones.ts)
//   POST /vendor/hetna-opinion { puntaje?: 0-10, comentario, pagina? } -> { ok }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { datosDe, guardarOpinion } from "../../../lib/opiniones"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = (req as any).seller_context?.seller_id as string | undefined
  if (!id) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const b = (req.body || {}) as Record<string, unknown>
  try {
    const d = await datosDe(req.scope, "taller", id)
    const r = await guardarOpinion(req.scope, { quien: "taller", actor_id: id, nombre: d?.nombre, email: d?.email, puntaje: b.puntaje, comentario: b.comentario, pagina: b.pagina })
    res.status(r.ok ? 200 : 400).json(r)
  } catch (e) {
    req.scope.resolve("logger").warn(`[opiniones] taller ${id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo." })
  }
}
