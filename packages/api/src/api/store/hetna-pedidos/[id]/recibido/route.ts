// El comprador avisa que ya recibió su pedido.
//   POST /store/hetna-pedidos/:id/recibido
// Sirve para los envíos que no hizo HETNA con guía (sin rastreo automático):
// desde aquí corren los días para pagarle al taller (lib/saldos-talleres.ts).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { diasLiberacion, marcarEntregado } from "../../../../../lib/saldos-talleres"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  const orderId = String(req.params.id || "")
  if (!customerId || !/^order_[A-Za-z0-9]+$/.test(orderId)) return res.status(400).json({ message: "Pedido inválido." })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "customer_id", "status"], filters: { id: orderId } })
  const pedido = data[0] as { id: string; customer_id?: string; status?: string } | undefined
  // Mismo mensaje si no existe o es de otro cliente: no se revela qué pedidos hay
  if (!pedido || pedido.customer_id !== customerId) return res.status(404).json({ message: "No encontramos ese pedido." })
  if (pedido.status === "canceled") return res.status(409).json({ message: "Ese pedido está cancelado." })

  await marcarEntregado(req.scope, orderId, "comprador")
  res.json({ ok: true, mensaje: `¡Gracias! Le avisamos al taller. Su pago se libera en ${diasLiberacion()} días.` })
}
