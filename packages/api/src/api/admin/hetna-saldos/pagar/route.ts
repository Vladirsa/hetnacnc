// Marcar como pagado lo disponible de un taller, después de hacerle el SPEI.
//   POST /admin/hetna-saldos/pagar { seller_id, referencia, metodo?, order_ids? }
// También: { order_id, retener: "motivo" } para no pagar un pedido (reclamo,
// archivo que no corresponde, contracargo).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { SaldoCambio, marcarPagado, retener } from "../../../../lib/saldos-talleres"
import { estadoRequisitos } from "../../../../lib/requisitos-vendedor"
import { servicioTalleres } from "../../../../lib/alta-taller"

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
  // La tarjeta verificada ya no se pide para publicar, sino antes de cobrar
  // (17 nov 2026): sin ella no se marca el pago, para no transferir a un
  // taller que nunca comprobó ser un negocio real.
  try {
    const taller = await servicioTalleres(req.scope).retrieveSeller(sellerId)
    const e = estadoRequisitos(taller)
    if (!e.exento && !e.tarjeta.ok) {
      return res.status(409).json({ message: "Este taller todavía no verifica su tarjeta. Pídele que lo haga en su panel, en \"Activa tu cuenta\", antes de transferirle." })
    }
  } catch {
    return res.status(404).json({ message: "No encontramos ese taller." })
  }
  const totalVisto = typeof b.total === "number" && Number.isFinite(b.total) ? b.total : undefined
  const moneda = typeof b.moneda === "string" ? b.moneda : undefined
  try {
    const n = await marcarPagado(req.scope, sellerId, { referencia, metodo, orderIds, totalVisto, moneda })
    res.json({ ok: true, pagados: n })
  } catch (e) {
    if (e instanceof SaldoCambio) return res.status(409).json({ message: e.message })
    throw e
  }
}
