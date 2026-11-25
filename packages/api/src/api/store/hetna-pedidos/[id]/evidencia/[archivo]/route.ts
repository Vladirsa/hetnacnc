// Ver una foto o video del reclamo de un pedido propio.
//   GET /store/hetna-pedidos/:id/evidencia/:archivo
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { encabezadosEvidencia, leerEvidencia, pedidoDelCliente } from "../../../../../../lib/reclamos-pedido"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  const orderId = String(req.params.id || "")
  if (!customerId) return res.status(401).json({ message: "Inicia sesión de nuevo." })
  const p = await pedidoDelCliente(req.scope, orderId, customerId)
  if (!p) return res.status(404).json({ message: "No encontrado." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const a = await leerEvidencia(knex, orderId, String(req.params.archivo || ""))
  // Lo suyo (aunque esté suelto) y lo que el taller ya envió en su respuesta
  if (!a || (a.autor === "cliente" ? a.autor_id !== customerId : !a.reclamo_id)) return res.status(404).json({ message: "No encontrado." })
  res.set(encabezadosEvidencia(a.mime)).send(a.datos)
}
