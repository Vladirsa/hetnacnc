import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { preapprovalDePago, sincronizarSuscripcion } from "../../../lib/cotizador-suscripciones"

// Aviso de Mercado Pago para las suscripciones del Cotizador:
// https://hetnacnc.com/api/mp-suscripcion
// (Mercado Pago > Tus integraciones > Webhooks, eventos "Planes y suscripciones").
//
// No se confía en el cuerpo: se consulta la suscripción a Mercado Pago con
// nuestra llave y sólo se acepta external_reference "cotizador:<taller>:<plan>".
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const id = String(b?.data?.id || q["data.id"] || q.id || "")

  res.status(200).json({ ok: true }) // Mercado Pago sólo necesita un 200 rápido
  if (!id) return

  try {
    if (tipo === "subscription_preapproval" || tipo === "preapproval") {
      await sincronizarSuscripcion(id, logger)
    } else if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") {
      const pre = await preapprovalDePago(id)
      if (pre) await sincronizarSuscripcion(pre, logger)
    }
  } catch (e) {
    logger.error(`[cotizador] error con el aviso de Mercado Pago ${tipo} ${id}: ${(e as Error).message}`)
  }
}

// Mercado Pago a veces valida la URL con GET.
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
