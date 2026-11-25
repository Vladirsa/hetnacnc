// Panel del taller > Piezas para imprimir (Diseños listos, lib/disenos-listos.ts).
//   GET  -> los diseños con su precio recomendado por calidad y las ofertas del taller
//   POST -> { product_id, ofertas: [{ variant_id, precio, dias }], quitar: [variant_id] }
//
// El taller ofrece imprimir cualquier combinación de color y calidad a su
// precio y con sus días; la ficha lo muestra como "Taller X te lo imprime en
// $Y". Es una oferta normal de Mercur sobre el producto del catálogo: no hace
// falta ligar el producto al taller (y así no puede editarlo). Quitar una
// oferta la deja sin existencias (no se borra: puede tener ventas).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOffersWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { CreateOfferDTO } from "@mercurjs/types"

import { CALIDADES, COLORES, EXISTENCIAS_BAJO_PEDIDO, datoDeProducto, precioDiseno, type Calidad } from "../../../lib/disenos-listos"
import { aprovisionarEnvios } from "../../../lib/envios-automaticos"
import { ponerExistencias, preciosOferta, tiendaTaller } from "../../../lib/importar-productos/importar"
import { planesDestacado } from "../../../lib/disenos-destacado"
import { leerConfigPrecios } from "../../../lib/precios-config"

type Variante = { id: string; title?: string | null; sku?: string | null; options?: { value?: string | null; option?: { title?: string | null } | null }[] | null }
type Producto = { id: string; handle: string; title: string; thumbnail?: string | null; metadata?: Record<string, unknown> | null; variants?: Variante[] }

/** Existencias de la oferta (suma de sus almacenes): 0 = la quitó. */
const existencias = (o: any) =>
  (o?.inventory_item_link || []).reduce((t: number, l: any) => t + (l?.inventory_item?.location_levels || []).reduce((u: number, n: any) => u + (Number(n?.stocked_quantity) || 0), 0), 0)

const opcion = (v: Variante, titulo: string) => v.options?.find((o) => o.option?.title === titulo)?.value || ""

