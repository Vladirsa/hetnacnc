import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { pagoComisionMercadoPago } from "../../../lib/cotizador-comisiones"

// Aviso de Mercado Pago del pago de la comisión mensual (PayPal) de un taller:
// https://hetnacnc.com/api/mp-comision (va como notification_url de cada cobro).
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const id = String(b?.data?.id || q["data.id"] || q.id || "")
  res.status(200).json({ ok: true })
  if (!id || (tipo && tipo !== "payment")) return
  try {
    await pagoComisionMercadoPago(id, logger)
  } catch (e) {
    logger.error(`[comisiones] aviso ${id}: ${(e as Error).message}`)
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
