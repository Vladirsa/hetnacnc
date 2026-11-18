// Importador de productos: de la plantilla leída a productos publicados en la tienda.
//
// Como lo pide Mercur (y como ya lo hacen publicar-diseno.ts y publicar-rapido.ts):
//   1. el producto va al catálogo maestro (createProductsWorkflow de Medusa, publicado
//      de una vez: product_request está apagado en medusa-config.ts),
//   2. la tienda de HETNA (seller con handle CAM_SELLER_HANDLE, "hetna-cnc") queda
//      autorizada para venderlo (liga product ↔ seller),
//   3. cada variante lleva una OFERTA de la tienda HETNA con su precio (MXN, y USD si
//      la plataforma lo acepta) y sus existencias en el almacén de la tienda. Sin
//      oferta, el producto sale en la tienda pero no se puede comprar.
//
// Idempotente por agrupador (handle) y SKU: si el producto ya existe se actualiza
// (nombre, descripción, categoría, estado, fotos, precio y existencias de cada SKU).
// Agregar o quitar medidas a un producto que ya existe NO se hace aquí (se reporta):
// el flujo de Medusa reemplazaría las variantes y podría borrar las que tienen ventas.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductsWorkflow, uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import { MercurModules, type CreateOfferDTO } from "@mercurjs/types"

import { camSellerHandle } from "../../modules/cam/catalog"
import { aprovisionarEnvios } from "../envios-automaticos"
import { descripcionAHtml } from "../publicar-rapido"
import { precioEnDolares } from "../publicar-diseno"
import { normalizar, type Lectura, type Problema, type ProductoImport } from "./plantilla"

// ── Planeación (pura: se prueba sin base) ────────────────────────────────

export type Categoria = { id: string; name: string; handle: string; parent_category_id: string | null; is_active?: boolean; is_internal?: boolean }
export type Existente = { id: string; handle: string; metadata?: Record<string, unknown> | null; variants: { id: string; sku: string | null }[] }
export type Paso = {
  producto: ProductoImport
  accion: "crear" | "actualizar"
  categoria_id: string
  categoria_nombre: string
  existente?: Existente
}
export type Plan = { pasos: Paso[]; errores: Problema[]; avisos: Problema[] }

/** Busca la categoría por nombre o handle (sin acentos ni mayúsculas); "Padre > Hija" desempata. */
export function resolverCategoria(texto: string, cats: Categoria[]): { cat?: Categoria; error?: string } {
  const activas = cats.filter((c) => c.is_active !== false && c.is_internal !== true)
  const partes = texto.split(">").map((x) => normalizar(x)).filter(Boolean)
  const igual = (c: Categoria, n: string) => normalizar(c.name) === n || normalizar(c.handle) === n
  const hoja = partes[partes.length - 1] || ""
  let candidatas = activas.filter((c) => igual(c, hoja))
  if (partes.length > 1) {
    const padre = partes[partes.length - 2]
    candidatas = candidatas.filter((c) => {
      const p = activas.find((x) => x.id === c.parent_category_id)
      return p && igual(p, padre)
    })
  }
  if (candidatas.length === 1) return { cat: candidatas[0] }
  if (!candidatas.length) return { error: `No existe la categoría "${texto}" en la tienda. Revisa la lista en la hoja Instrucciones.` }
  const rutas = candidatas.map((c) => `${activas.find((x) => x.id === c.parent_category_id)?.name || "(raíz)"} > ${c.name}`).join(", ")
  return { error: `Hay varias categorías "${texto}": ${rutas}. Escribe "Padre > Hija".` }
}

/**
 * Decide qué se crea y qué se actualiza, y qué no se puede.
 * existentes: productos de la base con esos handles; skuEnProducto: SKU → handle del producto donde ya está.
 */
