// POST /store/solicitudes-taller/:token/preguntas/:id  { respuesta }
// El cliente contesta la pregunta de un taller; la ven todos los talleres.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas } from "../../../../../../lib/licitacion"
import { responder } from "../../../../../../lib/licitacion-extra"

export const POST = async (req: MedusaRequest<{ respuesta?: string }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })
  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  try {
    await responder(knex, s, String(req.params.id || ""), String((req.body as any)?.respuesta || ""), logger)
    return res.json({ ok: true })
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo guardar tu respuesta." })
  }
}
