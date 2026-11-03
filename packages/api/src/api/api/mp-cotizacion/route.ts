import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { registrarPago } from "../../../lib/cotizacion-liga"

// Aviso de Mercado Pago para los anticipos de cotizaciones:
// https://hetnacnc.com/api/mp-cotizacion
// Va como notification_url en cada preferencia (no hace falta registrarlo en
// el panel de Mercado Pago). No se confía en el cuerpo: se consulta el pago
// con el token del taller y se verifica collector y external_reference.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const id = String(b?.data?.id || q["data.id"] || q.id || "")
  const userId = b.user_id != null ? String(b.user_id) : undefined

  res.status(200).json({ ok: true }) // Mercado Pago sólo necesita un 200 rápido
  if (!id || (tipo && tipo !== "payment")) return

  try {
    await registrarPago(id, userId, logger)
  } catch (e) {
    logger.error(`[cotizador] error con el aviso de pago ${id}: ${(e as Error).message}`)
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