export function planear(lectura: Lectura, cats: Categoria[], existentes: Map<string, Existente>, skuEnProducto: Map<string, string>): Plan {
  const errores: Problema[] = [...lectura.errores]
  const avisos: Problema[] = [...lectura.avisos]
  const pasos: Paso[] = []
  for (const original of lectura.productos) {
    let p = original
    const f0 = p.filas[0]
    let ok = true
    const r = resolverCategoria(p.categoria, cats)
    if (!r.cat) { errores.push({ fila: f0, columna: "Categoría *", mensaje: r.error! }); ok = false }
    // Sin agrupador, el handle sale del nombre: si cambiaron el nombre, se reconoce el
    // producto por sus SKU (todos en el mismo producto de la tienda) y se actualiza.
    if (!p.agrupador_explicito && !existentes.has(p.handle)) {
      const dueños = new Set(p.variantes.map((v) => skuEnProducto.get(v.sku)))
      const [unico] = [...dueños]
      if (dueños.size === 1 && unico && existentes.has(unico)) p = { ...p, handle: unico }
    }
    const ex = existentes.get(p.handle)
    for (const v of p.variantes) {
      const otro = skuEnProducto.get(v.sku)
      if (otro && otro !== p.handle) {
        errores.push({ fila: v.fila, columna: "SKU *", mensaje: `El SKU ${v.sku} ya es de otro producto de la tienda ("${otro}").` })
        ok = false
      }
    }
    if (ex) {
      const enBase = new Set(ex.variants.map((v) => (v.sku || "").toUpperCase()))
      const nuevas = p.variantes.filter((v) => !enBase.has(v.sku))
      if (nuevas.length) {
        errores.push({
          fila: nuevas[0].fila,
          columna: "SKU *",
          mensaje: `"${p.nombre}" ya existe en la tienda y no tiene ${nuevas.map((v) => v.sku).join(", ")}. Para agregar medidas a un producto existente usa el panel, o un Agrupador nuevo.`,
        })
        ok = false
      }
      const faltan = ex.variants.filter((v) => v.sku && !p.variantes.some((x) => x.sku === v.sku!.toUpperCase()))
      if (faltan.length) avisos.push({ fila: f0, mensaje: `"${p.nombre}" tiene en la tienda ${faltan.map((v) => v.sku).join(", ")} que no vienen en el archivo: se dejan como están.` })
    }
    if (ok && r.cat) pasos.push({ producto: p, accion: ex ? "actualizar" : "crear", categoria_id: r.cat.id, categoria_nombre: r.cat.name, existente: ex })
  }
  return { pasos, errores, avisos }
}

/** Medidas de envío del producto: las de la variante más grande (la paquetería cotiza con el paquete). */
export function medidasProducto(p: ProductoImport) {
  const mayor = [...p.variantes].sort((a, b) => b.peso_kg - a.peso_kg)[0]
  return { weight: mayor.peso_kg, length: mayor.largo_cm, width: mayor.ancho_cm, height: mayor.alto_cm }
}

/**
 * Metadata del producto. Al actualizar se parte de la que ya tiene: una celda
 * vacía no borra lo que había (marca, SEO, código de barras…) ni las llaves que
 * pusieron otros flujos.
 */
export function metadataProducto(p: ProductoImport, previa: Record<string, unknown> = {}) {
  return {
    ...previa,
    importado: true,
    ...(p.marca ? { marca: p.marca } : {}),
    ...(p.condicion ? { condicion: p.condicion } : {}),
    ...(p.gtin ? { gtin: p.gtin } : {}),
    ...(p.mpn ? { mpn: p.mpn } : {}),
    ...(p.seo_titulo ? { seo_title: p.seo_titulo } : {}),
    ...(p.seo_descripcion ? { meta_description: p.seo_descripcion } : {}),
  }
}

