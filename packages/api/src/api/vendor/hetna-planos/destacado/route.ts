// Taller destacado en los planos ($199 por 7 días, lib/planos-destacado.ts).
//   POST                -> liga de Mercado Pago
//   POST { payment_id } -> confirma el pago al regresar de Mercado Pago
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { confirmarPagoDestacadoPlanos, ligaPagoDestacadoPlanos } from "../../../../lib/planos-destacado"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const s = await knex("seller").where({ id: sellerId }).first("id", "name", "email", "metadata")
  if (!s) return res.status(401).json({ message: "Sin taller." })
  const pagoId = String(((req.body || {}) as { payment_id?: string }).payment_id || "")
  try {
    if (pagoId) {
      const r = await confirmarPagoDestacadoPlanos(knex, pagoId, req.scope.resolve("logger"))
      if (r.sellerId && r.sellerId !== s.id) return res.status(403).json({ message: "Ese pago es de otro taller." })
      return res.json({ ok: r.ok, hasta: r.hasta || null, motivo: r.motivo || null })
    }
    return res.json({ url: await ligaPagoDestacadoPlanos(s) })
  } catch (e) {
    return res.status((e as { status?: number }).status || 502).json({ message: (e as Error).message || "No se pudo preparar el pago." })
  }
}
