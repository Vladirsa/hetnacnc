// Productos de la Biblioteca de planos en la tienda: un producto maestro por
// plano (catálogo compartido de Mercur), con variantes de acabado y color.
// No se liga a ningún taller: cualquier taller puede ponerle su oferta (su
// precio, sus días de entrega, su envío), y el cliente las ve juntas.
//
// Los datos (nombre, medidas, peso, precio recomendado por acabado) salen de
// la tienda: GET {STORE_URL}/mx/planos/datos (apps/storefront).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow, createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { subir } from "./fabrica"
import { cargarNombresPlanos } from "./planos-correo"
import { pngLaminaPlano } from "./planos-imagen"
import { STORE_URL, esc } from "./licitacion"

export type PlanoCatalogo = {
  slug: string
  nombre: string
  categoria: string
  resumen: string
  descripcion: string
  nivel: string
  horas: string
  herrajes: string[]
  medidas_mm: { ancho: number; fondo: number; alto: number }
  paquete_cm: { largo: number; ancho: number; alto: number }
  peso_kg: number
  piezas: number
  hojas: number
  dias_fabricacion: number
  precios: Record<"lijado" | "sellado" | "pintura", number>
  imagenes: string[]
}

/** Variantes que se crean: acabado + color (el color sólo si va pintado). */
export const VARIANTES_PLANO = [
  { codigo: "NAT", acabado: "Natural lijado", color: "Natural", precio: "lijado" },
  { codigo: "SEL", acabado: "Sellado / barniz", color: "Natural", precio: "sellado" },
  { codigo: "BLA", acabado: "Pintado", color: "Blanco", precio: "pintura" },
  { codigo: "NEG", acabado: "Pintado", color: "Negro", precio: "pintura" },
  { codigo: "GRI", acabado: "Pintado", color: "Gris", precio: "pintura" },
  { codigo: "NOG", acabado: "Pintado", color: "Nogal", precio: "pintura" },
] as const

export const handlePlano = (slug: string) => `plano-${slug}`
export const skuPlano = (slug: string, codigo: string) => `HETNA-PL-${slug.toUpperCase().slice(0, 40)}-${codigo}`

/** solo: lee sólo esos planos (sin la caché de la página: sirve justo al aprobar uno nuevo). */
/** Limpia etiquetas de la caché de la tienda (mismo aviso que subscribers/storefront-cache-revalidate.ts). */
export async function limpiarCacheTienda(tags: string[]) {
  const url = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  if (!url || !secret || !tags.length) return
  for (let i = 0; i < tags.length; i += 50) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags: tags.slice(i, i + 50) }),
      signal: AbortSignal.timeout(15_000),
    })
  }
}

export async function leerCatalogoPlanos(solo?: string[]): Promise<PlanoCatalogo[]> {
  const q = solo?.length ? `?solo=${encodeURIComponent(solo.join(","))}&t=${Date.now()}` : ""
  const r = await fetch(`${STORE_URL}/mx/planos/datos${q}`, { headers: { accept: "application/json" } })
  if (!r.ok) throw new Error(`No pude leer el catálogo de planos (${STORE_URL}/mx/planos/datos): HTTP ${r.status}`)
  const d = (await r.json()) as { planos?: PlanoCatalogo[] }
  if (!Array.isArray(d.planos) || !d.planos.length) throw new Error("El catálogo de planos llegó vacío")
  return d.planos
}

export function descripcionPlano(p: PlanoCatalogo) {
  const liga = `${STORE_URL}/mx/planos/${p.slug}`
  return [
    `<p>${esc(p.resumen)}</p>`,
    `<p>${esc(p.descripcion)}</p>`,
    `<p><b>Qué recibes:</b> las ${p.piezas} piezas cortadas en router CNC en triplay de pino y lijadas, listas para armar (${p.medidas_mm.ancho} × ${p.medidas_mm.fondo} × ${p.medidas_mm.alto} mm armado). Los herrajes no van incluidos: ${esc(p.herrajes.join("; "))}.</p>`,
    `<p><b>Armado:</b> nivel ${esc(p.nivel.toLowerCase())}, ${esc(p.horas)}, con el plano paso a paso.</p>`,
    `<p>¿Lo quieres de otra medida o prefieres cortarlo tú? El plano es gratis, con lista de corte y DXF: <a href="${liga}">${liga.replace(/^https?:\/\//, "")}</a></p>`,
  ].join("")
}

export async function categoriaPlanos(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const nombre = process.env.PLANOS_CATEGORIA || "Muebles para armar"
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "name"], filters: { name: nombre } as any })
  if (data[0]?.id) return data[0].id as string
  const { result } = await createProductCategoriesWorkflow(container).run({
    input: { product_categories: [{ name: nombre, handle: "muebles-para-armar", is_active: true, is_internal: false }] },
  })
  return result[0].id as string
}

