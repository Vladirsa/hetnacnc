// Marcar como pagado lo disponible de un taller, después de hacerle el SPEI.
//   POST /admin/hetna-saldos/pagar { seller_id, referencia, metodo?, order_ids? }
// También: { order_id, retener: "motivo" } para no pagar un pedido (reclamo,
// archivo que no corresponde, contracargo), y { order_id, liberar: true } para
// quitarle la retención (si el pedido sigue pagado y sin cancelar).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { SaldoCambio, SaldoNoLiberable, liberarRetenido, marcarPagado, retener } from "../../../../lib/saldos-talleres"
import { estadoRequisitos } from "../../../../lib/requisitos-vendedor"
import { servicioTalleres } from "../../../../lib/alta-taller"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  if (typeof b.retener === "string" && typeof b.order_id === "string") {
    const n = await retener(req.scope, b.order_id, b.retener.trim() || "Retenido por HETNA")
    return res.json({ ok: true, retenidos: n })
  }
  if (b.liberar === true && typeof b.order_id === "string") {
    try {
      return res.json({ ok: true, liberados: await liberarRetenido(req.scope, b.order_id) })
    } catch (e) {
      if (e instanceof SaldoNoLiberable) return res.status(409).json({ message: e.message })
      throw e
    }
  }
  const sellerId = typeof b.seller_id === "string" ? b.seller_id : ""
  const referencia = typeof b.referencia === "string" ? b.referencia.trim() : ""
  if (!sellerId || referencia.length < 4) {
    return res.status(400).json({ message: "Falta el taller o la referencia del pago (clave de rastreo del SPEI)." })
  }
  const orderIds = Array.isArray(b.order_ids) ? (b.order_ids as unknown[]).filter((x): x is string => typeof x === "string") : undefined
  const metodo = ["spei", "mercadopago", "paypal"].includes(String(b.metodo)) ? String(b.metodo) : "spei"
  // La tarjeta verificada ya no se pide para publicar sino antes de cobrar
  // (17 nov 2026). La pantalla de pagos lo muestra ANTES de transferir; aquí
  // el SPEI ya se hizo, así que sólo se avisa (bloquear dejaría el saldo como
  // "disponible" y se podría pagar dos veces).
  let aviso: string | null = null
  try {
    const e = estadoRequisitos(await servicioTalleres(req.scope).retrieveSeller(sellerId))
    if (!e.exento && !e.tarjeta.ok) aviso = "Este taller todavía no verifica su tarjeta: pídele que lo haga antes del siguiente pago."
  } catch {
    /* sin datos del taller no se avisa */
  }
  const totalVisto = typeof b.total === "number" && Number.isFinite(b.total) ? b.total : undefined
  const moneda = typeof b.moneda === "string" ? b.moneda : undefined
  try {
    const n = await marcarPagado(req.scope, sellerId, { referencia, metodo, orderIds, totalVisto, moneda })
    res.json({ ok: true, pagados: n, ...(aviso ? { aviso } : {}) })
  } catch (e) {
    if (e instanceof SaldoCambio) return res.status(409).json({ message: e.message })
    throw e
  }
}
