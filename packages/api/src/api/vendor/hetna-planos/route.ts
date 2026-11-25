// Panel del taller > Ofertar en planos (lib/planos-ofertas.ts)
//   GET  /vendor/hetna-planos -> { planos: PlanoTaller[], limites }
//   POST /vendor/hetna-planos { product_id, dias, envio_gratis, variantes: [{ variant_id, precio | null }] }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { DIAS, ErrorOferta, PRECIO, guardarOfertaPlano, planosParaTaller, validarOfertaPlano } from "../../../lib/planos-ofertas"

const vendedor = (req: AuthenticatedMedusaRequest) => {
  const ctx = (req as any).seller_context as { seller_id?: string; seller_member?: { member_id?: string } } | undefined
  return { sellerId: ctx?.seller_id, memberId: ctx?.seller_member?.member_id || req.auth_context?.actor_id }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId } = vendedor(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    res.json({ planos: await planosParaTaller(req.scope, sellerId), limites: { dias: DIAS, precio: PRECIO } })
  } catch (e) {
    req.scope.resolve("logger").error(`[planos-ofertas] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron cargar los planos." })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId, memberId } = vendedor(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    const d = validarOfertaPlano((req.body || {}) as Record<string, unknown>)
    res.json(await guardarOfertaPlano(req.scope, sellerId, memberId, d))
  } catch (e) {
    if (e instanceof ErrorOferta) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[planos-ofertas] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar tu oferta. Intenta de nuevo; si sigue, avísanos por WhatsApp." })
  }
}
