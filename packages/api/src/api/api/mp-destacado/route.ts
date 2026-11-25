// Aviso de Mercado Pago del pago de "taller destacado" en Impresión 3D bajo
// pedido y en los planos de la tienda (https://hetnacnc.com/api/mp-destacado). No se confía en el cuerpo:
// el pago se consulta a Mercado Pago (lib/impresion-bajo-pedido.ts).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { confirmarPagoDestacado } from "../../../lib/impresion-bajo-pedido"
import { confirmarPagoDestacadoPlanos } from "../../../lib/planos-destacado"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const pagoId = String(b?.data?.id || q["data.id"] || q.id || "")
  if (tipo !== "payment" || !/^\d+$/.test(pagoId)) return res.status(200).json({ ok: true })
  try {
    // Impresión 3D bajo pedido (destpago:) o planos (destplano:): cada uno ignora la referencia del otro
    const r = await confirmarPagoDestacado(knex, pagoId, logger)
    if (!r.sellerId) await confirmarPagoDestacadoPlanos(knex, pagoId, logger)
    return res.status(200).json({ ok: true })
  } catch (e) {
    logger.error(`[destacado] error procesando aviso ${pagoId}: ${(e as Error).message}`)
    return res.status(500).json({ ok: false })
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