async function cargar(req: AuthenticatedMedusaRequest, sellerId: string, productId?: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // Los diseños listos son productos de HETNA con metadata.diseno_listo (handle hetna-…)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "thumbnail", "metadata", "status", "variants.id", "variants.title", "variants.sku", "variants.options.value", "variants.options.option.title"],
    filters: (productId ? { id: productId } : { handle: { $like: "hetna-%" } }) as Record<string, unknown>,
  })
  const productos = (data as (Producto & { status?: string })[]).filter((p) => p.status === "published" && datoDeProducto(p))
  const variantes = productos.flatMap((p) => (p.variants || []).map((v) => v.id))
  const { data: ofertas } = variantes.length
    ? await query.graph({ entity: "offer", fields: ["id", "variant_id", "seller_id", "metadata", "prices.amount", "prices.currency_code", "inventory_item_link.inventory_item.location_levels.stocked_quantity"], filters: { seller_id: sellerId, variant_id: variantes } as Record<string, unknown> })
    : { data: [] }
  return { productos, ofertas: ofertas as any[] }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const { cfg } = await leerConfigPrecios(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
  const { productos, ofertas } = await cargar(req, sellerId)
  const porVariante = new Map(ofertas.map((o) => [o.variant_id, o]))
  const disenos = productos.map((p) => {
    const d = datoDeProducto(p)
    const recomendado = Object.fromEntries(CALIDADES.map((c) => [c, d ? precioDiseno(d, c, cfg)?.precio ?? null : null]))
    return {
      product_id: p.id,
      handle: p.handle,
      nombre: p.title,
      thumbnail: p.thumbnail || null,
      material: p.metadata?.material || null,
      medidas: p.metadata?.medidas || null,
      gramos: p.metadata?.gramos || null,
      recomendado,
      variantes: (p.variants || []).map((v) => {
        const o = porVariante.get(v.id)
        const precio = o?.prices?.find((x: any) => x.currency_code === "mxn")?.amount
        return {
          id: v.id,
          color: opcion(v, "Color"),
          calidad: opcion(v, "Calidad"),
          mi_oferta: o ? { id: o.id, precio: precio ?? null, dias: Number(o.metadata?.dias) || null, activa: existencias(o) > 0 } : null,
        }
      }),
    }
  })
  const s = await req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)("seller").where({ id: sellerId }).first("metadata")
  const hasta = s?.metadata?.destacado_disenos_hasta
  res.json({
    disenos,
    colores: COLORES,
    calidades: CALIDADES,
    destacado: { hasta: hasta && new Date(hasta).getTime() > Date.now() ? hasta : null, planes: planesDestacado() },
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  const memberId = (req as any).auth_context?.actor_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const b = (req.body || {}) as { product_id?: string; ofertas?: { variant_id?: string; precio?: number; dias?: number }[]; quitar?: string[] }
  if (!b.product_id) return res.status(400).json({ message: "Falta la pieza." })
  const { productos, ofertas } = await cargar(req, sellerId, b.product_id)
  const p = productos[0]
  if (!p) return res.status(404).json({ message: "Esa pieza no está en Piezas para imprimir." })
  const delProducto = new Set((p.variants || []).map((v) => v.id))
  const mias = new Map(ofertas.map((o) => [o.variant_id, o]))
  const pedidas = (b.ofertas || []).slice(0, 40)
  for (const o of pedidas) {
    if (!o.variant_id || !delProducto.has(o.variant_id)) return res.status(400).json({ message: "Esa combinación no es de esta pieza." })
    const precio = Math.round(Number(o.precio) * 100) / 100
    if (!(precio >= 10 && precio <= 100000)) return res.status(400).json({ message: "Pon un precio entre $10 y $100,000 (precio final, con IVA)." })
    const dias = Math.round(Number(o.dias))
    if (!(dias >= 1 && dias <= 30)) return res.status(400).json({ message: "Los días de impresión van de 1 a 30." })
  }
  const t = await tiendaTaller(req.scope, sellerId, memberId)
  let creadas = 0, actualizadas = 0, quitadas = 0
  for (const o of pedidas) {
    const v = (p.variants || []).find((x) => x.id === o.variant_id)!
    const precios = preciosOferta(Math.round(Number(o.precio) * 100) / 100, t.aceptaUsd)
    const metadata = { dias: Math.round(Number(o.dias)), color: opcion(v, "Color"), calidad: opcion(v, "Calidad") as Calidad, diseno_listo: true }
    const ya = mias.get(v.id)
    if (ya) {
      await updateOffersWorkflow(req.scope).run({ input: { offers: [{ id: ya.id, prices: precios, metadata } as any] } })
      await ponerExistencias(req.scope, ya.id, t.locationId, EXISTENCIAS_BAJO_PEDIDO)
      actualizadas++
    } else {
      // SKU propio del taller (Mercur lo pide único por tienda)
      const sku = `${(v.sku || v.id).toUpperCase()}-${t.handle.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10)}`
      await createOffersWorkflow(req.scope).run({
        input: {
          offers: [{
            seller_id: t.sellerId, created_by: t.memberId, sku, variant_id: v.id, shipping_profile_id: t.perfilId,
            manage_inventory: true, allow_backorder: false,
            inventory_items: [{ sku, stock_levels: [{ location_id: t.locationId, stocked_quantity: EXISTENCIAS_BAJO_PEDIDO }] }],
            prices: precios,
            metadata,
          } as CreateOfferDTO],
        },
      })
      creadas++
    }
  }
  for (const variantId of (b.quitar || []).slice(0, 40)) {
    const ya = mias.get(variantId)
    if (!ya || !delProducto.has(variantId)) continue
    await ponerExistencias(req.scope, ya.id, t.locationId, 0)
    quitadas++
  }
  if (creadas) {
    // que el taller tenga con qué enviar desde su almacén
    await aprovisionarEnvios(req.scope, { sellerId, log: () => undefined }).catch(() => undefined)
  }
  res.json({ ok: true, creadas, actualizadas, quitadas })
}
