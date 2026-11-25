// "Todo bien, liberar pago": el comprador acepta que su pedido llegó completo y
// en buen estado, y el pago queda disponible para el taller al instante.
//   POST /store/hetna-pedidos/:id/liberar
// Ver lib/reclamos-pedido.ts.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorReclamo, liberarPorComprador } from "../../../../../lib/reclamos-pedido"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  const orderId = String(req.params.id || "")
  if (!customerId) return res.status(401).json({ message: "Inicia sesión de nuevo." })
  try {
    await liberarPorComprador(req.scope, orderId, customerId)
    res.json({ ok: true, mensaje: "¡Gracias! Liberaste el pago al taller. Que disfrutes tu compra." })
  } catch (e) {
    if (e instanceof ErrorReclamo) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
