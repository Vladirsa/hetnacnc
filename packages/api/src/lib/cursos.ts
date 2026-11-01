// Academia HETNA (fase 1, "la vitrina"): los talleres suben cursos gratis o de
// pago y los videos viven en SU YouTube (oculto) o Vimeo. HETNA no aloja video:
// costo $0 hasta que haya ventas.
//
//   - Curso de pago: el producto del curso recibe una OFERTA del taller (sin
//     oferta Mercur no deja comprarlo), la etiqueta "digital" (envío $0) y la
//     categoría "Cursos" (10% HETNA / 90% taller, scripts/setup-course-commission).
//     metadata.producto_digital = true: el saldo del taller lo libera al momento
//     (lib/saldos-talleres.ts). Al pagarse el pedido, el comprador queda inscrito.
//   - Curso gratis: el producto queda en borrador (no sale en la tienda) y el
//     alumno se inscribe con un clic desde la página del curso.
//   - Las lecciones marcadas "vista previa" las ve cualquiera; las demás, sólo
//     los inscritos (GET /store/courses/:slug/acceso).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, createSellerStockLocationsWorkflow, updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { CreateOfferDTO } from "@mercurjs/types"

import { COURSE_MODULE } from "../modules/course"
import { ENROLLMENT_MODULE } from "../modules/enrollment"
import { enrollCustomerInCourseWorkflow } from "../workflows/enroll-customer-in-course"
import { aprovisionarEnvios, obtenerPerfilDigital } from "./envios-automaticos"
import { precioEnDolares } from "./publicar-diseno"

// ---- Video: YouTube / Vimeo ----------------------------------------------

export type Video = { provider: "youtube" | "vimeo"; asset_id: string }

/** Convierte el enlace que pega el taller en proveedor + id. null si no se reconoce. */
export function videoDeUrl(url: string | null | undefined): Video | null {
  const u = String(url || "").trim()
  if (!u) return null
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (m) return { provider: "youtube", asset_id: m[1] }
  // vimeo.com/123, vimeo.com/123/abcdef (oculto con hash), player.vimeo.com/video/123?h=abc
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?(?:.*[?&]h=([0-9a-f]{6,20}))?/)
  if (m) return { provider: "vimeo", asset_id: m[2] || m[3] ? `${m[1]}:${m[2] || m[3]}` : m[1] }
  return null
}

/** URL para incrustar el video (iframe). */
export function embedDe(provider?: string | null, assetId?: string | null): string | null {
  if (!provider || !assetId) return null
  if (provider === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(assetId)) {
    return `https://www.youtube-nocookie.com/embed/${assetId}?rel=0&modestbranding=1`
  }
  if (provider === "vimeo") {
    const [id, h] = assetId.split(":")
    if (!/^\d+$/.test(id)) return null
    return `https://player.vimeo.com/video/${id}${h && /^[0-9a-f]+$/.test(h) ? `?h=${h}` : ""}`
  }
  return null
}

/** El enlace "normal" para mostrarle al taller lo que guardó. */
export function urlDeVideo(provider?: string | null, assetId?: string | null): string | null {
  if (!provider || !assetId) return null
  if (provider === "youtube") return `https://youtu.be/${assetId}`
  if (provider === "vimeo") {
    const [id, h] = assetId.split(":")
    return `https://vimeo.com/${id}${h ? `/${h}` : ""}`
  }
  return null
}

// ---- Venta del curso -----------------------------------------------------

const knexDe = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

export type PrecioCurso = { gratis: boolean; mxn: number; usd: number | null }

export function precioDeProducto(p: any): PrecioCurso {
  const m = (p?.metadata || {}) as Record<string, any>
  const mxn = Number(m.curso_precio_mxn) || 0
  return {
    gratis: m.curso_gratis === true || mxn <= 0,
    mxn,
    usd: m.curso_precio_usd != null ? Number(m.curso_precio_usd) : null,
  }
}

