// Libros, manuales y guías en PDF que publican los talleres en la Academia.
//
// Es un producto digital como los diseños de HETNA Digital Factory
// (publicar-diseno.ts): el PDF vive en el bucket PRIVADO de Backblaze y lo que
// guarda el producto es su llave (metadata.archivo_storage_key). La entrega ya
// existe y no se toca:
//   - de pago: al pagarse el pedido, digital-delivery.ts manda el enlace y el
//     libro queda en Mis descargas;
//   - gratis (metadata.archivo_gratis): se baja con cuenta desde la ficha, con
//     el cupo semanal de descargas-gratis.ts.
//
// Van en la categoría "Libros y PDF" (se crea sola), con la etiqueta
// "digital" (perfil sin envío) y "libro". La comisión es la de la categoría.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow } from "@mercurjs/core/workflows"
import { MercurModules, type CreateOfferDTO } from "@mercurjs/types"
import { randomBytes } from "crypto"

import { aprovisionarEnvios, obtenerPerfilDigital } from "./envios-automaticos"
import { precioEnDolares } from "./publicar-diseno"
import { almacenDelTaller, descripcionAHtml, ErrorPublicar } from "./publicar-rapido"

export const CATEGORIA_LIBROS = "Libros y PDF"
export const MAX_MB_LIBRO = 50

export type DatosLibro = {
  titulo: string
  autor?: string
  descripcion?: string
  paginas?: number | null
  precio: number // 0 = gratis
  portada_url: string
  archivo_storage_key: string
}

/** Llave del PDF en el bucket: siempre bajo la carpeta del taller. */
export const llaveLibro = (sellerId: string) => `libros/${sellerId}/${randomBytes(8).toString("hex")}.pdf`

