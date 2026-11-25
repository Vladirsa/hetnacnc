// Ofertas de los talleres en los productos de planos (lib/planos-catalogo.ts).
// Cada taller elige qué acabados hace, pone su precio (ve el recomendado por
// HETNA), sus días de entrega y si da envío gratis. Es una oferta normal de
// Mercur sobre el producto maestro: el cliente ve todas juntas y la venta,
// la comisión y el pago van al taller que eligió.
//
// Se fabrica sobre pedido: la oferta no maneja existencias.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOffersWorkflow, deleteOffersWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { CreateOfferDTO } from "@mercurjs/types"

import { aprovisionarEnvios } from "./envios-automaticos"
import { precioEnDolares } from "./publicar-diseno"
import { almacenDelTaller } from "./publicar-rapido"

export class ErrorOferta extends Error {}

export const DIAS = { min: 1, max: 60 }
export const PRECIO = { min: 50, max: 500_000 }

export type VariantePlanoTaller = {
  variant_id: string
  titulo: string
  recomendado: number | null
  oferta: { id: string; precio: number | null } | null
}
export type PlanoTaller = {
  product_id: string
  handle: string
  titulo: string
  thumbnail: string | null
  slug: string
  publicado: boolean
  dias: number | null
  envio_gratis: boolean
  variantes: VariantePlanoTaller[]
}

type Oferta = { id: string; variant_id: string; sku?: string; leadtime_to_ship?: number | null; metadata?: Record<string, unknown> | null; prices?: { id: string; amount: number; currency_code: string; min_quantity?: number | null }[] }

async function productosPlanos(container: MedusaContainer, productId?: string) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const q = knex("product").whereNull("deleted_at").whereRaw("metadata->>'origen' = 'plano'").orderBy("title")
  if (productId) q.where({ id: productId })
  const ids: string[] = await q.pluck("id")
  if (!ids.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "thumbnail", "status", "metadata", "variants.id", "variants.title", "variants.sku", "variants.metadata"],
    filters: { id: ids },
  })
  return data as unknown as { id: string; handle: string; title: string; thumbnail: string | null; status: string; metadata: Record<string, any> | null; variants: { id: string; title: string; sku: string | null; metadata: Record<string, any> | null }[] }[]
}

async function ofertasDelTaller(container: MedusaContainer, sellerId: string, variantIds: string[]): Promise<Oferta[]> {
  if (!variantIds.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "offer",
    fields: ["id", "variant_id", "sku", "leadtime_to_ship", "metadata", "prices.id", "prices.amount", "prices.currency_code", "prices.min_quantity"],
    filters: { seller_id: sellerId, variant_id: variantIds } as any,
  })
  return data as unknown as Oferta[]
}

const precioMxn = (o?: Oferta) => {
  const p = (o?.prices || []).find((x) => x.currency_code === "mxn" && !x.min_quantity)
  return p ? Number(p.amount) : null
}

/** Los planos con las ofertas que ya tiene este taller. */
export async function planosParaTaller(container: MedusaContainer, sellerId: string): Promise<PlanoTaller[]> {
  const productos = await productosPlanos(container)
  const ofertas = await ofertasDelTaller(container, sellerId, productos.flatMap((p) => p.variants.map((v) => v.id)))
  const porVariante = new Map(ofertas.map((o) => [o.variant_id, o]))
  return productos.map((p) => {
    const mias = p.variants.map((v) => porVariante.get(v.id)).filter(Boolean) as Oferta[]
    return {
      product_id: p.id,
      handle: p.handle,
      titulo: p.title,
      thumbnail: p.thumbnail,
      slug: String(p.metadata?.plano_slug || ""),
      publicado: p.status === "published",
      dias: mias[0]?.leadtime_to_ship ?? null,
      envio_gratis: mias.some((o) => o.metadata?.envio_gratis === true),
      variantes: p.variants.map((v) => {
        const o = porVariante.get(v.id)
        const r = Number(v.metadata?.precio_recomendado)
        return { variant_id: v.id, titulo: v.title, recomendado: Number.isFinite(r) && r > 0 ? r : null, oferta: o ? { id: o.id, precio: precioMxn(o) } : null }
      }),
    }
  })
}

export type DatosOfertaPlano = { product_id: string; dias: number; envio_gratis: boolean; variantes: { variant_id: string; precio: number | null }[] }

