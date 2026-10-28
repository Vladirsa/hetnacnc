import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow } from "@mercurjs/core/workflows"
import { MercurModules, type CreateOfferDTO } from "@mercurjs/types"

import { camSellerHandle } from "../modules/cam/catalog"
import { aprovisionarEnvios, obtenerPerfilDigital } from "./envios-automaticos"

// Publica en la tienda una ficha de HETNA Digital Factory (un diseño CNC que
// ya revisó una persona) como lo pide Mercur: el producto va al catálogo
// maestro y la tienda de HETNA lo vende con una OFERTA que trae el precio.
//
// El workflow viejo de n8n le ponía el precio a la variante, que era el modelo
// de antes. En Mercur el carrito no vende variantes sino ofertas: un producto
// sin oferta sale en el catálogo pero no se puede comprar.
//
// Lo llama POST /admin/disenos-digitales/publicar, que a su vez lo llama el
// workflow "HETNA Digital Factory - Publicar producto aprobado".
//
// Es idempotente por handle: si el producto ya existe no se vuelve a crear,
// sólo se le pone la oferta si le falta. Así un reintento de n8n no duplica.

export type FichaDiseno = {
  sku: string
  titulo: string
  handle: string
  descripcion_corta?: string
  descripcion_larga: string
  caracteristicas?: string
  formatos?: string
  categoria?: string
  subcategoria?: string
  tags?: string
  imagen_url?: string
  // Gratis: se descarga con cuenta dentro del cupo semanal (lib/descargas-gratis)
  // y no lleva oferta ni precio. Si no es gratis, precio_mxn es obligatorio.
  gratis?: boolean
  precio_mxn?: number
  precio_usd?: number
  archivo_storage_key: string
  titulo_seo?: string
  meta_description?: string
  keyword_principal?: string
  faq?: { p: string; r: string }[]
}

export type DisenoPublicado = {
  creado: boolean
  product_id: string
  handle: string
  offer_id: string | null
  categoria: string | null
  precios: { currency_code: string; amount: number }[]
}

// Sin tipo de cambio en el .env, 18 pesos por dólar. El precio en dólares
// sólo cuenta para la tienda en inglés (/us).
const tipoDeCambio = () => {
  const n = Number(process.env.TIPO_CAMBIO_USD_MXN || 18)
  return n > 0 ? n : 18
}

// Termina en .99 y nunca baja de 1.99: un diseño de 25 pesos a 1.39 dólares
// se ve como error, no como oferta.
export const precioEnDolares = (mxn: number) =>
  Math.max(1.99, Math.ceil(mxn / tipoDeCambio()) - 0.01)

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

// La descripción de la ficha se pinta como HTML en la tienda
// (ProductPageDetails). Aquí se arma con lo que ya trae la ficha: el texto
// largo, lo que incluye y las preguntas frecuentes. No se inventa nada que la
// ficha no diga.
export function descripcionHtml(f: FichaDiseno): string {
  const partes = [`<p>${escapar(f.descripcion_larga)}</p>`]

  const incluye = (f.caracteristicas || "")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
  if (f.formatos) incluye.push(`Formatos: ${f.formatos}`)
  if (incluye.length) {
    partes.push(
      `<h3>Qué incluye</h3><ul>${incluye.map((c) => `<li>${escapar(c)}</li>`).join("")}</ul>`
    )
  }

  const faq = (f.faq || []).filter((x) => x?.p && x?.r)
  if (faq.length) {
    partes.push(
      `<h3>Preguntas frecuentes</h3>${faq
        .map((x) => `<p><strong>${escapar(x.p)}</strong><br>${escapar(x.r)}</p>`)
        .join("")}`
    )
  }

  return partes.join("")
}

