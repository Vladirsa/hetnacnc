import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { errorDefinitivo, unaVezALaVez } from "../../../lib/aviso-unico"
import { pagoComisionMercadoPago } from "../../../lib/cotizador-comisiones"

// Aviso de Mercado Pago del pago de la comisión mensual (PayPal) de un taller:
// https://hetnacnc.com/api/mp-comision (va como notification_url de cada cobro).
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const id = String(b?.data?.id || q["data.id"] || q.id || "")
  if (!id || (tipo && tipo !== "payment")) return res.status(200).json({ ok: true })
  // Se responde después de procesar: si algo falla, 500 y Mercado Pago reintenta
  try {
    await unaVezALaVez(`mp:${id}`, () => pagoComisionMercadoPago(id, logger))
    res.status(200).json({ ok: true })
  } catch (e) {
    if (errorDefinitivo(e)) return res.status(200).json({ ok: true })
    logger.error(`[comisiones] aviso ${id}: ${(e as Error).message}`)
    res.status(500).json({ ok: false })
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
