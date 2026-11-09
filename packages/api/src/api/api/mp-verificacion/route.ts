// Aviso de Mercado Pago del pago de verificación (plan Gratis, $299).
// (https://hetnacnc.com/api/mp-verificacion). No se confía en el cuerpo: el
// pago se consulta a Mercado Pago (lib/confianza.ts).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { confirmarPagoVerificacion } from "../../../lib/confianza"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const pagoId = String(b?.data?.id || q["data.id"] || q.id || "")
  if (tipo !== "payment" || !/^\d+$/.test(pagoId)) return res.status(200).json({ ok: true })
  try {
    await confirmarPagoVerificacion(knex, pagoId, logger)
    return res.status(200).json({ ok: true })
  } catch (e) {
    logger.error(`[verificacion] error procesando aviso ${pagoId}: ${(e as Error).message}`)
    return res.status(500).json({ ok: false })
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
