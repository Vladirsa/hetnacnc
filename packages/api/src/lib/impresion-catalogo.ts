// Lecturas y altas de "Impresión 3D bajo pedido" que tocan la base de datos
// (la parte pura y el pago del destacado están en impresion-bajo-pedido.ts).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOffersWorkflow, deleteOffersWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { CreateOfferDTO } from "@mercurjs/types"
import { randomBytes } from "crypto"

import { aprovisionarEnvios } from "./envios-automaticos"
import { umbralesDeEnvioGratis } from "./envio-gratis"
import {
  COLECCION_IMPRESION,
  datosDeOferta,
  datosPieza,
  destacadoHasta,
  ErrorImpresion,
  gramosPieza,
  MATERIALES_IMPRESION,
  ordenarOfertas,
  precioRecomendado,
  type OfertaTaller,
} from "./impresion-bajo-pedido"
import { almacenDelTaller } from "./publicar-rapido"

const MONEDA = "mxn"
const EXISTENCIAS_BAJO_PEDIDO = 999 // se fabrica al pedirlo: no se acaba

type Variante = { id: string; title: string }
export type ProductoImpresion = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  metadata: Record<string, any> | null
  variants: Variante[]
}

export async function idColeccion(container: MedusaContainer): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_collection", fields: ["id"], filters: { handle: COLECCION_IMPRESION } })
  return (data as { id: string }[])[0]?.id ?? null
}

/** Los diseños publicados de la colección, con sus variantes (una por material). */
export async function productosImpresion(container: MedusaContainer, filtro: { id?: string } = {}): Promise<ProductoImpresion[]> {
  const coleccion = await idColeccion(container)
  if (!coleccion) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "metadata", "status", "variants.id", "variants.title"],
    filters: { collection_id: coleccion, status: "published", ...(filtro.id ? { id: filtro.id } : {}) } as any,
  })
  return (data as any[]).map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    thumbnail: p.thumbnail ?? null,
    metadata: p.metadata ?? null,
    variants: ((p.variants || []) as Variante[]).filter((v) => MATERIALES_IMPRESION.some((m) => m.valor === v.title)),
  }))
}

const CAMPOS_OFERTA = ["id", "seller_id", "variant_id", "product_id", "sku", "leadtime_to_ship", "metadata", "prices.id", "prices.amount", "prices.currency_code", "prices.min_quantity"]

