// Envío que corresponde a los productos de cada taller en el carrito.
//
// 1. POST /store/carts/:id/shipping-methods: no deja elegir un envío de otro tipo.
//    Cada taller tiene "Entrega digital" ($0, perfil digital) junto a sus envíos
//    físicos en la misma zona (lib/envios-automaticos.ts) y el listado de Mercur
//    no filtra por perfil. Con un producto físico y "Entrega digital", el cliente
//    pagaba y el pedido tronaba al completar, con Mercado Pago ya cobrado.
//    Regla: si el taller tiene algún producto físico en el carrito, la opción debe
//    tener el perfil de uno de ellos (los digitales no necesitan envío); si sólo
//    tiene digitales, el perfil de uno de ellos. Si algo no se puede leer, se deja
//    pasar (lo sigue validando Mercur al completar).
//
// 2. POST /store/carts/:id/complete: los productos digitales quedan como "no
//    requiere envío" (lib/envio-digital.ts) para que un taller con físico y
//    digital en el mismo carrito se complete con su único envío físico.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { marcarDigitalesSinEnvio, perfilesDigitales } from "../../../lib/envio-digital"

type Oferta = { seller_id?: string | null; shipping_profile_id?: string | null }

export function perfilValido(
  opcion: { shipping_profile_id?: string | null; seller_ids: string[] },
  ofertas: Oferta[],
  digitales: Set<string> = new Set()
): boolean {
  if (!opcion.shipping_profile_id || !opcion.seller_ids.length) return true
  const delTaller = ofertas.filter((o) => o.seller_id && opcion.seller_ids.includes(o.seller_id) && o.shipping_profile_id)
  if (!delTaller.length) return true
  const fisicas = delTaller.filter((o) => !digitales.has(String(o.shipping_profile_id)))
  const validas = fisicas.length ? fisicas : delTaller
  return validas.some((o) => o.shipping_profile_id === opcion.shipping_profile_id)
}

async function revisarPerfil(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const optionId = (req.body as { option_id?: unknown } | undefined)?.option_id
  const cartId = req.params?.id
  if (typeof optionId !== "string" || !cartId) return next()
  let valido = true
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: opciones } = await query.graph({ entity: "shipping_option", fields: ["id", "shipping_profile_id", "seller.id"], filters: { id: optionId } })
    const o = opciones[0] as { shipping_profile_id?: string | null; seller?: { id: string } | { id: string }[] | null } | undefined
    if (o) {
      const sellers = (Array.isArray(o.seller) ? o.seller : o.seller ? [o.seller] : []).map((s) => s.id)
      const { data: carritos } = await query.graph({ entity: "cart", fields: ["id", "items.offer.seller_id", "items.offer.shipping_profile_id"], filters: { id: cartId } })
      const ofertas = ((carritos[0] as any)?.items || [])
        .map((i: any) => (Array.isArray(i?.offer) ? i.offer[0] : i?.offer))
        .filter(Boolean)
      valido = perfilValido({ shipping_profile_id: o.shipping_profile_id, seller_ids: sellers }, ofertas, await perfilesDigitales(req.scope))
    }
  } catch (e) {
    req.scope.resolve("logger").warn(`[envio-perfil] no se pudo revisar ${optionId}: ${(e as Error).message}`)
    return next()
  }
  if (!valido) {
    return res.status(400).json({
      type: "invalid_data",
      message: "Ese tipo de envío no corresponde a los productos de este taller. Elige otra opción de envío.",
    })
  }
  next()
}

async function digitalesSinEnvio(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const cartId = req.params?.id
  if (cartId) {
    await marcarDigitalesSinEnvio(req.scope, cartId).catch((e) =>
      req.scope.resolve("logger").warn(`[envio-perfil] no se pudieron marcar los digitales de ${cartId}: ${(e as Error).message}`)
    )
  }
  next()
}

export const storeEnvioPerfilMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/carts/:id/shipping-methods", middlewares: [revisarPerfil] },
  { method: ["POST"], matcher: "/store/carts/:id/complete", middlewares: [digitalesSinEnvio] },
]