export function validarLibro(cuerpo: Record<string, unknown>, sellerId: string): DatosLibro {
  const titulo = String(cuerpo.titulo || "").trim()
  if (titulo.length < 4) throw new ErrorPublicar("Escribe el título del libro (mínimo 4 letras).")
  if (titulo.length > 140) throw new ErrorPublicar("El título es muy largo (máximo 140 letras).")

  const llave = String(cuerpo.archivo_storage_key || "")
  // Sólo un PDF que subió ESTE taller: sin esto, alguien podría publicar el
  // archivo de otro (o uno pagado) como si fuera suyo.
  if (!llave.startsWith(`libros/${sellerId}/`) || !/^libros\/[\w-]+\/[a-f0-9]{16}\.pdf$/.test(llave)) {
    throw new ErrorPublicar("Sube el PDF del libro.")
  }

  const portada = String(cuerpo.portada_url || "").trim()
  if (!/^https?:\/\//.test(portada)) throw new ErrorPublicar("Sube la portada del libro.")

  const precio = Number(cuerpo.precio)
  if (!Number.isFinite(precio) || precio < 0) throw new ErrorPublicar("Pon un precio válido, o 0 si es gratis.")
  if (precio > 0 && precio < 20) throw new ErrorPublicar("El precio mínimo de un libro de pago es $20 MXN.")
  if (precio > 20000) throw new ErrorPublicar("El precio máximo es $20,000 MXN.")

  const paginas = cuerpo.paginas == null || cuerpo.paginas === "" ? null : Math.round(Number(cuerpo.paginas))

  return {
    titulo,
    autor: String(cuerpo.autor || "").trim().slice(0, 120) || undefined,
    descripcion: String(cuerpo.descripcion || "").slice(0, 8000),
    paginas: paginas && paginas > 0 && paginas < 10000 ? paginas : null,
    precio: Math.round(precio * 100) / 100,
    portada_url: portada,
    archivo_storage_key: llave,
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "libro"

async function categoriaLibros(container: MedusaContainer): Promise<string> {
  const productService = container.resolve(Modules.PRODUCT)
  const [cat] = await productService.listProductCategories({ name: CATEGORIA_LIBROS }, { take: 1 })
  if (cat) return cat.id
  const [nueva] = await productService.createProductCategories([
    { name: CATEGORIA_LIBROS, handle: "libros-y-pdf", is_active: true, is_internal: false },
  ])
  return nueva.id
}

async function etiquetas(container: MedusaContainer, valores: string[]): Promise<string[]> {
  const productService = container.resolve(Modules.PRODUCT)
  const ya = await productService.listProductTags({ value: valores }, { take: valores.length })
  const faltan = valores.filter((v) => !ya.some((t) => t.value === v))
  const nuevas = faltan.length ? await productService.createProductTags(faltan.map((value) => ({ value }))) : []
  return [...ya, ...nuevas].map((t) => t.id)
}

export async function publicarLibro(
  container: MedusaContainer,
  sellerId: string,
  memberId: string | undefined,
  d: DatosLibro
): Promise<{ product_id: string; handle: string; offer_id: string | null; gratis: boolean }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "address.*", "stock_locations.id"],
    filters: { id: sellerId },
  })
  const seller = sellers[0] as unknown as
    | { id: string; name: string; handle?: string; address?: Record<string, string | null>; stock_locations?: { id: string }[] }
    | undefined
  if (!seller) throw new ErrorPublicar("No encontramos tu tienda. Vuelve a iniciar sesión.")

  const gratis = d.precio === 0
  const perfil = await obtenerPerfilDigital(container)
  const [categoriaId, tagIds, { data: canales }] = await Promise.all([
    categoriaLibros(container),
    etiquetas(container, ["digital", "libro"]),
    query.graph({ entity: "sales_channel", fields: ["id"] }),
  ])

  const sku = `LIB-${slug(seller.handle || seller.name).slice(0, 10).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`
  const handle = `${slug(d.titulo)}-${randomBytes(2).toString("hex")}`
  const subtitulo = [d.autor ? `Por ${d.autor}` : "", d.paginas ? `${d.paginas} páginas` : "", "PDF"].filter(Boolean).join(" · ")

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: d.titulo,
          subtitle: subtitulo,
          description: descripcionAHtml(d.descripcion || ""),
          handle,
          status: "published" as const,
          discountable: true,
          thumbnail: d.portada_url,
          images: [{ url: d.portada_url }],
          shipping_profile_id: perfil.id,
          tag_ids: tagIds,
          category_ids: [categoriaId],
          sales_channels: (canales as { id: string }[]).map((c) => ({ id: c.id })),
          metadata: {
            producto_digital: true,
            es_libro: true,
            archivo_gratis: gratis,
            archivo_storage_key: d.archivo_storage_key,
            formatos: "PDF",
            libro_autor: d.autor || "",
            libro_paginas: d.paginas || null,
            publicado_con: "academia-libros",
          },
          options: [{ title: "Formato", values: ["PDF"] }],
          variants: [{ title: "PDF", sku, manage_inventory: false, options: { Formato: "PDF" }, prices: [] }],
        },
      ],
    },
  })
  const p = result[0]

  await container.resolve(ContainerRegistrationKeys.LINK).create([
    { [Modules.PRODUCT]: { product_id: p.id }, [MercurModules.SELLER]: { seller_id: seller.id } },
  ])

  // Gratis no lleva oferta: la ficha pinta "Descargar gratis" (descargas-gratis.ts)
  let offerId: string | null = null
  const variantId = p.variants?.[0]?.id
  if (!gratis && variantId) {
    const locationId = await almacenDelTaller(container, seller)
    const { data: stores } = await query.graph({ entity: "store", fields: ["supported_currencies.currency_code"] })
    const aceptadas = new Set(
      ((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).map((c) => c?.currency_code)
    )
    const precios = [{ currency_code: "mxn", amount: d.precio }]
    if (aceptadas.has("usd")) precios.push({ currency_code: "usd", amount: precioEnDolares(d.precio) })

    const { result: ofertas } = await createOffersWorkflow(container).run({
      input: {
        offers: [
          {
            seller_id: seller.id,
            created_by: memberId || "academia-libros",
            sku,
            variant_id: variantId,
            shipping_profile_id: perfil.id,
            // Un PDF no se agota, pero Mercur pide un registro de inventario.
            manage_inventory: false,
            allow_backorder: true,
            inventory_items: [{ sku, stock_levels: [{ location_id: locationId, stocked_quantity: 1000000 }] }],
            prices: precios,
          } as CreateOfferDTO,
        ],
      },
    })
    offerId = (ofertas as { id: string }[] | undefined)?.[0]?.id ?? null

    // Que exista "Entrega digital" en la tienda del taller
    await aprovisionarEnvios(container, {
      sellerId: seller.id,
      log: (m: string) => logger.info(`[envios-auto] ${m}`),
    }).catch((e) => logger.warn(`[libros] envíos de ${seller.name}: ${(e as Error).message}`))
  }

  logger.info(`[libros] ${seller.name} publicó ${p.handle}${gratis ? " (gratis)" : ""}`)
  return { product_id: p.id, handle: p.handle, offer_id: offerId, gratis }
}

/** Los libros que ha publicado el taller, para su panel. */
export async function librosDelTaller(container: MedusaContainer, sellerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["products.id", "products.title", "products.handle", "products.thumbnail", "products.status", "products.metadata", "products.created_at"],
    filters: { id: sellerId },
  })
  const productos = ((data[0] as { products?: any[] } | undefined)?.products || []).filter(
    (p) => (p?.metadata as Record<string, unknown> | null)?.es_libro === true
  )
  return productos
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((p) => ({
      id: p.id,
      titulo: p.title,
      handle: p.handle,
      portada: p.thumbnail,
      estado: p.status,
      gratis: p.metadata?.archivo_gratis === true,
    }))
}
