// Publica (o actualiza) los Diseños listos en la tienda HETNA: producto con
// Color × Calidad, imagen, medidas y metadata para la ficha, y la oferta de
// HETNA en su combinación con el precio por gramaje. Idempotente por handle y
// SKU: se puede correr cada vez que cambien los diseños, los precios del dueño
// (Ajustes de precios) o las imágenes. Las ofertas de otros talleres no se tocan.
import { createHash } from "crypto"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, deleteProductsWorkflow, updateProductsWorkflow, uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { MercurModules } from "@mercurjs/types"

import {
  CALIDADES, COLORES, EXISTENCIAS_BAJO_PEDIDO, HETNA_OFRECE, descripcionDiseno, empaque, leerDatos, metadataDiseno, precioDiseno, rutaImagenes, skuDiseno, type DatoDiseno,
} from "./disenos-listos"
import { tiendaHetna } from "./importar-productos/importar"
import { guardarOferta } from "./ofertas-tienda"
import { leerConfigPrecios } from "./precios-config"
import { descripcionAHtml } from "./publicar-rapido"

export type ResultadoDiseno = { handle: string; accion: "creado" | "actualizado" | "error"; precio?: number; gramos?: number; mensaje?: string }

/** Categoría de las piezas impresas: la primera que exista de estas. */
async function categoriaImpresion(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "handle"], filters: { handle: ["impresion-3d", "piezas-impresas-3d", "impresion-3d-piezas"] } as Record<string, unknown> })
  return (data as { id: string }[])[0]?.id
}

/** Sube la imagen del diseño sólo si cambió (huella en la metadata). */
async function imagen(container: MedusaContainer, d: DatoDiseno, anterior?: { url?: string | null; huella?: unknown }) {
  const ruta = join(rutaImagenes(), `${d.handle}.png`)
  if (!existsSync(ruta)) {
    container.resolve(ContainerRegistrationKeys.LOGGER).warn(`[disenos-listos] ${d.handle}: no está la imagen ${ruta} (corre el script de la tienda o pon DISENOS_LISTOS_IMAGENES)`)
    return null
  }
  const buf = readFileSync(ruta)
  const huella = createHash("sha1").update(buf).digest("hex").slice(0, 16)
  if (anterior?.url && anterior.huella === huella) return { url: anterior.url, huella }
  const { result } = await uploadFilesWorkflow(container).run({
    input: { files: [{ filename: `${d.handle}-${huella}.png`, mimeType: "image/png", content: buf.toString("base64"), access: "public" }] },
  })
  return { url: (result as { url: string }[])[0]?.url, huella }
}

export async function publicarDisenosListos(container: MedusaContainer, opc: { handles?: string[]; datos?: DatoDiseno[] } = {}): Promise<ResultadoDiseno[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const t = await tiendaHetna(container)
  const { cfg } = await leerConfigPrecios(knex)
  const categoria = await categoriaImpresion(container)
  const datos = (opc.datos ?? leerDatos()).filter((d) => !opc.handles?.length || opc.handles.includes(d.handle))
  const resultados: ResultadoDiseno[] = []

  for (const d of datos) {
    try {
      const precio = precioDiseno(d, HETNA_OFRECE.calidad, cfg)
      if (!precio) throw new Error("el motor de precios no pudo calcularla")
      const caja = empaque(d, precio.gramos)
      const { data: ya } = await query.graph({ entity: "product", fields: ["id", "thumbnail", "metadata", "sellers.id", "variants.id", "variants.sku"], filters: { handle: d.handle } })
      const existente = ya[0] as { id: string; thumbnail?: string | null; metadata?: Record<string, unknown> | null; sellers?: { id: string }[]; variants: { id: string; sku: string | null }[] } | undefined
      // un producto con ese handle que no es de la tienda HETNA no se toca
      if (existente && !(existente.sellers || []).some((s) => s.id === t.sellerId)) throw new Error("ya existe un producto con ese handle que no es de la tienda HETNA")
      const img = await imagen(container, d, { url: existente?.thumbnail, huella: existente?.metadata?.imagen_huella })
      const metadata = { ...metadataDiseno(d, precio.gramos, precio.precio), ...(img ? { imagen_huella: img.huella } : {}) }
      const comun = {
        title: d.nombre,
        description: descripcionAHtml(descripcionDiseno(d, precio.gramos)),
        ...(img?.url ? { thumbnail: img.url, images: [{ url: img.url }] } : {}),
        ...(categoria ? { category_ids: [categoria] } : {}),
        ...caja,
        metadata,
      }
      let productId: string
      let variantes: { id: string; sku: string | null }[]
      if (!existente) {
        const { result } = await createProductsWorkflow(container).run({
          input: {
            products: [{
              ...comun,
              handle: d.handle,
              status: "published",
              discountable: true,
              shipping_profile_id: t.perfilId,
              sales_channels: t.canales.map((id) => ({ id })),
              options: [{ title: "Color", values: [...COLORES] }, { title: "Calidad", values: [...CALIDADES] }],
              variants: COLORES.flatMap((color) =>
                CALIDADES.map((calidad) => ({
                  title: `${color} · ${calidad}`,
                  sku: skuDiseno(d.handle, color, calidad),
                  manage_inventory: false, // las existencias viven en cada oferta (Mercur)
                  options: { Color: color, Calidad: calidad },
                  prices: [],
                  ...caja,
                }))
              ),
            } as any],
          },
        })
        productId = result[0].id
        variantes = (result[0].variants || []).map((v) => ({ id: v.id, sku: v.sku ?? null }))
        try {
          await container.resolve(ContainerRegistrationKeys.LINK).create([
            { [Modules.PRODUCT]: { product_id: productId }, [MercurModules.SELLER]: { seller_id: t.sellerId } },
          ])
        } catch (e) {
          // sin la liga quedaría un producto sin dueño: se quita y se reporta
          await deleteProductsWorkflow(container).run({ input: { ids: [productId] } }).catch(() => undefined)
          throw e
        }
      } else {
        productId = existente.id
        variantes = existente.variants
        await updateProductsWorkflow(container).run({ input: { selector: { id: productId }, update: comun as any } })
      }

      // La oferta de HETNA en su combinación (precio y existencias al día)
      const sku = skuDiseno(d.handle, HETNA_OFRECE.color, HETNA_OFRECE.calidad)
      const variante = variantes.find((v) => (v.sku || "").toUpperCase() === sku)
      if (!variante) throw new Error(`no tiene la variante ${sku}`)
      const { data: ofertas } = await query.graph({ entity: "offer", fields: ["id", "seller_id"], filters: { variant_id: variante.id } })
      const propia = (ofertas as { id: string; seller_id: string }[]).find((o) => o.seller_id === t.sellerId)
      await guardarOferta(container, t, {
        offerId: propia?.id,
        variantId: variante.id,
        sku,
        precio: precio.precio,
        existencias: EXISTENCIAS_BAJO_PEDIDO,
        metadata: { dias: d.dias, color: HETNA_OFRECE.color, calidad: HETNA_OFRECE.calidad, activa: true },
      })
      resultados.push({ handle: d.handle, accion: existente ? "actualizado" : "creado", precio: precio.precio, gramos: precio.gramos })
    } catch (e) {
      logger.warn(`[disenos-listos] ${d.handle}: ${(e as Error).message}`)
      resultados.push({ handle: d.handle, accion: "error", mensaje: (e as Error).message })
    }
  }
  return resultados
}
