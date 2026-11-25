// Foto o video de evidencia del taller, uno por vez (multipart: archivo).
//   POST /vendor/hetna-reclamos/:id/evidencia -> { id }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { listaDeArchivos } from "../../../../cam-multipart"
import { ErrorReclamo, T_RECLAMO, asegurarTablasReclamo, guardarEvidencia } from "../../../../../lib/reclamos-pedido"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const [subido] = listaDeArchivos(req)
  if (!subido) return res.status(400).json({ message: "No llegó ningún archivo." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasReclamo(knex)
  const r = await knex(T_RECLAMO).where({ id: String(req.params.id || ""), seller_id: sellerId }).first()
  if (!r) return res.status(404).json({ message: "No encontramos ese reclamo." })
  if (r.respuesta_taller || r.estado === "resuelto") return res.status(409).json({ message: "Este reclamo ya no acepta evidencia." })
  try {
    res.json(await guardarEvidencia(knex, { orderId: r.order_id, autor: "taller", autorId: sellerId, contenido: subido.buffer }))
  } catch (e) {
    if (e instanceof ErrorReclamo) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
