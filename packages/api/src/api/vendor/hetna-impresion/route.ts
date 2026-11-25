// Panel "Imprime diseños HETNA" (apps/vendor/src/routes/imprimir).
//   GET  -> los diseños de Impresión 3D bajo pedido, con el precio recomendado
//           por material y la oferta del taller si ya tiene; y su destacado.
//   POST { ofertas: [{ variant_id, activa, precio, dias, colores }] }
//        -> crea, cambia o quita sus ofertas (lib/impresion-catalogo.ts).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DIAS_DESTACADO, ErrorImpresion, MATERIALES_IMPRESION, PRECIO_DESTACADO, destacadoHasta, validarOferta } from "../../../lib/impresion-bajo-pedido"
import { guardarOfertasTaller, panelTaller } from "../../../lib/impresion-catalogo"

const sellerDe = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = sellerDe(req)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const [disenos, s] = await Promise.all([panelTaller(req.scope, sellerId), knex("seller").where({ id: sellerId }).first("id", "metadata")])
  res.json({
    disenos,
    materiales: MATERIALES_IMPRESION.map((m) => ({ material: m.valor, nota: m.nota })),
    destacado: { hasta: destacadoHasta(s), precio: PRECIO_DESTACADO, dias: DIAS_DESTACADO },
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = sellerDe(req)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const lista = ((req.body || {}) as { ofertas?: unknown[] }).ofertas
  if (!Array.isArray(lista) || !lista.length) return res.status(400).json({ message: "No hay cambios que guardar." })
  if (lista.length > 60) return res.status(400).json({ message: "Demasiados cambios a la vez (máximo 60)." })
  try {
    const ofertas = lista.map(validarOferta)
    const memberId = (req as any).auth_context?.actor_id as string | undefined
    const r = await guardarOfertasTaller(req.scope, sellerId, memberId, ofertas)
    res.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ErrorImpresion) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[impresion] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo en un momento." })
  }
}