/**
 * Deja el producto del curso listo para venderse (o en borrador si es gratis).
 * Se llama al crear el curso y al cambiarle el precio. Idempotente.
 */
export async function prepararVentaCurso(
  c: MedusaContainer,
  datos: { productId: string; sellerId: string; precio: number; memberId?: string; thumbnail?: string | null; description?: string | null; publicado?: boolean; slug?: string }
) {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const logger = c.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = c.resolve(Modules.PRODUCT)
  const gratis = !(datos.precio > 0)

  const { data: prods } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata", "variants.id", "variants.sku", "tags.id", "categories.id"],
    filters: { id: datos.productId },
  })
  const p = prods[0] as any
  if (!p) throw new Error(`No existe el producto ${datos.productId}`)

  const { data: stores } = await query.graph({ entity: "store", fields: ["supported_currencies.currency_code"] })
  const aceptadas = new Set(
    ((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).map((x) => x?.currency_code)
  )
  const usd = !gratis && aceptadas.has("usd") ? precioEnDolares(datos.precio) : null

  // Etiqueta "digital" (perfil sin envío) y categoría "Cursos" (comisión 10%)
  let [tag] = await productService.listProductTags({ value: "digital" }, { take: 1 })
  if (!tag) [tag] = await productService.createProductTags([{ value: "digital" }])
  const [cat] = await productService.listProductCategories({ name: "Cursos" }, { take: 1 })
  const perfil = await obtenerPerfilDigital(c)

  const tagIds = [...new Set([...(p.tags || []).map((t: any) => t.id), tag.id])]
  const catIds = [...new Set([...(p.categories || []).map((x: any) => x.id), ...(cat ? [cat.id] : [])])]
  await updateProductsWorkflow(c).run({
    input: {
      selector: { id: p.id },
      update: {
        // En la tienda sólo si es de pago y el taller ya publicó el curso
        status: !gratis && datos.publicado !== false ? "published" : "draft",
        shipping_profile_id: perfil.id,
        tag_ids: tagIds,
        category_ids: catIds,
        ...(datos.thumbnail ? { thumbnail: datos.thumbnail, images: [{ url: datos.thumbnail }] } : {}),
        ...(datos.description ? { description: datos.description } : {}),
        metadata: {
          ...(p.metadata || {}),
          es_curso: true,
          ...(datos.slug ? { curso_slug: datos.slug } : {}),
          producto_digital: true,
          curso_gratis: gratis,
          curso_precio_mxn: gratis ? 0 : datos.precio,
          curso_precio_usd: usd,
        },
      } as any,
    },
  })

  if (gratis) return { offer_id: null }

  const variantId = p.variants?.[0]?.id
  if (!variantId) throw new Error(`El producto ${p.handle} no tiene variante`)
  const precios = [{ currency_code: "mxn", amount: datos.precio }]
  if (usd) precios.push({ currency_code: "usd", amount: usd })

  // Si ya tiene oferta, sólo se actualiza el precio
  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: ["id", "seller_id"],
    filters: { variant_id: variantId },
  })
  const existente = (ofertas as { id: string; seller_id: string }[]).find((o) => o.seller_id === datos.sellerId)
  if (existente) {
    await updateOffersWorkflow(c)
      .run({ input: { offers: [{ id: existente.id, prices: precios } as any] } })
      .catch((e: Error) => logger.warn(`[cursos] no se pudo cambiar el precio de ${p.handle}: ${e.message}`))
    return { offer_id: existente.id }
  }

  // Almacén del taller (Mercur pide uno aunque sea digital)
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "address.*", "stock_locations.id"],
    filters: { id: datos.sellerId },
  })
  const seller = sellers[0] as unknown as
    | { id: string; name: string; address?: Record<string, string | null>; stock_locations?: { id: string }[] }
    | undefined
  if (!seller) throw new Error(`No existe el taller ${datos.sellerId}`)
  let locationId = seller.stock_locations?.[0]?.id
  if (!locationId) {
    const a = seller.address ?? {}
    const { result } = await createSellerStockLocationsWorkflow(c).run({
      input: {
        seller_id: seller.id,
        locations: [
          {
            name: `${seller.name} — Almacén`,
            address: {
              address_1: a.address_1 || seller.name,
              city: a.city || undefined,
              province: a.province || undefined,
              postal_code: a.postal_code || undefined,
              country_code: String(a.country_code || "mx").toLowerCase(),
            },
          },
        ],
      },
    })
    locationId = (result as { id: string }[])[0]?.id
  }
  if (!locationId) throw new Error(`No se pudo crear el almacén de ${seller.name}`)

  const sku = `CURSO-${String(p.handle).toUpperCase().slice(0, 40)}`
  const { result } = await createOffersWorkflow(c).run({
    input: {
      offers: [
        {
          seller_id: seller.id,
          created_by: datos.memberId || "academia",
          sku,
          variant_id: variantId,
          shipping_profile_id: perfil.id,
          // Un curso no se agota, pero Mercur pide un registro de inventario
          manage_inventory: false,
          allow_backorder: true,
          inventory_items: [{ sku, stock_levels: [{ location_id: locationId, stocked_quantity: 1000000 }] }],
          prices: precios,
        } as CreateOfferDTO,
      ],
    },
  })

  await aprovisionarEnvios(c, { sellerId: seller.id, log: (m: string) => logger.info(`[envios-auto] ${m}`) }).catch(
    (e: Error) => logger.warn(`[cursos] envíos de ${seller.name}: ${e.message}`)
  )
  logger.info(`[cursos] ${p.handle} a la venta en $${datos.precio} MXN`)
  return { offer_id: (result as { id: string }[] | undefined)?.[0]?.id ?? null }
}