export function validarOfertaPlano(b: Record<string, unknown>): DatosOfertaPlano {
  const product_id = String(b.product_id || "").trim()
  if (!product_id) throw new ErrorOferta("Falta el plano.")
  const dias = Math.round(Number(b.dias))
  if (!Number.isFinite(dias) || dias < DIAS.min || dias > DIAS.max) throw new ErrorOferta(`Los días de entrega van de ${DIAS.min} a ${DIAS.max}.`)
  if (!Array.isArray(b.variantes) || !b.variantes.length) throw new ErrorOferta("Elige al menos un acabado.")
  const variantes = (b.variantes as Record<string, unknown>[]).map((v) => {
    const variant_id = String(v?.variant_id || "")
    if (!variant_id) throw new ErrorOferta("Acabado no válido.")
    if (v.precio === null || v.precio === "" || v.precio === undefined) return { variant_id, precio: null }
    const precio = Math.round(Number(v.precio))
    if (!Number.isFinite(precio) || precio < PRECIO.min || precio > PRECIO.max) throw new ErrorOferta(`El precio va de $${PRECIO.min} a $${PRECIO.max.toLocaleString("es-MX")}.`)
    return { variant_id, precio }
  })
  return { product_id, dias, envio_gratis: b.envio_gratis === true, variantes }
}

/**
 * Crea, cambia o quita las ofertas del taller en un plano. Un acabado con
 * precio vacío se quita.
 */
export async function guardarOfertaPlano(container: MedusaContainer, sellerId: string, memberId: string | undefined, d: DatosOfertaPlano) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [p] = await productosPlanos(container, d.product_id)
  if (!p) throw new ErrorOferta("Ese plano no existe.")
  const variantes = new Map(p.variants.map((v) => [v.id, v]))
  for (const v of d.variantes) if (!variantes.has(v.variant_id)) throw new ErrorOferta("Ese acabado no es de este plano.")

  const { data: sellers } = await query.graph({ entity: "seller", fields: ["id", "name", "handle", "address.*", "stock_locations.id"], filters: { id: sellerId } })
  const seller = sellers[0] as any
  if (!seller) throw new ErrorOferta("No encontramos tu tienda. Vuelve a iniciar sesión.")

  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = ((perfiles as { id: string; name: string }[]).find((x) => x.name === "Marketplace Shipping") ||
    (perfiles as { id: string; name: string }[]).find((x) => x.name !== "Producto digital")) as { id: string } | undefined
  if (!perfil?.id) throw new Error("No hay perfil de envío")
  const { data: stores } = await query.graph({ entity: "store", fields: ["supported_currencies.currency_code"] })
  const usd = ((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).some((c) => c?.currency_code === "usd")

  const actuales = new Map((await ofertasDelTaller(container, sellerId, [...variantes.keys()])).map((o) => [o.variant_id, o]))
  const metadata = (o?: Oferta) => ({ ...(o?.metadata || {}), oferta_plano: true, plano_slug: p.metadata?.plano_slug, envio_gratis: d.envio_gratis })
  const crear: CreateOfferDTO[] = []
  const cambiar: any[] = []
  const quitar: string[] = []
  let locationId: string | null = null

  for (const v of d.variantes) {
    const o = actuales.get(v.variant_id)
    if (v.precio === null) {
      if (o) quitar.push(o.id)
      continue
    }
    const precios: { id?: string; amount: number; currency_code: string }[] = [{ currency_code: "mxn", amount: v.precio }]
    if (usd) precios.push({ currency_code: "usd", amount: precioEnDolares(v.precio) })
    if (o) {
      for (const pr of precios) {
        const ya = (o.prices || []).find((x) => x.currency_code === pr.currency_code && !x.min_quantity)
        if (ya) pr.id = ya.id
      }
      cambiar.push({ id: o.id, leadtime_to_ship: d.dias, metadata: metadata(o), prices: precios })
    } else {
      locationId ||= await almacenDelTaller(container, seller)
      const sku = `${String(seller.handle || "taller").toUpperCase().slice(0, 16)}-${variantes.get(v.variant_id)!.sku || v.variant_id}`.slice(0, 80)
      crear.push({
        seller_id: sellerId,
        created_by: memberId || "planos-ofertas",
        sku,
        variant_id: v.variant_id,
        shipping_profile_id: perfil.id,
        // Se fabrica sobre pedido: no se agota
        manage_inventory: false,
        allow_backorder: true,
        inventory_items: [{ sku, stock_levels: [{ location_id: locationId, stocked_quantity: 1000000 }] }],
        leadtime_to_ship: d.dias,
        metadata: metadata(),
        prices: precios,
      } as CreateOfferDTO)
    }
  }

  if (crear.length) await createOffersWorkflow(container).run({ input: { offers: crear } })
  if (cambiar.length) await updateOffersWorkflow(container).run({ input: { offers: cambiar } })
  if (quitar.length) await deleteOffersWorkflow(container).run({ input: { ids: quitar } })
  if (crear.length) {
    await aprovisionarEnvios(container, { sellerId, log: (m: string) => logger.info(`[envios-auto] ${m}`) }).catch((e: Error) => logger.warn(`[planos-ofertas] envíos: ${e.message}`))
  }
  logger.info(`[planos-ofertas] ${seller.handle} en ${p.handle}: ${crear.length} nuevas, ${cambiar.length} cambiadas, ${quitar.length} quitadas`)
  return { creadas: crear.length, cambiadas: cambiar.length, quitadas: quitar.length }
}