/** Entrada de createProductsWorkflow para un producto nuevo (sin precios: viven en la oferta). */
export function entradaCrear(p: ProductoImport, ctx: { categoria_id: string; perfil_id: string; canales: string[]; tag_ids: string[]; imagenes: string[] }) {
  const medidas = medidasProducto(p)
  const valores = p.variantes.map((v) => v.valor || "Única")
  return {
    title: p.nombre,
    description: descripcionAHtml(p.descripcion || ""),
    handle: p.handle,
    status: p.estado ?? "published",
    discountable: true,
    thumbnail: ctx.imagenes[0],
    images: ctx.imagenes.map((url) => ({ url })),
    shipping_profile_id: ctx.perfil_id,
    category_ids: [ctx.categoria_id],
    sales_channels: ctx.canales.map((id) => ({ id })),
    tag_ids: ctx.tag_ids,
    ...medidas,
    metadata: metadataProducto(p),
    options: [{ title: p.opcion, values: valores }],
    variants: p.variantes.map((v, i) => ({
      title: valores[i],
      sku: v.sku,
      manage_inventory: false, // las existencias viven en la oferta (Mercur)
      options: { [p.opcion]: valores[i] },
      prices: [],
      weight: v.peso_kg, length: v.largo_cm, width: v.ancho_cm, height: v.alto_cm,
    })),
  }
}

export function preciosOferta(precio: number, aceptaUsd: boolean) {
  const precios = [{ currency_code: "mxn", amount: precio }]
  if (aceptaUsd) precios.push({ currency_code: "usd", amount: precioEnDolares(precio) })
  return precios
}

// ── Contra Medusa ─────────────────────────────────────────────────────────

export class ErrorImportar extends Error {}

type Tienda = { sellerId: string; memberId: string; locationId: string; perfilId: string; canales: string[]; aceptaUsd: boolean }

/** La tienda HETNA (seller con handle CAM_SELLER_HANDLE), su almacén, el perfil de envío físico y los canales. */
export async function tiendaHetna(container: MedusaContainer): Promise<Tienda> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const handle = camSellerHandle()
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "email", "members.id", "stock_locations.id"],
    filters: { handle } as Record<string, unknown>,
  })
  const s = sellers[0] as { id: string; email?: string | null; members?: { id: string }[]; stock_locations?: { id: string }[] } | undefined
  if (!s) throw new ErrorImportar(`No existe la tienda "${handle}". Créala con src/scripts/crear-tienda-hetna.ts o pon CAM_SELLER_HANDLE en el .env.`)
  const locationId = s.stock_locations?.[0]?.id
  if (!locationId) throw new ErrorImportar(`La tienda "${handle}" no tiene almacén. Corre una vez src/scripts/seed-cam-services.ts, que se lo crea.`)
  let memberId = s.members?.[0]?.id
  if (!memberId && s.email) {
    const { data: m } = await query.graph({ entity: "member", fields: ["id"], filters: { email: s.email } as Record<string, unknown> })
    memberId = (m[0] as { id?: string } | undefined)?.id
  }
  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = ((perfiles as { id: string; name: string }[]).find((x) => x.name === "Marketplace Shipping") ||
    (perfiles as { id: string; name: string }[]).find((x) => x.name !== "Producto digital"))
  if (!perfil) throw new ErrorImportar("No hay perfil de envío para productos físicos.")
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const { data: stores } = await query.graph({ entity: "store", fields: ["supported_currencies.currency_code"] })
  const monedas = ((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).map((c) => c?.currency_code)
  return { sellerId: s.id, memberId: memberId || "importador", locationId, perfilId: perfil.id, canales: (canales as { id: string }[]).map((c) => c.id), aceptaUsd: monedas.includes("usd") }
}

export async function categoriasTienda(container: MedusaContainer): Promise<Categoria[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "name", "handle", "parent_category_id", "is_active", "is_internal"] })
  return data as Categoria[]
}

/** Revisión completa sin cambiar nada: plantilla + categorías + qué ya existe. */
export async function revisar(container: MedusaContainer, lectura: Lectura): Promise<Plan> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cats = await categoriasTienda(container)
  const handles = lectura.productos.map((p) => p.handle)
  const skus = lectura.productos.flatMap((p) => p.variantes.map((v) => v.sku))
  const existentes = new Map<string, Existente>()
  if (handles.length) {
    const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata", "variants.id", "variants.sku"], filters: { handle: handles } })
    for (const p of data as Existente[]) existentes.set(p.handle, { id: p.id, handle: p.handle, metadata: p.metadata, variants: p.variants || [] })
  }
  const skuEnProducto = new Map<string, string>()
  if (skus.length) {
    const { data } = await query.graph({ entity: "product_variant", fields: ["sku", "product.handle"], filters: { sku: skus } })
    for (const v of data as { sku: string; product?: { handle: string } }[]) if (v.sku && v.product?.handle) skuEnProducto.set(v.sku.toUpperCase(), v.product.handle)
  }
  // Productos dueños de esos SKU (para reconocer un producto al que le cambiaron el nombre)
  const faltan = [...new Set(skuEnProducto.values())].filter((h) => !existentes.has(h))
  if (faltan.length) {
    const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata", "variants.id", "variants.sku"], filters: { handle: faltan } })
    for (const p of data as Existente[]) existentes.set(p.handle, { id: p.id, handle: p.handle, metadata: p.metadata, variants: p.variants || [] })
  }
  return planear(lectura, cats, existentes, skuEnProducto)
}

