import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avisoMercadoPago } from "../../../lib/licitacion-cobro"

// Aviso de Mercado Pago para pagos de licitación (https://hetnacnc.com/api/mp-licitacion).
// No confiamos en el cuerpo: el pago se consulta a Mercado Pago (con la llave de
// HETNA o, si el cobro fue directo al taller, con el token del taller; viene
// `?sol=<id>` en la URL) y sólo se acepta external_reference
// "licitacion:<id>[:anticipo|resto|total]" con moneda MXN y monto que no pase el saldo.
// La ruta vieja /hooks/mp-licitacion usa este mismo manejador.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const pagoId = String(b?.data?.id || q["data.id"] || q.id || "")
  const sol = /^[A-Za-z0-9_]{6,60}$/.test(String(q.sol || "")) ? String(q.sol) : null

  if (tipo !== "payment" || !/^\d+$/.test(pagoId)) return res.status(200).json({ ok: true })
  // Se procesa antes de responder: si algo falla (Supabase, Mercado Pago, la
  // base) se responde 500 y Mercado Pago vuelve a avisar. Anotar el mismo pago
  // dos veces no cuenta doble (externo_id único).
  try {
    await avisoMercadoPago(knex, pagoId, sol, logger)
    return res.status(200).json({ ok: true })
  } catch (e) {
    logger.error(`[licitacion] error procesando aviso de Mercado Pago ${pagoId}: ${(e as Error).message}`)
    return res.status(500).json({ ok: false })
  }
}

// Mercado Pago a veces valida la URL con GET.
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
