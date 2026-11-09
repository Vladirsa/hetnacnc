// POST /admin/hetna-social/videos/:id { accion: "aprobar", texto?, redes? } | { accion: "rechazar", motivo }
// Al aprobar se crea la publicación con crédito al taller y se programa en el Social Hub.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { aprobarVideo, rechazarVideo } from "../../../../../lib/promocion"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b: any = req.body || {}
  try {
    if (b.accion === "aprobar") return res.json({ ok: true, ...(await aprobarVideo(knex, String(req.params.id), { texto: b.texto, redes: Array.isArray(b.redes) ? b.redes : undefined }, req.scope.resolve("logger"))) })
    if (b.accion === "rechazar") return res.json(await rechazarVideo(knex, String(req.params.id), String(b.motivo || "")))
    return res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.message })
  }
}
