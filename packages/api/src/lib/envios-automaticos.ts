// @ts-nocheck
// Envíos automáticos para los talleres y productos digitales sin costo de envío.
//
// Qué hace:
//  1. Para cada ubicación (almacén) de cada taller deja listo, SOLO si falta:
//       - el proveedor de envío Manual (y Skydropx, si está activo),
//       - el canal de ventas,
//       - el conjunto de envíos y la zona México,
//       - con Skydropx activo: "Envío económico" y "Envío express" (precio calculado con el
//         peso y las medidas reales del producto, paquetería real),
//       - sin Skydropx: "Envío estándar" (precio fijo inicial, por defecto $150 MXN),
//       - la opción "Entrega digital" ($0) para productos digitales.
//     Si el taller ya tiene alguna opción propia de envío físico, NO la cambia ni la borra.
//     Si el taller borra una opción de otro tipo, no se la vuelve a poner.
//  2. Ajusta el "perfil de envío" de un producto: los productos de Tipo "Digital" (o con la
//     etiqueta "digital") usan el perfil "Producto digital"; los demás, el perfil normal.
//
// Es seguro correrlo muchas veces: lo que ya existe no se duplica.
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createSellerShippingOptionsWorkflow } from "@mercurjs/core/workflows"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const PROVEEDOR = "manual_manual"
const PERFIL_FISICO = "Marketplace Shipping"
const PERFIL_DIGITAL = "Producto digital"
const OPCION_FISICA = "Envío estándar"
const OPCION_DIGITAL = "Entrega digital"
const OPCION_ECONOMICA = "Envío económico"
const OPCION_EXPRESS = "Envío express"

export const precioInicial = () => {
  const n = Number(process.env.ENVIO_PRECIO_INICIAL ?? 150)
  return n >= 0 ? n : 150
}

// Perfil de envío "Producto digital": se crea solo la primera vez
export async function obtenerPerfilDigital(container) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const existente = perfiles.find((p) => p.name === PERFIL_DIGITAL)
  if (existente) return existente
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const creado = await fulfillment.createShippingProfiles({ name: PERFIL_DIGITAL, type: "digital" })
  return Array.isArray(creado) ? creado[0] : creado
}

async function perfilFisico(container) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  return perfiles.find((p) => p.name === PERFIL_FISICO) || perfiles.find((p) => p.name !== PERFIL_DIGITAL)
}

// Busca el proveedor Skydropx registrado (su id es algo como "skydropx_envios-hetna").
// Devuelve null si no está activo (por ejemplo, si faltan las llaves).
async function proveedorSkydropx(container) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data } = await query.graph({ entity: "fulfillment_provider", fields: ["id"] })
    return data.find((p) => String(p.id).startsWith("skydropx_"))?.id || null
  } catch (e) {
    return null
  }
}

const reglasTienda = [
  { attribute: "enabled_in_store", value: "true", operator: "eq" },
  { attribute: "is_return", value: "false", operator: "eq" },
]

const opcionBase = (perfilId, zoneId, nombre, codigo, descripcion, monto) => ({
  name: nombre,
  price_type: "flat",
  provider_id: PROVEEDOR,
  service_zone_id: zoneId,
  shipping_profile_id: perfilId,
  type: { label: nombre, description: descripcion, code: codigo },
  prices: [{ currency_code: "mxn", amount: monto }],
  rules: reglasTienda,
})

// Opción con precio calculado por Skydropx (no lleva precio fijo)
const opcionCalculada = (proveedorId, perfilId, zoneId, nombre, codigo, descripcion, opcionId) => ({
  name: nombre,
  price_type: "calculated",
  provider_id: proveedorId,
  service_zone_id: zoneId,
  shipping_profile_id: perfilId,
  type: { label: nombre, description: descripcion, code: codigo },
  data: { id: opcionId },
  rules: reglasTienda,
})

