// Marcar como pagado lo disponible de un taller, después de hacerle el SPEI.
//   POST /admin/hetna-saldos/pagar { seller_id, referencia, metodo?, order_ids? }
// También: { order_id, retener: "motivo" } para no pagar un pedido (reclamo,
// archivo que no corresponde, contracargo).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { marcarPagado, retener } from "../../../../lib/saldos-talleres"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  if (typeof b.retener === "string" && typeof b.order_id === "string") {
    const n = await retener(req.scope, b.order_id, b.retener.trim() || "Retenido por HETNA")
    return res.json({ ok: true, retenidos: n })
  }
  const sellerId = typeof b.seller_id === "string" ? b.seller_id : ""
  const referencia = typeof b.referencia === "string" ? b.referencia.trim() : ""
  if (!sellerId || referencia.length < 4) {
    return res.status(400).json({ message: "Falta el taller o la referencia del pago (clave de rastreo del SPEI)." })
  }
  const orderIds = Array.isArray(b.order_ids) ? (b.order_ids as unknown[]).filter((x): x is string => typeof x === "string") : undefined
  const metodo = ["spei", "mercadopago", "paypal"].includes(String(b.metodo)) ? String(b.metodo) : "spei"
  const n = await marcarPagado(req.scope, sellerId, { referencia, metodo, orderIds })
  res.json({ ok: true, pagados: n })
}
