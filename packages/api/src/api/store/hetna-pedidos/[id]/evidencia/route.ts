// Foto o video de evidencia del comprador, uno por vez (multipart: archivo).
//   POST /store/hetna-pedidos/:id/evidencia  -> { id }
// Queda "suelta" hasta que se envía el reclamo; si no se envía, se borra al día.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { listaDeArchivos } from "../../../../cam-multipart"
import { ErrorReclamo, guardarEvidencia, pedidoDelCliente } from "../../../../../lib/reclamos-pedido"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  const orderId = String(req.params.id || "")
  if (!customerId) return res.status(401).json({ message: "Inicia sesión de nuevo." })
  const [subido] = listaDeArchivos(req)
  if (!subido) return res.status(400).json({ message: "No llegó ningún archivo." })
  const p = await pedidoDelCliente(req.scope, orderId, customerId)
  if (!p) return res.status(404).json({ message: "No encontramos ese pedido." })
  if (p.reclamo) return res.status(409).json({ message: "Ya enviaste tu reporte de este pedido." })
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    res.json(await guardarEvidencia(knex, { orderId, autor: "cliente", autorId: customerId, contenido: subido.buffer }))
  } catch (e) {
    if (e instanceof ErrorReclamo) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
