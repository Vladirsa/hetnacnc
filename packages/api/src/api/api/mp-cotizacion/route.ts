import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { errorDefinitivo, unaVezALaVez } from "../../../lib/aviso-unico"
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

  if (!id || (tipo && tipo !== "payment")) return res.status(200).json({ ok: true })

  // Se responde después de procesar: si algo falla, 500 y Mercado Pago
  // reintenta (antes un fallo dejaba el anticipo sin anotar). Los avisos del
  // mismo pago van uno tras otro para no duplicar el pedido (auditoría Thermos).
  try {
    await unaVezALaVez(`mp:${id}`, () => registrarPago(id, userId, logger))
    res.status(200).json({ ok: true })
  } catch (e) {
    if (errorDefinitivo(e)) {
      logger.warn(`[cotizador] aviso de pago ${id}: ${(e as Error).message}; no se reintenta`)
      return res.status(200).json({ ok: true })
    }
    logger.error(`[cotizador] error con el aviso de pago ${id}: ${(e as Error).message}`)
    res.status(500).json({ ok: false })
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
