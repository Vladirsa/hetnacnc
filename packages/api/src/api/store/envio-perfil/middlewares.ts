// No deja elegir un envío de otro tipo que los productos del taller en el carrito.
//
// Cada taller tiene "Entrega digital" ($0, perfil "Producto digital") junto a sus
// envíos físicos en la misma zona (lib/envios-automaticos.ts), y el listado de
// Mercur no filtra por perfil. Si a un producto físico le quedaba "Entrega
// digital", el cliente pagaba y el pedido tronaba al completar
// (validateSellerCartShippingStep), con Mercado Pago ya cobrado.
//
// Regla: la opción elegida debe tener el perfil de envío de alguna oferta de ESE
// taller en el carrito. Si algo no se puede leer, se deja pasar (lo sigue
// validando Mercur al completar): sólo se frena un desajuste claro.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export function perfilValido(
  opcion: { shipping_profile_id?: string | null; seller_ids: string[] },
  ofertas: { seller_id?: string | null; shipping_profile_id?: string | null }[]
): boolean {
  if (!opcion.shipping_profile_id || !opcion.seller_ids.length) return true
  const delTaller = ofertas.filter((o) => o.seller_id && opcion.seller_ids.includes(o.seller_id) && o.shipping_profile_id)
  if (!delTaller.length) return true
  return delTaller.some((o) => o.shipping_profile_id === opcion.shipping_profile_id)
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
      valido = perfilValido({ shipping_profile_id: o.shipping_profile_id, seller_ids: sellers }, ofertas)
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

export const storeEnvioPerfilMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/carts/:id/shipping-methods", middlewares: [revisarPerfil] },
]
