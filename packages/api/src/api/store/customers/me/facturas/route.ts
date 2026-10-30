import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorFactura, T_FACTURA, asegurarTablaFacturas, facturaPublica, solicitarFactura } from "../../../../../lib/facturas"

// Facturas de los pedidos del cliente.
//   GET  /store/customers/me/facturas           -> sus solicitudes y facturas
//   POST /store/customers/me/facturas { order_id } -> pide la factura al taller del pedido
const clienteId = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = clienteId(req)
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaFacturas(knex)
  const filas = await knex(T_FACTURA).where({ customer_id: id }).orderBy("created_at", "desc").limit(200)
  return res.json({ facturas: filas.map(facturaPublica) })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = clienteId(req)
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const orderId = String((req.body as any)?.order_id || "")
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return res.status(400).json({ message: "Pedido no válido." })
  try {
    await solicitarFactura(req.scope, id, orderId, req.scope.resolve("logger"))
    return res.json({ ok: true })
  } catch (e) {
    if (e instanceof ErrorFactura) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