/** El precio de una pieza (en pesos) de la oferta. */
export function precioDeOferta(oferta: any): number | null {
  const base = ((oferta?.prices || []) as any[]).find(
    (p) => String(p?.currency_code || "").toLowerCase() === MONEDA && (p.min_quantity == null || Number(p.min_quantity) <= 1)
  )
  const n = Number(base?.amount)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── Panel del taller ─────────────────────────────────────────────────────

/** Lo que ve el taller: cada diseño con su precio recomendado por material y su oferta si ya tiene. */
export async function panelTaller(container: MedusaContainer, sellerId: string) {
  const productos = await productosImpresion(container)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ids = productos.map((p) => p.id)
  const { data: ofertas } = ids.length
    ? await query.graph({ entity: "offer", fields: CAMPOS_OFERTA, filters: { seller_id: sellerId, product_id: ids } as any })
    : { data: [] as any[] }
  const porVariante = new Map((ofertas as any[]).map((o) => [o.variant_id, o]))
  return productos.map((p) => {
    const pieza = datosPieza(p)
    return {
      id: p.id,
      titulo: p.title,
      handle: p.handle,
      imagen: p.thumbnail,
      medidas_mm: pieza?.medidas_mm ?? null,
      materiales: p.variants.map((v) => {
        const o = porVariante.get(v.id)
        const d = o ? datosDeOferta(o) : null
        return {
          variant_id: v.id,
          material: v.title,
          recomendado: pieza ? precioRecomendado(pieza, v.title) : null,
          gramos: pieza ? gramosPieza(pieza.volumen_cm3, v.title, pieza.relleno) : null,
          oferta: o ? { id: o.id, precio: precioDeOferta(o), dias: d?.dias ?? null, colores: d?.colores ?? [] } : null,
        }
      }),
    }
  })
}

/** Crea, cambia o quita las ofertas del taller. Sólo en variantes de la colección. */
export async function guardarOfertasTaller(container: MedusaContainer, sellerId: string, memberId: string | undefined, cambios: OfertaTaller[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productos = await productosImpresion(container)
  const varianteA = new Map<string, { producto: ProductoImpresion; material: string }>()
  for (const p of productos) for (const v of p.variants) varianteA.set(v.id, { producto: p, material: v.title })
  for (const c of cambios) if (!varianteA.has(c.variant_id)) throw new ErrorImpresion("Ese diseño ya no está disponible para imprimir.")

  const { data: existentes } = await query.graph({
    entity: "offer",
    fields: ["id", "variant_id", "metadata"],
    filters: { seller_id: sellerId, variant_id: cambios.map((c) => c.variant_id) } as any,
  })
  const ofertaDe = new Map((existentes as any[]).map((o) => [o.variant_id, o]))

  const quitar = cambios.filter((c) => !c.activa && ofertaDe.has(c.variant_id)).map((c) => ofertaDe.get(c.variant_id).id)
  const cambiar = cambios.filter((c) => c.activa && ofertaDe.has(c.variant_id))
  const crear = cambios.filter((c) => c.activa && !ofertaDe.has(c.variant_id))

  if (quitar.length) {
    // Una oferta con un pedido pendiente no se borra: el envío y las comisiones de
    // ese pedido todavía la leen (mismo criterio que lib/ofertas-sueltas.ts).
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const pendientes = await knex("order_order_line_item_offer_offer as l")
      .join("order_item as oi", "oi.item_id", "l.order_line_item_id")
      .join("order as ord", "ord.id", "oi.order_id")
      .whereIn("l.offer_id", quitar)
      .whereNull("l.deleted_at")
      .whereNull("oi.deleted_at")
      .whereNull("ord.deleted_at")
      .whereNotIn("ord.status", ["completed", "canceled", "archived"])
      .distinct("l.offer_id")
    if ((pendientes as unknown[]).length) throw new ErrorImpresion("Tienes pedidos pendientes de ese material: entrégalos antes de dejar de ofrecerlo.")
    await deleteOffersWorkflow(container).run({ input: { ids: quitar } })
  }

  if (cambiar.length) {
    await updateOffersWorkflow(container).run({
      input: {
        offers: cambiar.map((c) => {
          const o = ofertaDe.get(c.variant_id)
          return {
            id: o.id,
            leadtime_to_ship: c.dias,
            metadata: { ...(o.metadata || {}), impresion_bajo_pedido: true, colores: c.colores },
            prices: [{ currency_code: MONEDA, amount: c.precio }],
          }
        }) as any,
      },
    })
  }

  if (crear.length) {
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "handle", "address.*", "stock_locations.id"],
      filters: { id: sellerId },
    })
    const seller = sellers[0] as any
    if (!seller) throw new ErrorImpresion("No encontramos tu tienda. Vuelve a iniciar sesión.")
    const locationId = await almacenDelTaller(container, seller)
    const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
    const perfil = ((perfiles as any[]).find((x) => x.name === "Marketplace Shipping") || (perfiles as any[]).find((x) => x.name !== "Producto digital")) as { id: string } | undefined
    if (!perfil?.id) throw new Error("No hay perfil de envío")
    const prefijo = String(seller.handle || seller.name || "taller").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "TALLER"

    await createOffersWorkflow(container).run({
      input: {
        offers: crear.map((c) => {
          const { producto, material } = varianteA.get(c.variant_id)!
          const sku = `${prefijo}-3D-${material.replace(/[^A-Za-z0-9]/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`
          return {
            seller_id: sellerId,
            created_by: memberId || "impresion-bajo-pedido",
            sku,
            variant_id: c.variant_id,
            shipping_profile_id: perfil.id,
            manage_inventory: true,
            allow_backorder: false,
            leadtime_to_ship: c.dias,
            metadata: { impresion_bajo_pedido: true, colores: c.colores, producto: producto.handle },
            inventory_items: [{ sku, stock_levels: [{ location_id: locationId, stocked_quantity: EXISTENCIAS_BAJO_PEDIDO }] }],
            prices: [{ currency_code: MONEDA, amount: c.precio }],
          } as CreateOfferDTO
        }),
      },
    })
    await aprovisionarEnvios(container, { sellerId, log: (m: string) => logger.info(`[envios-auto] ${m}`) }).catch((e) =>
      logger.warn(`[impresion] envíos de ${sellerId}: ${(e as Error).message}`)
    )
  }
  logger.info(`[impresion] ${sellerId}: ${crear.length} nuevas, ${cambiar.length} cambiadas, ${quitar.length} quitadas`)
  return { creadas: crear.length, cambiadas: cambiar.length, quitadas: quitar.length }
}

// ── Ficha pública ────────────────────────────────────────────────────────

/** Los talleres que imprimen un diseño, ordenados (destacados, precio, días). */
export async function ofertasPublicas(container: MedusaContainer, productId: string) {
  const [producto] = await productosImpresion(container, { id: productId })
  if (!producto) return null
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: [...CAMPOS_OFERTA, "seller.id", "seller.name", "seller.handle", "seller.status", "seller.metadata"],
    filters: { product_id: productId } as any,
  })
  const vivas = (ofertas as any[]).filter((o) => o.seller && (!o.seller.status || o.seller.status === "open"))
  const umbrales = await umbralesDeEnvioGratis(container, [...new Set(vivas.map((o) => o.seller_id as string))]).catch(() => ({}) as Record<string, { gratis_desde: number }>)
  const material = new Map(producto.variants.map((v) => [v.id, v.title]))
  const pieza = datosPieza(producto)

  const lista = vivas
    .filter((o) => material.has(o.variant_id))
    .map((o) => {
      const d = datosDeOferta(o)
      const precio = precioDeOferta(o)
      const gratisDesde = (umbrales as any)[o.seller_id]?.gratis_desde ?? null
      return {
        offer_id: o.id as string,
        variant_id: o.variant_id as string,
        material: material.get(o.variant_id)!,
        taller: { nombre: o.seller.name as string, handle: o.seller.handle as string },
        precio,
        dias: d.dias,
        colores: d.colores,
        destacado: !!destacadoHasta(o.seller),
        envio_gratis: gratisDesde != null && precio != null && precio >= gratisDesde,
        envio_gratis_desde: gratisDesde,
      }
    })
    .filter((o) => o.precio != null)

  return {
    producto: { id: producto.id, handle: producto.handle, titulo: producto.title },
    materiales: producto.variants.map((v) => ({
      variant_id: v.id,
      material: v.title,
      gramos: pieza ? gramosPieza(pieza.volumen_cm3, v.title, pieza.relleno) : null,
      recomendado: pieza ? precioRecomendado(pieza, v.title) : null,
    })),
    ofertas: ordenarOfertas(lista),
  }
}
