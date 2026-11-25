// Cotizar el envío de cada taller sólo con SUS productos.
//
// Medusa le pasa a la paquetería (modules/skydropx) los renglones del carrito con
// el mismo perfil de envío que la opción, sin importar el taller. Todos los
// productos físicos comparten el perfil "Marketplace Shipping", así que en un
// carrito con dos talleres cada uno cobraba el envío por el peso de TODO el carrito.
//
// Este hook agrega al contexto de la cotización qué renglones son de cada almacén
// (el almacén de la opción es el del taller, context.from_location): la
// paquetería se queda sólo con los de su taller.
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  calculateShippingOptionsPricesWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"

export const CLAVE_RENGLONES = "hetna_renglones_por_almacen"
export const CLAVE_ORIGENES = "hetna_origen_por_almacen"
// Renglones cuya oferta trae envío gratis (lo pone el taller en "Ofertar en planos")
export const CLAVE_GRATIS = "hetna_renglones_envio_gratis"

async function renglonesPorAlmacen({ input }: { input: { cart_id?: string } }, { container }: { container: any }) {
  const cartId = input?.cart_id
  if (!cartId) return new StepResponse({})
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carritos } = await query.graph({ entity: "cart", fields: ["id", "items.id", "items.offer.seller_id", "items.offer.metadata"], filters: { id: cartId } })
    const porTaller = new Map<string, string[]>()
    const gratis: string[] = []
    for (const r of ((carritos[0] as any)?.items || []) as any[]) {
      const oferta = Array.isArray(r?.offer) ? r.offer[0] : r?.offer
      if (!oferta?.seller_id) continue
      if (oferta.metadata?.envio_gratis === true) gratis.push(r.id)
      porTaller.set(oferta.seller_id, [...(porTaller.get(oferta.seller_id) || []), r.id])
    }
    if (!porTaller.size) return new StepResponse({})
    const { data: talleres } = await query.graph({
      entity: "seller",
      fields: ["id", "stock_locations.id", "address.postal_code", "address.province", "address.city", "address.address_2"],
      filters: { id: [...porTaller.keys()] },
    })
    const mapa: Record<string, string[]> = {}
    const origenes: Record<string, { postal_code?: string | null; province?: string | null; city?: string | null; address_2?: string | null }> = {}
    for (const t of talleres as any[]) {
      for (const l of (t.stock_locations || []) as { id: string }[]) {
        mapa[l.id] = porTaller.get(t.id) || []
        // La dirección del taller: la misma con la que se compra la guía (lib/guias.ts)
        if (t.address) origenes[l.id] = t.address
      }
    }
    return new StepResponse({ [CLAVE_RENGLONES]: mapa, [CLAVE_ORIGENES]: origenes, [CLAVE_GRATIS]: gratis })
  } catch (e) {
    // Sin el mapa se cotiza como antes (todos los renglones del perfil)
    container.resolve("logger").warn(`[envio-por-taller] ${cartId}: ${(e as Error).message}; se cotiza con todo el carrito`)
    return new StepResponse({})
  }
}

listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext(renglonesPorAlmacen as any)
calculateShippingOptionsPricesWorkflow.hooks.setCalculatedShippingPricingContext(renglonesPorAlmacen as any)
