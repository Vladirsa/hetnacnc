// "Publicar producto" fácil para los talleres, por pasos, como Mercado Libre:
// fotos → título → categoría → precio y existencias → envío → descripción.
//
// La pantalla vive en el panel del taller (apps/vendor/src/routes/publicar) y
// llama a POST /vendor/hetna-publicar, que hace aquí en un solo paso lo que el
// formulario de Mercur pide en varias pantallas:
//   1. el producto (publicado de una vez: product_request está apagado, ver
//      medusa-config.ts) con una sola presentación,
//   2. el permiso del taller para venderlo,
//   3. la OFERTA con su precio y sus existencias (sin oferta el producto sale
//      en la tienda pero no se puede comprar),
//   4. y los envíos del taller (aprovisionarEnvios), si le faltaban.
// Si el taller no tiene almacén todavía, se le crea uno con su dirección.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, createSellerStockLocationsWorkflow } from "@mercurjs/core/workflows"
import { MercurModules, type CreateOfferDTO } from "@mercurjs/types"
import { randomBytes } from "crypto"

import { aprovisionarEnvios } from "./envios-automaticos"
import { precioEnDolares } from "./publicar-diseno"

export class ErrorPublicar extends Error {}

export type DatosPublicar = {
  titulo: string
  descripcion?: string
  categoria_id: string
  fotos: string[]
  precio: number
  existencias: number
  condicion?: "nuevo" | "usado" | "reacondicionado"
  peso_kg: number
  largo_cm: number
  ancho_cm: number
  alto_cm: number
  sku?: string
}

const CONDICIONES = { nuevo: "Nuevo", usado: "Usado", reacondicionado: "Reacondicionado" } as const

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "producto"

/**
 * El texto del taller a HTML (la tienda pinta la descripción como HTML): cada
 * párrafo en <p>, y los renglones que empiezan con "-", "•" o "*" en una lista.
 */
export function descripcionAHtml(texto: string): string {
  const bloques: string[] = []
  let lista: string[] = []
  const cerrarLista = () => {
    if (lista.length) bloques.push(`<ul>${lista.map((l) => `<li>${escapar(l)}</li>`).join("")}</ul>`)
    lista = []
  }
  for (const crudo of String(texto || "").split(/\r?\n/)) {
    const r = crudo.trim()
    const vineta = r.match(/^[-•*]\s*(.+)$/)
    if (vineta) {
      lista.push(vineta[1])
      continue
    }
    cerrarLista()
    if (r) bloques.push(`<p>${escapar(r)}</p>`)
  }
  cerrarLista()
  return bloques.join("")
}

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

/** Revisa y limpia lo que manda la pantalla. Lanza ErrorPublicar con un mensaje para el taller. */
export function validar(cuerpo: Record<string, unknown>): DatosPublicar {
  const titulo = String(cuerpo.titulo || "").replace(/\s+/g, " ").trim()
  if (titulo.length < 8) throw new ErrorPublicar("El título es muy corto: di qué es, la marca o el material y la medida.")
  if (titulo.length > 120) throw new ErrorPublicar("El título es muy largo (máximo 120 letras).")

  const fotos = (Array.isArray(cuerpo.fotos) ? cuerpo.fotos : [])
    .map((f) => String(f || "").trim())
    .filter((f) => /^https?:\/\//.test(f) || f.startsWith("/"))
    .slice(0, 10)
  if (!fotos.length) throw new ErrorPublicar("Sube al menos una foto del producto.")

  const categoria_id = String(cuerpo.categoria_id || "").trim()
  if (!categoria_id) throw new ErrorPublicar("Elige la categoría del producto.")

  const precio = Math.round(num(cuerpo.precio) * 100) / 100
  if (!(precio > 0)) throw new ErrorPublicar("Escribe el precio en pesos.")
  if (precio > 5_000_000) throw new ErrorPublicar("Revisa el precio: parece demasiado alto.")

  const existencias = Math.floor(num(cuerpo.existencias))
  if (!(existencias >= 1)) throw new ErrorPublicar("Escribe cuántas piezas tienes disponibles (al menos 1).")
  if (existencias > 100_000) throw new ErrorPublicar("Revisa las existencias: máximo 100,000.")

  const peso_kg = num(cuerpo.peso_kg)
  const largo_cm = num(cuerpo.largo_cm)
  const ancho_cm = num(cuerpo.ancho_cm)
  const alto_cm = num(cuerpo.alto_cm)
  if (!(peso_kg > 0) || peso_kg > 1000) throw new ErrorPublicar("Escribe el peso del paquete en kilos (por ejemplo 1.5).")
  for (const [n, v] of [["largo", largo_cm], ["ancho", ancho_cm], ["alto", alto_cm]] as const) {
    if (!(v > 0) || v > 500) throw new ErrorPublicar(`Escribe el ${n} del paquete en centímetros.`)
  }

  const condicion = (["nuevo", "usado", "reacondicionado"] as const).find((c) => c === cuerpo.condicion) || "nuevo"
  const descripcion = String(cuerpo.descripcion || "").slice(0, 8000)
  const sku = String(cuerpo.sku || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40) || undefined

  return { titulo, descripcion, categoria_id, fotos, precio, existencias, condicion, peso_kg, largo_cm, ancho_cm, alto_cm, sku }
}

/** Categorías para elegir, con su ruta ("Herramientas › Fresas"). Sin las internas ni las apagadas. */
export async function categoriasParaPublicar(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id", "is_active", "is_internal"],
  })
  type Cat = { id: string; name: string; handle: string; parent_category_id: string | null; is_active?: boolean; is_internal?: boolean }
  const todas = (data as Cat[]).filter((c) => c.is_active !== false && c.is_internal !== true)
  const porId = new Map(todas.map((c) => [c.id, c]))
  const hijos = new Set(todas.map((c) => c.parent_category_id).filter(Boolean) as string[])
  const ruta = (c: Cat) => {
    const partes = [c.name]
    let p = c.parent_category_id ? porId.get(c.parent_category_id) : undefined
    for (let i = 0; p && i < 6; i++) {
      partes.unshift(p.name)
      p = p.parent_category_id ? porId.get(p.parent_category_id) : undefined
    }
    return partes.join(" › ")
  }
  return todas
    .map((c) => ({ id: c.id, nombre: c.name, ruta: ruta(c), final: !hijos.has(c.id) }))
    .sort((a, b) => a.ruta.localeCompare(b.ruta, "es"))
}