export async function publicarDiseno(
  container: MedusaContainer,
  ficha: FichaDiseno
): Promise<DisenoPublicado> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // ---- La tienda que vende (la misma de los servicios CAM) -----------------
  const handleTienda = camSellerHandle()
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "currency_code", "members.id", "stock_locations.id"],
    filters: { handle: handleTienda } as Record<string, unknown>,
  })
  const seller = sellers[0] as
    | {
        id: string
        email?: string | null
        members?: { id: string }[]
        stock_locations?: { id: string }[]
      }
    | undefined
  if (!seller) {
    throw new Error(
      `No existe la tienda "${handleTienda}". Créala con src/scripts/crear-tienda-hetna.ts o pon CAM_SELLER_HANDLE.`
    )
  }
  const locationId = seller.stock_locations?.[0]?.id
  if (!locationId) {
    throw new Error(
      `La tienda "${handleTienda}" no tiene almacén. Corre una vez src/scripts/seed-cam-services.ts, que se lo crea.`
    )
  }

  if (!ficha.gratis && !(Number(ficha.precio_mxn) > 0)) {
    throw new Error(`La ficha ${ficha.sku} no es gratis y no trae precio.`)
  }

  // ---- Precios: MXN de la ficha y USD derivado, si la plataforma lo acepta --
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["supported_currencies.currency_code"],
  })
  const aceptadas = new Set(
    ((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).map((c) => c?.currency_code)
  )
  const precios: { currency_code: string; amount: number }[] = []
  if (!ficha.gratis) {
    const mxn = Number(ficha.precio_mxn)
    precios.push({ currency_code: "mxn", amount: mxn })
    if (aceptadas.has("usd")) {
      precios.push({ currency_code: "usd", amount: ficha.precio_usd ?? precioEnDolares(mxn) })
    }
  }

  // ---- ¿Ya existe? ----------------------------------------------------------
  const { data: existentes } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "categories.name"],
    filters: { handle: ficha.handle },
  })
  let producto = existentes[0] as
    | { id: string; handle: string; variants?: { id: string }[]; categories?: { name: string }[] }
    | undefined
  const creado = !producto
  let categoria: string | null = producto?.categories?.[0]?.name ?? null

  if (!producto) {
    const perfil = await obtenerPerfilDigital(container)

    // Etiquetas: "digital" decide el perfil de envío y el aviso de "Descarga
    // digital" en la ficha. Las demás son las de la ficha, para el pie del
    // producto y la búsqueda.
    const valores = [
      "digital",
      ...(ficha.tags || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10)
    const yaHay = await productService.listProductTags({ value: valores }, { take: valores.length })
    const faltan = valores.filter((v) => !yaHay.some((t) => t.value === v))
    const nuevas = faltan.length
      ? await productService.createProductTags(faltan.map((value) => ({ value })))
      : []
    const tagIds = [...yaHay, ...nuevas].map((t) => t.id)

    // Categoría: la subcategoría de la ficha si existe en el catálogo, si no
    // la categoría. Si ninguna existe el producto sale igual, sin categoría,
    // y se avisa en la respuesta para darla de alta en el panel.
    const { data: cats } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle"],
    })
    const buscar = (nombre?: string) => {
      if (!nombre) return undefined
      const n = normalizar(nombre)
      return (cats as { id: string; name: string; handle: string }[]).find(
        (c) => normalizar(c.name) === n || normalizar(c.handle) === n
      )
    }
    const cat = buscar(ficha.subcategoria) || buscar(ficha.categoria)
    categoria = cat?.name ?? null

    const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })

    // Flujo de Medusa y no el de Mercur, igual que los servicios CAM: el de
    // Mercur sólo arma variantes con atributos del catálogo, y un archivo
    // digital tiene una sola variante sin atributos.
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: ficha.titulo,
            subtitle: ficha.descripcion_corta,
            description: descripcionHtml(ficha),
            handle: ficha.handle,
            status: "published" as const,
            discountable: true,
            thumbnail: ficha.imagen_url,
            images: ficha.imagen_url ? [{ url: ficha.imagen_url }] : [],
            shipping_profile_id: perfil.id,
            tag_ids: tagIds,
            category_ids: cat ? [cat.id] : [],
            sales_channels: canales.map((c) => ({ id: c.id })),
            metadata: {
              producto_digital: true,
              archivo_gratis: ficha.gratis === true,
              digital_factory_sku: ficha.sku,
              archivo_storage_key: ficha.archivo_storage_key,
              formatos: ficha.formatos || "",
              seo_title: ficha.titulo_seo || "",
              meta_description: ficha.meta_description || "",
              keyword_principal: ficha.keyword_principal || "",
            },
            options: [{ title: "Formato", values: ["Archivo digital"] }],
            variants: [
              {
                title: "Archivo digital",
                sku: ficha.sku,
                manage_inventory: false,
                options: { Formato: "Archivo digital" },
                prices: [],
              },
            ],
          },
        ],
      },
    })
    const p = result[0]

    // La tienda HETNA queda autorizada para vender este producto.
    await container.resolve(ContainerRegistrationKeys.LINK).create([
      {
        [Modules.PRODUCT]: { product_id: p.id },
        [MercurModules.SELLER]: { seller_id: seller.id },
      },
    ])

    producto = { id: p.id, handle: p.handle, variants: (p.variants || []).map((v) => ({ id: v.id })) }
    logger.info(`[disenos] producto creado ${p.handle} (${ficha.sku})`)
  }

  // Un archivo gratis no se vende: sin oferta no aparece el carrito, y la
  // ficha pinta "Descargar gratis" en su lugar.
  if (ficha.gratis) {
    return { creado, product_id: producto.id, handle: producto.handle, offer_id: null, categoria, precios }
  }

  // ---- La oferta de la tienda HETNA ----------------------------------------
  const variantId = producto.variants?.[0]?.id
  if (!variantId) {
    throw new Error(`El producto ${producto.handle} no tiene variante.`)
  }

  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: ["id", "seller_id"],
    filters: { variant_id: variantId },
  })
  let offerId =
    (ofertas as { id: string; seller_id: string }[]).find((o) => o.seller_id === seller.id)?.id ?? null

  if (!offerId) {
    let memberId = seller.members?.[0]?.id
    if (!memberId && seller.email) {
      const { data: miembros } = await query.graph({
        entity: "member",
        fields: ["id"],
        filters: { email: seller.email } as Record<string, unknown>,
      })
      memberId = (miembros[0] as { id?: string } | undefined)?.id
    }

    const skuOferta = `HETNA-${ficha.sku}`
    const { result } = await createOffersWorkflow(container).run({
      input: {
        offers: [
          {
            seller_id: seller.id,
            created_by: memberId || "publicar-diseno",
            sku: skuOferta,
            variant_id: variantId,
            shipping_profile_id: (await obtenerPerfilDigital(container)).id,
            // Un archivo no se agota, pero Mercur pide un registro de
            // inventario por oferta.
            manage_inventory: false,
            allow_backorder: true,
            inventory_items: [
              { sku: skuOferta, stock_levels: [{ location_id: locationId, stocked_quantity: 1000000 }] },
            ],
            prices: precios,
          } as CreateOfferDTO,
        ],
      },
    })
    offerId = (result as { id: string }[] | undefined)?.[0]?.id ?? null
    logger.info(`[disenos] oferta creada para ${producto.handle}`)

    // Que exista "Entrega digital" en la tienda; si ya existe no hace nada.
    await aprovisionarEnvios(container, {
      sellerId: seller.id,
      log: (m: string) => logger.info(`[envios-auto] ${m}`),
    })
  }

  return { creado, product_id: producto.id, handle: producto.handle, offer_id: offerId, categoria, precios }
}