// Deja listos los envíos de todos los talleres (o de uno). Devuelve cuántas cosas creó.
export async function aprovisionarEnvios(container, { sellerId, dry = false, log = () => {} } = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const precio = precioInicial()
  let creadas = 0

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "stock_locations.id", "stock_locations.name"],
    ...(sellerId ? { filters: { id: sellerId } } : {}),
  })
  const conUbicacion = sellers.filter((s) => (s.stock_locations || []).length)
  if (!conUbicacion.length) return 0

  const fisico = await perfilFisico(container)
  const digital = await obtenerPerfilDigital(container)
  const sky = await proveedorSkydropx(container)
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  if (!fisico || !digital || !canales[0]) {
    log("Falta el perfil de envío o el canal de ventas; no se hizo nada")
    return 0
  }

  // Una sola consulta para saber qué ya existe
  const { data: opciones } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "service_zone_id", "shipping_profile_id"],
  })

  for (const seller of conUbicacion) {
    for (const loc of seller.stock_locations) {
      try {
        const { data: [det] } = await query.graph({
          entity: "stock_location",
          fields: ["id", "fulfillment_sets.id", "fulfillment_sets.type", "fulfillment_sets.service_zones.id"],
          filters: { id: loc.id },
        })
        let fsId = det?.fulfillment_sets?.find((f) => f.type === "shipping")?.id
        let zoneId = det?.fulfillment_sets?.flatMap((f) => f.service_zones || [])[0]?.id

        const enZona = (o) => zoneId && o.service_zone_id === zoneId
        // Con Skydropx activo el envío físico son las dos opciones calculadas; el precio fijo ya no se crea
        const hayFisica = sky
          ? true
          : opciones.some((o) => enZona(o) && o.shipping_profile_id === fisico.id)
        const hayEco = sky ? opciones.some((o) => enZona(o) && o.provider_id === sky && o.name === OPCION_ECONOMICA) : true
        const hayExp = sky ? opciones.some((o) => enZona(o) && o.provider_id === sky && o.name === OPCION_EXPRESS) : true
        const hayDigital = opciones.some((o) => enZona(o) && o.shipping_profile_id === digital.id)
        if (hayFisica && hayEco && hayExp && hayDigital) continue

        const faltan = [
          hayFisica ? "" : OPCION_FISICA,
          hayEco ? "" : OPCION_ECONOMICA,
          hayExp ? "" : OPCION_EXPRESS,
          hayDigital ? "" : OPCION_DIGITAL,
        ].filter(Boolean)
        log(`${seller.name} / ${loc.name}: falta ${faltan.join(", ")}`)
        if (dry) continue

        for (const proveedor of [PROVEEDOR, ...(sky ? [sky] : [])]) {
          try {
            await link.create({
              [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
              [Modules.FULFILLMENT]: { fulfillment_provider_id: proveedor },
            })
          } catch (e) {
            // ya estaba activado
          }
        }
        try {
          await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: loc.id, add: [canales[0].id] } })
        } catch (e) {
          // ya estaba ligado
        }

        if (!fsId) {
          await createLocationFulfillmentSetWorkflow(container).run({
            input: { location_id: loc.id, fulfillment_set_data: { name: `${seller.name} envios`, type: "shipping" } },
          })
          const { data: [d2] } = await query.graph({ entity: "stock_location", fields: ["fulfillment_sets.id"], filters: { id: loc.id } })
          fsId = d2.fulfillment_sets[0].id
        }
        if (!zoneId) {
          const { result } = await createServiceZonesWorkflow(container).run({
            input: { data: [{ fulfillment_set_id: fsId, name: `${seller.name} Mexico`, geo_zones: [{ country_code: "mx", type: "country" }] }] },
          })
          zoneId = result[0].id
        }

        const nuevas = []
        if (!hayFisica) {
          nuevas.push(opcionBase(fisico.id, zoneId, OPCION_FISICA, "envio-estandar", "Envío con precio fijo definido por el taller.", precio))
        }
        if (!hayEco) {
          nuevas.push(opcionCalculada(sky, fisico.id, zoneId, OPCION_ECONOMICA, "envio-economico", "La paquetería más barata para tu código postal.", "envios-hetna"))
        }
        if (!hayExp) {
          nuevas.push(opcionCalculada(sky, fisico.id, zoneId, OPCION_EXPRESS, "envio-express", "La paquetería más rápida para tu código postal.", "envios-hetna-express"))
        }
        if (!hayDigital) {
          nuevas.push(opcionBase(digital.id, zoneId, OPCION_DIGITAL, "entrega-digital", "Producto digital: se entrega por correo o descarga, sin costo de envío.", 0))
        }

        await createSellerShippingOptionsWorkflow(container).run({
          input: { seller_id: seller.id, shipping_options: nuevas },
        })
        creadas += nuevas.length
        // Para que la siguiente vuelta del ciclo sepa que ya existen
        for (const n of nuevas) {
          opciones.push({ id: "nueva", name: n.name, provider_id: n.provider_id, service_zone_id: zoneId, shipping_profile_id: n.shipping_profile_id })
        }
        log(`  CREADAS: ${nuevas.map((n) => n.name).join(", ")}`)
      } catch (e) {
        log(`  ERROR en ${seller.name} / ${loc.name}: ${e?.message || e}`)
      }
    }
  }
  return creadas
}

const TIPOS_DIGITALES = ["digital", "producto digital", "productos digitales"]

export function esProductoDigital(producto) {
  const tipo = String(producto?.type?.value || "").trim().toLowerCase()
  if (TIPOS_DIGITALES.includes(tipo)) return true
  return (producto?.tags || []).some((t) => String(t?.value || "").trim().toLowerCase() === "digital")
}

// Pone el perfil de envío correcto a un producto. Devuelve "digital", "fisico" o null si no cambió nada.
export async function ajustarPerfilDeProducto(container, productId, { dry = false } = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [p] } = await query.graph({
    entity: "product",
    fields: ["id", "title", "type.value", "tags.value", "shipping_profile.id"],
    filters: { id: productId },
  })
  if (!p) return null

  const digital = await obtenerPerfilDigital(container)
  const fisico = await perfilFisico(container)
  const actual = p.shipping_profile?.id
  const debeSerDigital = esProductoDigital(p)
  const destino = debeSerDigital ? digital : fisico
  if (!destino || actual === destino.id) return null

  if (!dry) {
    await updateProductsWorkflow(container).run({
      input: { selector: { id: p.id }, update: { shipping_profile_id: destino.id } },
    })
  }
  return debeSerDigital ? "digital" : "fisico"
}
