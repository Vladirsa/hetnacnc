// Pago de la verificación para talleres con plan Gratis ($299, una sola vez).
//   GET  -> si debe pagar, cuánto y si ya pagó
//   POST -> liga de Mercado Pago
//   POST { payment_id } -> confirma el pago al regresar de Mercado Pago
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PRECIO_VERIFICACION_GRATIS, confirmarPagoVerificacion, debePagarVerificacion, ligaPagoVerificacion } from "../../../../lib/confianza"
import { planComision } from "../../../../lib/licitacion-cobro"

const tallerDe = async (req: AuthenticatedMedusaRequest) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return null
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  return knex("seller").where({ id: sellerId }).first("id", "name", "email", "metadata")
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const s = await tallerDe(req)
  if (!s) return res.status(401).json({ message: "Sin taller." })
  const plan = await planComision(s).catch(() => "gratis")
  res.json({ plan, debe_pagar: debePagarVerificacion(plan, s), precio: PRECIO_VERIFICACION_GRATIS, pagado: !!s.metadata?.verificacion_pagada?.en })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const s = await tallerDe(req)
  if (!s) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const pagoId = String(((req.body || {}) as { payment_id?: string }).payment_id || "")
  try {
    if (pagoId) {
      const r = await confirmarPagoVerificacion(knex, pagoId, req.scope.resolve("logger"))
      if (r.sellerId && r.sellerId !== s.id) return res.status(403).json({ message: "Ese pago es de otro taller." })
      return res.json({ ok: r.ok, motivo: r.motivo || null })
    }
    const plan = await planComision(s).catch(() => "gratis")
    if (!debePagarVerificacion(plan, s)) return res.json({ ok: true, debe_pagar: false })
    return res.json({ url: await ligaPagoVerificacion(s) })
  } catch (e) {
    return res.status((e as { status?: number }).status || 502).json({ message: (e as Error).message || "No se pudo preparar el pago." })
  }
}