export async function publicarRapido(
  container: MedusaContainer,
  sellerId: string,
  memberId: string | undefined,
  d: DatosPublicar
): Promise<{ product_id: string; handle: string; offer_id: string | null }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "address.*", "stock_locations.id"],
    filters: { id: sellerId },
  })
  const seller = sellers[0] as
    | { id: string; name: string; handle?: string; address?: Record<string, string | null>; stock_locations?: { id: string }[] }
    | undefined
  if (!seller) throw new ErrorPublicar("No encontramos tu tienda. Vuelve a iniciar sesión.")

  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "is_active", "is_internal"],
    filters: { id: d.categoria_id },
  })
  const cat = cats[0] as { id: string; is_active?: boolean; is_internal?: boolean } | undefined
  if (!cat || cat.is_active === false || cat.is_internal === true) throw new ErrorPublicar("Esa categoría ya no existe. Elige otra.")

  // Almacén del taller: si no tiene, uno con su dirección
  let locationId = seller.stock_locations?.[0]?.id
  if (!locationId) {
    const a = seller.address ?? {}
    const { result } = await createSellerStockLocationsWorkflow(container).run({
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
    if (!locationId) throw new Error("No se pudo crear el almacén del taller")
    logger.info(`[publicar] almacén creado para ${seller.name}`)
  }

  // Perfil de envío físico: el mismo que usa envios-automaticos.ts
  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = ((perfiles as { id: string; name: string }[]).find((x) => x.name === "Marketplace Shipping") ||
    (perfiles as { id: string; name: string }[]).find((x) => x.name !== "Producto digital")) as { id: string } | undefined
  if (!perfil?.id) throw new Error("No hay perfil de envío")
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })

  const sku = d.sku || `${slug(seller.handle || seller.name).slice(0, 12).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`
  const handle = `${slug(d.titulo)}-${randomBytes(2).toString("hex")}`
  const medidas = { weight: d.peso_kg, length: d.largo_cm, width: d.ancho_cm, height: d.alto_cm }
  const condicion = CONDICIONES[d.condicion || "nuevo"]
  const presentacion = "Única"

  // Flujo de Medusa, igual que publicar-diseno.ts: una sola presentación sin
  // atributos del catálogo, que es lo que vende el 90% de los talleres.
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: d.titulo,
          description: descripcionAHtml(d.descripcion || ""),
          handle,
          status: "published" as const,
          discountable: true,
          thumbnail: d.fotos[0],
          images: d.fotos.map((url) => ({ url })),
          shipping_profile_id: perfil.id,
          category_ids: [cat.id],
          sales_channels: (canales as { id: string }[]).map((c) => ({ id: c.id })),
          ...medidas,
          metadata: { condicion, publicado_con: "publicar-facil" },
          options: [{ title: "Presentación", values: [presentacion] }],
          variants: [
            {
              title: presentacion,
              sku,
              // Las existencias viven en la oferta (Mercur), no en la variante
              manage_inventory: false,
              options: { Presentación: presentacion },
              prices: [],
              ...medidas,
            },
          ],
        },
      ],
    },
  })
  const p = result[0]

  await container.resolve(ContainerRegistrationKeys.LINK).create([
    {
      [Modules.PRODUCT]: { product_id: p.id },
      [MercurModules.SELLER]: { seller_id: seller.id },
    },
  ])

  // Precio en pesos y, si la plataforma acepta dólares, también en dólares
  const { data: stores } = await query.graph({ entity: "store", fields: ["supported_currencies.currency_code"] })
  const aceptadas = new Set(
    ((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).map((c) => c?.currency_code)
  )
  const precios = [{ currency_code: "mxn", amount: d.precio }]
  if (aceptadas.has("usd")) precios.push({ currency_code: "usd", amount: precioEnDolares(d.precio) })

  let offerId: string | null = null
  const variantId = p.variants?.[0]?.id
  if (variantId) {
    const { result: ofertas } = await createOffersWorkflow(container).run({
      input: {
        offers: [
          {
            seller_id: seller.id,
            created_by: memberId || "publicar-facil",
            sku,
            variant_id: variantId,
            shipping_profile_id: perfil.id,
            manage_inventory: true,
            allow_backorder: false,
            inventory_items: [{ sku, stock_levels: [{ location_id: locationId, stocked_quantity: d.existencias }] }],
            prices: precios,
          } as CreateOfferDTO,
        ],
      },
    })
    offerId = (ofertas as { id: string }[] | undefined)?.[0]?.id ?? null
  }

  await aprovisionarEnvios(container, {
    sellerId: seller.id,
    log: (m: string) => logger.info(`[envios-auto] ${m}`),
  }).catch((e) => logger.warn(`[publicar] envíos de ${seller.name}: ${(e as Error).message}`))

  logger.info(`[publicar] ${seller.name} publicó ${p.handle}`)
  return { product_id: p.id, handle: p.handle, offer_id: offerId }
}