/** Las 4 láminas del plano en PNG, subidas al almacenamiento de archivos. */
async function imagenesPlano(container: MedusaContainer, slug: string, logger: { warn: (m: string) => void }) {
  const urls: string[] = []
  for (const n of [1, 2, 3, 4]) {
    try {
      urls.push(await subir(container, `plano-${slug}-${n}.png`, "image/png", await pngLaminaPlano(slug, n)))
    } catch (e) {
      logger.warn(`[planos-tienda] lámina ${n} de ${slug}: ${(e as Error).message}`)
    }
  }
  return urls
}

const metadataDe = (p: PlanoCatalogo) => ({
  tipo_producto: "a_medida",
  origen: "plano",
  plano_slug: p.slug,
  precio_recomendado: p.precios,
  tiempo_produccion: `${p.dias_fabricacion} días hábiles`,
  material: "Triplay de pino",
  medida_principal: `${p.medidas_mm.ancho} × ${p.medidas_mm.fondo} × ${p.medidas_mm.alto} mm`,
})

/**
 * Crea (o actualiza el precio recomendado de) el producto de cada plano.
 * Se crean como borrador salvo que publicar = true.
 */
export async function sincronizarProductosPlanos(container: MedusaContainer, o: { publicar?: boolean; solo?: string[] } = {}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  await cargarNombresPlanos(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), true)
  const planos = (await leerCatalogoPlanos(o.solo)).filter((p) => !o.solo?.length || o.solo.includes(p.slug))
  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = ((perfiles as { id: string; name: string }[]).find((x) => x.name === "Marketplace Shipping") ||
    (perfiles as { id: string; name: string }[]).find((x) => x.name !== "Producto digital")) as { id: string } | undefined
  if (!perfil?.id) throw new Error("No hay perfil de envío")
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const categoria = await categoriaPlanos(container)
  let creados = 0, actualizados = 0

  for (const p of planos) {
    const handle = handlePlano(p.slug)
    const { data: ya } = await query.graph({ entity: "product", fields: ["id", "status", "metadata", "thumbnail"], filters: { handle } })
    const medidas = { weight: p.peso_kg, length: p.paquete_cm.largo, width: p.paquete_cm.ancho, height: p.paquete_cm.alto }
    if (ya[0]?.id) {
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: ya[0].id },
          update: {
            metadata: { ...((ya[0].metadata as Record<string, unknown>) || {}), ...metadataDe(p) },
            ...medidas,
            ...(o.publicar ? { status: "published" as const } : {}),
            // Si se creó sin fotos (la lámina falló), se ponen ahora
            ...(!ya[0].thumbnail ? await (async () => { const im = await imagenesPlano(container, p.slug, logger); return im.length ? { thumbnail: im[0], images: im.map((url) => ({ url })) } : {} })() : {}),
          },
        },
      })
      actualizados++
      continue
    }
    const imagenes = await imagenesPlano(container, p.slug, logger)
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: p.nombre,
            subtitle: "Kit de piezas cortadas en CNC, listo para armar",
            description: descripcionPlano(p),
            handle,
            status: o.publicar ? ("published" as const) : ("draft" as const),
            discountable: true,
            thumbnail: imagenes[0],
            images: imagenes.map((url) => ({ url })),
            shipping_profile_id: perfil.id,
            category_ids: [categoria],
            sales_channels: (canales as { id: string }[]).map((c) => ({ id: c.id })),
            ...medidas,
            metadata: metadataDe(p),
            options: [
              { title: "Acabado", values: [...new Set(VARIANTES_PLANO.map((v) => v.acabado))] },
              { title: "Color", values: [...new Set(VARIANTES_PLANO.map((v) => v.color))] },
            ],
            variants: VARIANTES_PLANO.map((v) => ({
              title: v.acabado === "Pintado" ? `Pintado ${v.color.toLowerCase()}` : v.acabado,
              sku: skuPlano(p.slug, v.codigo),
              // Las existencias y el precio viven en la oferta de cada taller (Mercur)
              manage_inventory: false,
              options: { Acabado: v.acabado, Color: v.color },
              prices: [],
              metadata: { precio_recomendado: p.precios[v.precio] },
              ...medidas,
            })),
          },
        ],
      },
    })
    creados++
    logger.info(`[planos-tienda] producto creado: ${handle}`)
  }
  // La tienda guarda los productos en caché sin vencimiento; si alguien abrió la
  // liga antes de que existiera, se quedó el «no existe». Se limpia aquí mismo
  // (el script corre fuera del servidor y sus eventos pueden no llegar).
  await limpiarCacheTienda(["products", ...planos.map((p) => `product-${handlePlano(p.slug)}`)]).catch(() => undefined)
  return { creados, actualizados, total: planos.length }
}