/** Copia las fotos a la tienda (almacenamiento de archivos de Medusa). Si una no baja, se usa su liga tal cual. */
async function subirImagenes(container: MedusaContainer, urls: string[], cache: Map<string, string>, avisos: Problema[], fila: number) {
  const out: string[] = []
  for (const url of urls) {
    if (cache.has(url)) { out.push(cache.get(url)!); continue }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      const tipo = (r.headers.get("content-type") || "").split(";")[0].trim()
      if (!r.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(tipo)) throw new Error(r.ok ? `no es imagen (${tipo || "sin tipo"})` : `respondió ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > 8 * 1024 * 1024) throw new Error("pesa más de 8 MB")
      const ext = tipo.split("/")[1].replace("jpeg", "jpg")
      const { result } = await uploadFilesWorkflow(container).run({
        input: { files: [{ filename: `producto-${Date.now().toString(36)}.${ext}`, mimeType: tipo, content: buf.toString("base64"), access: "public" }] },
      })
      const subida = (result as { url: string }[])[0]?.url || url
      cache.set(url, subida)
      out.push(subida)
    } catch (e) {
      avisos.push({ fila, columna: "Imágenes (ligas)", mensaje: `No se pudo copiar ${url.slice(0, 80)} (${(e as Error).message}); se usa la liga original.` })
      cache.set(url, url)
      out.push(url)
    }
  }
  return out
}

async function etiquetas(container: MedusaContainer, valores: string[]) {
  if (!valores.length) return []
  const svc = container.resolve(Modules.PRODUCT)
  const ya = await svc.listProductTags({ value: valores }, { take: valores.length })
  const faltan = valores.filter((v) => !ya.some((t) => t.value === v))
  const nuevas = faltan.length ? await svc.createProductTags(faltan.map((value) => ({ value }))) : []
  return [...ya, ...nuevas].map((t) => t.id)
}

/** Existencias de una oferta en el almacén de la tienda (crea el nivel si falta). */
async function ponerExistencias(container: MedusaContainer, offerId: string, locationId: string, cantidad: number) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inv = container.resolve(Modules.INVENTORY)
  const { data } = await query.graph({ entity: "offer", fields: ["id", "inventory_item_link.inventory_item.id"], filters: { id: offerId } })
  const itemId = (data[0] as any)?.inventory_item_link?.[0]?.inventory_item?.id as string | undefined
  if (!itemId) throw new Error("la oferta no tiene inventario ligado")
  const niveles = await inv.listInventoryLevels({ inventory_item_id: itemId, location_id: locationId })
  if (niveles.length) await inv.updateInventoryLevels([{ inventory_item_id: itemId, location_id: locationId, stocked_quantity: cantidad }])
  else await inv.createInventoryLevels([{ inventory_item_id: itemId, location_id: locationId, stocked_quantity: cantidad }])
}

export type ResultadoProducto = { handle: string; nombre: string; accion: "creado" | "actualizado" | "error"; product_id?: string; ofertas: number; mensaje?: string }

/** Ejecuta el plan. Cada producto va por separado: si uno falla, los demás siguen. */
export async function importar(container: MedusaContainer, plan: Plan): Promise<{ resultados: ResultadoProducto[]; avisos: Problema[] }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const t = await tiendaHetna(container)
  const avisos: Problema[] = []
  const cacheImg = new Map<string, string>()
  const resultados: ResultadoProducto[] = []

  for (const paso of plan.pasos) {
    const p = paso.producto
    try {
      const imagenes = await subirImagenes(container, p.imagenes, cacheImg, avisos, p.filas[0])
      const tagIds = await etiquetas(container, p.etiquetas)
      let productId: string
      let variantes: { id: string; sku: string | null }[]
      if (paso.accion === "crear") {
        const { result } = await createProductsWorkflow(container).run({
          input: { products: [entradaCrear(p, { categoria_id: paso.categoria_id, perfil_id: t.perfilId, canales: t.canales, tag_ids: tagIds, imagenes }) as any] },
        })
        productId = result[0].id
        variantes = (result[0].variants || []).map((v) => ({ id: v.id, sku: v.sku ?? null }))
        await container.resolve(ContainerRegistrationKeys.LINK).create([
          { [Modules.PRODUCT]: { product_id: productId }, [MercurModules.SELLER]: { seller_id: t.sellerId } },
        ])
      } else {
        productId = paso.existente!.id
        variantes = paso.existente!.variants
        await updateProductsWorkflow(container).run({
          input: {
            selector: { id: productId },
            update: {
              title: p.nombre,
              // Celdas vacías no borran lo que ya tenía el producto
              ...(p.descripcion ? { description: descripcionAHtml(p.descripcion) } : {}),
              ...(p.estado ? { status: p.estado } : {}),
              category_ids: [paso.categoria_id],
              ...(imagenes.length ? { thumbnail: imagenes[0], images: imagenes.map((url) => ({ url })) } : {}),
              ...(tagIds.length ? { tag_ids: tagIds } : {}),
              ...medidasProducto(p),
              metadata: metadataProducto(p, paso.existente!.metadata || {}),
            } as any,
          },
        })
      }

      // Ofertas de la tienda HETNA: crear las que falten, actualizar precio y existencias
      const ids = variantes.map((v) => v.id)
      const { data: ofertas } = await query.graph({ entity: "offer", fields: ["id", "seller_id", "variant_id"], filters: { variant_id: ids } })
      const propias = new Map((ofertas as { id: string; seller_id: string; variant_id: string }[]).filter((o) => o.seller_id === t.sellerId).map((o) => [o.variant_id, o.id]))
      let nOfertas = 0
      for (const v of p.variantes) {
        const variante = variantes.find((x) => (x.sku || "").toUpperCase() === v.sku)
        if (!variante) continue
        const precios = preciosOferta(v.precio, t.aceptaUsd)
        const offerId = propias.get(variante.id)
        if (offerId) {
          await updateOffersWorkflow(container).run({ input: { offers: [{ id: offerId, prices: precios } as any] } })
          await ponerExistencias(container, offerId, t.locationId, v.existencias)
        } else {
          await createOffersWorkflow(container).run({
            input: {
              offers: [{
                seller_id: t.sellerId, created_by: t.memberId, sku: v.sku, variant_id: variante.id, shipping_profile_id: t.perfilId,
                manage_inventory: true, allow_backorder: false,
                inventory_items: [{ sku: v.sku, stock_levels: [{ location_id: t.locationId, stocked_quantity: v.existencias }] }],
                prices: precios,
              } as CreateOfferDTO],
            },
          })
        }
        nOfertas++
      }
      resultados.push({ handle: p.handle, nombre: p.nombre, accion: paso.accion === "crear" ? "creado" : "actualizado", product_id: productId, ofertas: nOfertas })
    } catch (e) {
      logger.warn(`[importar-productos] ${p.handle}: ${(e as Error).message}`)
      resultados.push({ handle: p.handle, nombre: p.nombre, accion: "error", ofertas: 0, mensaje: (e as Error).message })
    }
  }

  if (resultados.some((r) => r.accion !== "error")) {
    await aprovisionarEnvios(container, { sellerId: t.sellerId, log: (m: string) => logger.info(`[envios-auto] ${m}`) })
      .catch((e: Error) => logger.warn(`[importar-productos] envíos: ${e.message}`))
  }
  return { resultados, avisos }
}