// ---- Inscripciones -------------------------------------------------------

export async function estaInscrito(c: MedusaContainer, customerId: string, courseId: string) {
  const svc = c.resolve(ENROLLMENT_MODULE) as any
  const [e] = await svc.listEnrollments({ customer_id: customerId, course_id: courseId }, { take: 1 })
  return !!e
}

/** Inscribe al alumno una sola vez (si ya estaba, no hace nada). */
export async function inscribir(c: MedusaContainer, customerId: string, courseId: string, orderId?: string | null) {
  if (await estaInscrito(c, customerId, courseId)) return false
  try {
    await enrollCustomerInCourseWorkflow(c).run({
      input: { customer_id: customerId, course_id: courseId, order_id: orderId ?? null },
    })
    return true
  } catch (e) {
    // Dos llamadas a la vez (evento y tarea): el índice único gana; no es error
    if (await estaInscrito(c, customerId, courseId)) return false
    throw e
  }
}

const PAGADO = new Set(["captured", "partially_captured", "authorized", "partially_authorized"])

/** Pedido pagado con cursos -> el comprador queda inscrito. */
export async function inscribirPorPedido(c: MedusaContainer, orderId: string): Promise<number> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data: pedidos } = await query.graph({
    entity: "order",
    fields: ["id", "status", "payment_status", "customer_id", "items.product_id"],
    filters: { id: orderId },
  })
  const o = pedidos[0] as any
  if (!o?.customer_id || o.status === "canceled" || !PAGADO.has(String(o.payment_status))) return 0
  const productIds = [...new Set(((o.items || []) as any[]).map((i) => i.product_id).filter(Boolean))]
  if (!productIds.length) return 0

  const { data: prods } = await query.graph({
    entity: "product",
    fields: ["id", "course.id"],
    filters: { id: productIds },
  })
  let n = 0
  for (const p of prods as any[]) {
    const courseId = p?.course?.id
    if (courseId && (await inscribir(c, o.customer_id, courseId, o.id))) n++
  }
  return n
}

