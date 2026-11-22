// Productos digitales en el carrito: no requieren envío.
//
// Mercur marca TODOS los renglones del carrito con requires_shipping = true
// (store/carts/:id/line-items), también los digitales. Al completar,
// validateSellerCartShippingStep pide un envío por cada perfil de los renglones
// que requieren envío, pero Mercur sólo deja UN envío por taller. Un taller con
// un producto físico y uno digital en el mismo carrito nunca podía completarse.
//
// Antes de completar (api/store/envio-perfil y la revisión de Mercado Pago) los
// renglones cuya oferta tiene el perfil digital quedan con requires_shipping =
// false: sólo el producto físico necesita su envío.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export const PERFIL_DIGITAL = "Producto digital"

type Perfil = { id: string; name?: string | null; type?: string | null }
export const esPerfilDigital = (p: Perfil) => p.type === "digital" || p.name === PERFIL_DIGITAL

/** Ids de los perfiles de envío digitales. */
export async function perfilesDigitales(container: Pick<MedusaContainer, "resolve">): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "shipping_profile", fields: ["id", "name", "type"] })
  return new Set((data as Perfil[]).filter(esPerfilDigital).map((p) => p.id))
}

type OfertaRenglon = { shipping_profile_id?: string | null; seller_id?: string | null }
type Renglon = { id: string; requires_shipping?: boolean | null; offer?: OfertaRenglon | OfertaRenglon[] | null }
const ofertaDe = (r: Renglon) => (Array.isArray(r.offer) ? r.offer[0] : r.offer) || null

/**
 * Renglones digitales que todavía dicen "requiere envío", SÓLO de talleres que
 * también traen algo físico. Un taller sólo digital sigue eligiendo su
 * "Entrega digital", como siempre.
 */
export function renglonesPorMarcar(renglones: Renglon[], digitales: Set<string>): string[] {
  const esDigital = (r: Renglon) => digitales.has(String(ofertaDe(r)?.shipping_profile_id || ""))
  const conFisico = new Set(renglones.filter((r) => !esDigital(r)).map((r) => String(ofertaDe(r)?.seller_id || "")))
  return renglones
    .filter((r) => r.requires_shipping !== false && esDigital(r) && conFisico.has(String(ofertaDe(r)?.seller_id || "")))
    .map((r) => r.id)
}

/** Marca los renglones digitales del carrito como "no requiere envío". Devuelve cuántos cambió. */
export async function marcarDigitalesSinEnvio(container: Pick<MedusaContainer, "resolve">, cartId: string): Promise<number> {
  const digitales = await perfilesDigitales(container)
  if (!digitales.size) return 0
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.requires_shipping", "items.offer.shipping_profile_id", "items.offer.seller_id"],
    filters: { id: cartId },
  })
  const ids = renglonesPorMarcar(((data[0] as any)?.items || []) as Renglon[], digitales)
  if (!ids.length) return 0
  const carritos = container.resolve(Modules.CART)
  for (const id of ids) await carritos.updateLineItems(id, { requires_shipping: false })
  return ids.length
}
