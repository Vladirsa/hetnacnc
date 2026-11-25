// Reclamo del comprador sobre un pedido de la tienda (lib/reclamos-pedido.ts).
//   GET  /store/hetna-pedidos/:id/reclamo  -> qué puede hacer y su reclamo, si hay
//   POST /store/hetna-pedidos/:id/reclamo  { motivo, detalle, evidencias: [ids] }
// Las fotos o videos se suben antes, uno por uno, en POST …/evidencia.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { avisarReclamoAbierto } from "../../../../../lib/reclamos-correos"
import { ErrorReclamo, abrirReclamo, estadoParaCliente } from "../../../../../lib/reclamos-pedido"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión de nuevo." })
  const estado = await estadoParaCliente(req.scope, String(req.params.id || ""), customerId)
  if (!estado) return res.status(404).json({ message: "No encontramos ese pedido." })
  res.json(estado)
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión de nuevo." })
  const b = (req.body || {}) as Record<string, unknown>
  try {
    const { reclamo, pedido } = await abrirReclamo(req.scope, {
      orderId: String(req.params.id || ""),
      customerId,
      motivo: b.motivo,
      detalle: b.detalle,
      evidencias: b.evidencias,
    })
    res.json({ ok: true, estado: await estadoParaCliente(req.scope, reclamo.order_id, customerId) })
    await avisarReclamoAbierto(req.scope, reclamo, pedido).catch((e) =>
      (req.scope.resolve("logger") as any).error(`[reclamos] avisos: ${(e as Error).message}`)
    )
  } catch (e) {
    if (e instanceof ErrorReclamo) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
