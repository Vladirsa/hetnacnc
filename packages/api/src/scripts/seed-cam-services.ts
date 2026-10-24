/**
 * Crea los productos de servicio del Laboratorio CAM (3, 4 y 5 ejes,
 * posprocesador y revisión) y las ofertas con las que los vende la tienda de
 * HETNA.
 *
 * Uso (en packages/api):
 *   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/seed-cam-services.ts
 *
 * Se puede correr varias veces: lo que ya existe (producto por handle, oferta
 * por variante + tienda) no se vuelve a crear. Los precios son de ejemplo en
 * MXN; cámbialos después en el panel.
 *
 * Por qué ofertas: en Mercur el carrito no vende productos sino OFERTAS de una
 * tienda. Cada servicio CAM es un producto del catálogo, y la tienda de HETNA
 * (handle `hetna-cnc`, o CAM_SELLER_HANDLE) tiene una oferta por nivel.
 *
 * Envío: los productos llevan la etiqueta "digital", así que usan el perfil
 * "Producto digital" y en el pago aparece "Entrega digital" a $0 (lo crea
 * lib/envios-automaticos.ts en la tienda de HETNA).
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createOffersWorkflow, createSellerStockLocationsWorkflow } from "@mercurjs/core/workflows"
import { MercurModules, type CreateOfferDTO } from "@mercurjs/types"
import { aprovisionarEnvios, obtenerPerfilDigital } from "../lib/envios-automaticos"
import {
  CAM_PRODUCT_HANDLES,
  CAM_TIER_OPTION,
  CAM_TIERS,
  SEED_PRICES,
  camSellerHandle,
} from "../modules/cam/catalog"

type ServiceKey = keyof typeof CAM_PRODUCT_HANDLES

const SERVICES: {
  key: ServiceKey
  title: string
  subtitle: string
  description: string
  tiered: boolean
}[] = [
  {
    key: "cam_3",
    title: "Programa CAM 3 ejes",
    subtitle: "Relieves y superficies desde arriba",
    description:
      "Trayectorias de desbaste y acabado en 3 ejes para tu máquina, con verificación de zanco y portaherramienta, simulación y G-code listo para tu controlador.",
    tiered: true,
  },
  {
    key: "cam_4",
    title: "Programa CAM 4 ejes rotativo",
    subtitle: "Columnas, patas y piezas torneadas",
    description:
      "Trayectoria en espiral o por líneas con eje A, desbaste por niveles y G-code con el giro continuo calculado para tu máquina.",
    tiered: true,
  },
  {
    key: "cam_5",
    title: "Programa CAM 5 ejes simultáneos",
    subtitle: "Álabes, impulsores y esculturas",
    description:
      "Orientación continua de la herramienta con anticolisión automática, límites de ejes rotativos y coordenadas de máquina calculadas con tu pivote o TCP.",
    tiered: true,
  },
  {
    key: "post",
    title: "Posprocesador personalizado",
    subtitle: "Mach3, Mach4, LinuxCNC, GRBL, Fanuc, Haas, Siemens, Heidenhain",
    description:
      "Posprocesador para Fusion 360 o Vectric hecho para tu cinemática, tu controlador y tus códigos de cambio de herramienta y refrigerante.",
    tiered: false,
  },
  {
    key: "review",
    title: "Revisión por especialista CAM",
    subtitle: "Un técnico revisa tu programa antes de cortar",
    description:
      "Revisión manual de trayectorias, límites, cero de pieza y sujeción, con recomendaciones por escrito.",
    tiered: false,
  },
]

const optionTitle = (s: (typeof SERVICES)[number]) => (s.tiered ? CAM_TIER_OPTION : "Servicio")
const optionValues = (s: (typeof SERVICES)[number]) => (s.tiered ? CAM_TIERS : ["Estándar"])

export default async function seedCamServices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)
  const dry = process.env.DRY_RUN === "1"

  // ---- La tienda que vende los servicios -----------------------------------
  const handle = camSellerHandle()
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: [
      "id", "name", "handle", "email", "currency_code", "members.id", "stock_locations.id",
      "address.address_1", "address.city", "address.province", "address.postal_code", "address.country_code",
    ],
    filters: { handle } as Record<string, unknown>,
  })
  type Direccion = { address_1?: string | null; city?: string | null; province?: string | null; postal_code?: string | null; country_code?: string | null }
  const seller = sellers[0] as
    | {
        id: string
        name: string
        email?: string | null
        currency_code?: string
        members?: { id: string }[]
        stock_locations?: { id: string }[]
        address?: Direccion | null
      }
    | undefined
  if (!seller) {
    logger.error(
      `No existe la tienda "${handle}". Créala con src/scripts/crear-tienda-hetna.ts o pon CAM_SELLER_HANDLE con el handle de tu tienda.`
    )
    return
  }

  // Quién queda como autor de las ofertas (sólo es para el historial). Si la
  // tienda no tiene miembros ligados, se anota el script.
  let memberId = seller.members?.[0]?.id
  if (!memberId && seller.email) {
    const { data: miembros } = await query.graph({
      entity: "member",
      fields: ["id"],
      filters: { email: seller.email } as Record<string, unknown>,
    })
    memberId = (miembros[0] as { id?: string } | undefined)?.id
  }
  memberId ||= "seed-cam-services"

  // Las ofertas necesitan una ubicación (almacén) de la tienda aunque sea un
  // servicio. Si la tienda no tiene ninguna, se crea una con su dirección (o con
  // la de origen de envíos del .env) y aprovisionarEnvios, más abajo, le pone
  // la zona México, el canal de ventas y "Entrega digital".
  let locationId = seller.stock_locations?.[0]?.id
  if (!locationId) {
    const a = seller.address ?? {}
    const address = {
      address_1: a.address_1 || process.env.ENVIO_ORIGEN_COLONIA || "Servicios digitales HETNA",
      city: a.city || process.env.ENVIO_ORIGEN_MUNICIPIO || undefined,
      province: a.province || process.env.ENVIO_ORIGEN_ESTADO || undefined,
      postal_code: a.postal_code || process.env.ENVIO_ORIGEN_CP || undefined,
      country_code: (a.country_code || "mx").toLowerCase(),
    }
    if (dry) {
      logger.info(`[prueba] La tienda no tiene almacén; se crearía uno en ${address.city || address.address_1}`)
    } else {
      const { result } = await createSellerStockLocationsWorkflow(container).run({
        input: { seller_id: seller.id, locations: [{ name: `${seller.name} — Servicios`, address }] },
      })
      locationId = result[0]?.id
      logger.info(`Almacén creado para la tienda: ${locationId}`)
    }
  }
  if (!locationId && !dry) {
    logger.error(`No se pudo crear un almacén para ${seller.name}. Créalo en /seller > Ubicaciones y vuelve a correr el script.`)
    return
  }
  logger.info(`Tienda: ${seller.name} (${seller.id})`)

  // ---- Monedas: la de la tienda (MXN) y las que acepte la plataforma ---------
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })
  const currencies = Array.from(
    new Set(
      [
        seller.currency_code,
        ...((stores[0]?.supported_currencies ?? []) as { currency_code?: string }[]).map((c) => c?.currency_code),
      ].filter((c): c is string => Boolean(c) && Boolean(SEED_PRICES[c as string]))
    )
  )
  if (!currencies.length) {
    currencies.push("mxn")
  }
  const priceFor = (key: ServiceKey, tierIndex: number) =>
    currencies.map((currency_code) => {
      const list = SEED_PRICES[currency_code][key] ?? [0]
      return { currency_code, amount: list[Math.min(tierIndex, list.length - 1)] }
    })

  // ---- Perfil digital y etiqueta "digital" -----------------------------------
  const perfil = await obtenerPerfilDigital(container)
  let [tag] = await productService.listProductTags({ value: "digital" }, { take: 1 })
  if (!tag && !dry) {
    ;[tag] = await productService.createProductTags([{ value: "digital" }])
  }

  // ---- Productos de servicio -------------------------------------------------
  const handles = SERVICES.map((s) => CAM_PRODUCT_HANDLES[s.key])
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["handle"],
    filters: { handle: handles },
  })
  const taken = new Set(existing.map((p) => p.handle))
  const nuevos = SERVICES.filter((s) => !taken.has(CAM_PRODUCT_HANDLES[s.key]))

  if (!nuevos.length) {
    logger.info("Los productos de servicio CAM ya existen.")
  } else if (dry) {
    logger.info(`[prueba] Se crearían: ${nuevos.map((s) => CAM_PRODUCT_HANDLES[s.key]).join(", ")}`)
  } else {
    // Se usa el flujo de Medusa (no el de Mercur) porque el de Mercur sólo
    // admite variantes por atributos del catálogo, y aquí el nivel (Básica /
    // Media / Alta) es una opción propia del servicio.
    const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })
    const { result: creados } = await createProductsWorkflow(container).run({
      input: {
        products: nuevos.map((s) => {
          const h = CAM_PRODUCT_HANDLES[s.key]
          const title = optionTitle(s)
          return {
            title: s.title,
            subtitle: s.subtitle,
            description: s.description,
            handle: h,
            status: "published" as const,
            discountable: true,
            shipping_profile_id: perfil.id,
            tag_ids: tag ? [tag.id] : [],
            sales_channels: canales.map((c) => ({ id: c.id })),
            metadata: { hetna_cam_service: s.key, producto_servicio: true },
            options: [{ title, values: optionValues(s) }],
            variants: optionValues(s).map((value, i) => ({
              title: value,
              sku: `${h.toUpperCase()}-${i + 1}`,
              manage_inventory: false,
              options: { [title]: value },
              prices: [],
            })),
          }
        }),
      },
    })
    // La tienda HETNA queda autorizada para vender estos productos (Mercur).
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    await link.create(
      creados.map((p) => ({
        [Modules.PRODUCT]: { product_id: p.id },
        [MercurModules.SELLER]: { seller_id: seller.id },
      }))
    )
    logger.info(`Productos creados: ${nuevos.map((s) => CAM_PRODUCT_HANDLES[s.key]).join(", ")}`)
  }

  // ---- Ofertas de la tienda HETNA (una por nivel) ----------------------------
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku", "variants.options.value"],
    filters: { handle: handles },
  })
  const variantIds = products.flatMap((p) => (p.variants ?? []).map((v) => v!.id))
  const { data: offers } = variantIds.length
    ? await query.graph({
        entity: "offer",
        fields: ["id", "variant_id", "seller_id"],
        filters: { variant_id: variantIds },
      })
    : { data: [] as { id: string; variant_id: string; seller_id: string }[] }
  const conOferta = new Set(
    (offers as { variant_id: string; seller_id: string }[])
      .filter((o) => o.seller_id === seller.id)
      .map((o) => o.variant_id)
  )

  const nuevasOfertas: CreateOfferDTO[] = []
  for (const p of products) {
    const s = SERVICES.find((x) => CAM_PRODUCT_HANDLES[x.key] === p.handle)
    if (!s) {
      continue
    }
    const values = optionValues(s)
    for (const v of p.variants ?? []) {
      if (!v || conOferta.has(v.id)) {
        continue
      }
      const valor = (v.options ?? []).map((o) => o?.value).find((x) => x && values.includes(x))
      const nivel = Math.max(0, values.indexOf(valor ?? values[0]))
      const sku = `HETNA-${v.sku || `${p.handle}-${nivel + 1}`}`.toUpperCase()
      nuevasOfertas.push({
        seller_id: seller.id,
        created_by: memberId,
        sku,
        variant_id: v.id,
        shipping_profile_id: perfil.id,
        // Es un servicio: no se descuenta inventario, pero Mercur pide un registro.
        manage_inventory: false,
        allow_backorder: true,
        inventory_items: [{ sku, stock_levels: [{ location_id: locationId, stocked_quantity: 1000000 }] }],
        prices: priceFor(s.key, nivel),
      } as CreateOfferDTO)
    }
  }

  if (!nuevasOfertas.length) {
    logger.info("Las ofertas de HETNA para los servicios CAM ya existen.")
  } else if (dry) {
    logger.info(`[prueba] Se crearían ${nuevasOfertas.length} ofertas (${nuevasOfertas.map((o) => o.sku).join(", ")})`)
  } else {
    await createOffersWorkflow(container).run({ input: { offers: nuevasOfertas } })
    logger.info(`Ofertas creadas: ${nuevasOfertas.length} (${currencies.join(", ").toUpperCase()})`)
  }

  // ---- "Entrega digital" en la tienda de HETNA ------------------------------
  if (!dry) {
    const creadas = await aprovisionarEnvios(container, {
      sellerId: seller.id,
      log: (m: string) => logger.info(`[envios-auto] ${m}`),
    })
    if (creadas) {
      logger.info(`Opciones de envío creadas en la tienda: ${creadas}`)
    }
  }

  logger.info("Listo. Revisa los precios en el panel y abre https://hetnacnc.com/mx/cam/lab")
}