/** Barre pedidos recientes con cursos (por si el pago se confirmó después). */
export async function inscribirFaltantes(c: MedusaContainer, dias = 30): Promise<number> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data: cursos } = await query.graph({ entity: "course", fields: ["id", "product.id"] })
  const productIds = (cursos as any[]).map((x) => x?.product?.id).filter(Boolean)
  if (!productIds.length) return 0
  const knex = knexDe(c)
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  const filas = await knex("order_item as oi")
    .join("order_line_item as li", "li.id", "oi.item_id")
    .whereIn("li.product_id", productIds)
    .whereNull("oi.deleted_at")
    .where("oi.created_at", ">", desde)
    .distinct("oi.order_id")
    .limit(300)
  let n = 0
  for (const f of filas) n += await inscribirPorPedido(c, f.order_id).catch(() => 0)
  return n
}

// ---- Datos para la tienda ------------------------------------------------

/**
 * Agrega a cada curso lo que la vitrina necesita: precio o "gratis", el
 * taller que lo imparte, número de lecciones y duración total.
 */
export async function enriquecerCursos<T extends { id: string; seller_id?: string | null; product?: any }>(
  c: MedusaContainer,
  cursos: T[]
) {
  if (!cursos.length) return [] as (T & Record<string, any>)[]
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const ids = cursos.map((x) => x.id)

  const { data: extra } = await query.graph({
    entity: "course",
    fields: ["id", "seller_id", "product.id", "product.metadata", "sections.lessons.id", "sections.lessons.duration_seconds", "sections.lessons.is_preview"],
    filters: { id: ids },
  })
  const porId = new Map((extra as any[]).map((x) => [x.id, x]))

  const sellerIds = [...new Set((extra as any[]).map((x) => x.seller_id).filter(Boolean))]
  const { data: sellers } = sellerIds.length
    ? await query.graph({ entity: "seller", fields: ["id", "name", "handle", "logo"], filters: { id: sellerIds } })
    : { data: [] as any[] }
  const sellerPor = new Map((sellers as any[]).map((s) => [s.id, s]))

  const { data: conteos } = await query
    .graph({ entity: "enrollment", fields: ["id", "course_id"], filters: { course_id: ids } as any })
    .catch(() => ({ data: [] as any[] }))
  const alumnos = new Map<string, number>()
  for (const e of conteos as any[]) alumnos.set(e.course_id, (alumnos.get(e.course_id) || 0) + 1)

  return cursos.map((curso) => {
    const x = porId.get(curso.id) || {}
    const lecciones = ((x.sections || []) as any[]).flatMap((s) => s?.lessons || [])
    const s = sellerPor.get(x.seller_id)
    return {
      ...curso,
      precio: precioDeProducto(x.product),
      taller: s ? { id: s.id, nombre: s.name, handle: s.handle, foto: s.logo || null } : null,
      lecciones: lecciones.length,
      vistas_previas: lecciones.filter((l) => l?.is_preview).length,
      duracion_segundos: lecciones.reduce((t, l) => t + (Number(l?.duration_seconds) || 0), 0),
      alumnos: alumnos.get(curso.id) || 0,
    }
  })
}

/** Lecciones con su video: vista previa para todos, el resto sólo inscritos. */
export async function accesoCurso(c: MedusaContainer, slug: string, customerId: string | null) {
  const svc = c.resolve(COURSE_MODULE) as any
  const [curso] = await svc.listCourses({ slug, status: "published" }, { relations: ["sections", "sections.lessons"] })
  if (!curso) return null
  const inscrito = customerId ? await estaInscrito(c, customerId, curso.id) : false
  const lecciones = ((curso.sections || []) as any[])
    .sort((a, b) => a.position - b.position)
    .flatMap((s) => [...(s.lessons || [])].sort((a: any, b: any) => a.position - b.position))
    .map((l: any) => {
      const abierta = inscrito || l.is_preview
      return {
        id: l.id,
        abierta,
        embed_url: abierta ? embedDe(l.video_provider, l.video_asset_id) : null,
      }
    })
  return { course_id: curso.id, inscrito, lecciones }
}
