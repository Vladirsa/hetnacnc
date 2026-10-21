// @ts-nocheck
// "Envío gratis a partir de $X" de cada taller.
//
// Importante para no buscarlo en el lugar equivocado: esto NO es una promoción
// de Medusa. El taller lo captura en su pantalla de Envíos (/vendor/hetna-envios)
// y se guarda como un PRECIO de su opción de envío estándar: un precio de $0 con
// una regla `item_total >= X`. El módulo de precios de Medusa calcula el precio
// del envío con el contexto del carrito -- y `item_total` viene en ese contexto
// (`fieldsForPricingContext`) --, así que el envío cuesta cero en automático
// cuando el carrito pasa el monto. No hay promoción, ni código, ni nada que
// aplicar: es el precio del envío.
//
// Dos consecuencias que hay que respetar al enseñarlo:
//
//  1. `item_total` es del CARRITO COMPLETO, no de lo que el cliente lleva de ese
//     taller. Si un taller pone "gratis desde $800" y el cliente lleva $500 de
//     ese taller y $400 de otro, ese taller se lo manda gratis. Medir el avance
//     por taller pediría más de lo que el backend va a pedir.
//
//  2. El umbral es por opción de envío. Un taller con varias opciones puede
//     tener varias; se devuelve el umbral más bajo, que es el que el cliente
//     alcanza primero y el único que le sirve saber.
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { obtenerPerfilDigital } from "./envios-automaticos"

const NOMBRE_RECOGER = "Recoger en taller"
const NOMBRE_DIGITAL = "Entrega digital"

// Precio base y "gratis desde" de una opción de envío. Si no se puede leer,
// devuelve nulls: la pantalla del taller y la barra del carrito tienen que
// seguir funcionando sin esto.
export async function leerPreciosDeOpcion(container, optionId) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: links } = await query.graph({
      entity: "shipping_option_price_set",
      fields: ["shipping_option_id", "price_set_id"],
      filters: { shipping_option_id: optionId },
    })
    if (!links.length) return { precio: null, gratis_desde: null }

    const pricing = container.resolve(Modules.PRICING)
    const sets = await pricing.listPriceSets(
      { id: [links[0].price_set_id] },
      { relations: ["prices", "prices.price_rules"] }
    )
    const precios = (sets[0]?.prices || []).filter(
      (p) => String(p.currency_code).toLowerCase() === "mxn"
    )
    const base = precios.find((p) => !(p.price_rules || []).length)
    const gratis = precios.find((p) =>
      (p.price_rules || []).some((r) => r.attribute === "item_total")
    )
    const regla = gratis?.price_rules?.find((r) => r.attribute === "item_total")

    return {
      precio: base ? Number(base.amount) : null,
      gratis_desde:
        gratis && Number(gratis.amount) === 0 && regla ? Number(regla.value) : null,
    }
  } catch {
    return { precio: null, gratis_desde: null }
  }
}

// Las opciones de envío físico de varios talleres, de un jalón.
//
// Se resuelve taller -> ubicaciones -> conjuntos -> zonas -> opciones, igual que
// la pantalla de Envíos, pero para un puñado de talleres a la vez: esto se pide
// desde el carrito y ahí una consulta por taller se nota.
async function opcionesFisicasPorTaller(container, sellerIds) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: talleres } = await query.graph({
    entity: "seller",
    fields: ["id", "stock_locations.id"],
    filters: { id: sellerIds },
  })

  // zona -> taller, para poder devolverle a cada taller sus opciones.
  const tallerDeZona = new Map()
  const locIds = []
  const tallerDeUbicacion = new Map()

  for (const taller of talleres || []) {
    for (const loc of taller.stock_locations || []) {
      if (!loc?.id) continue
      locIds.push(loc.id)
      tallerDeUbicacion.set(loc.id, taller.id)
    }
  }
  if (!locIds.length) return new Map()

  const { data: ubicaciones } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.service_zones.id"],
    filters: { id: locIds },
  })

  for (const ubi of ubicaciones || []) {
    const tallerId = tallerDeUbicacion.get(ubi.id)
    if (!tallerId) continue
    for (const conjunto of ubi.fulfillment_sets || []) {
      for (const zona of conjunto.service_zones || []) {
        if (zona?.id) tallerDeZona.set(zona.id, tallerId)
      }
    }
  }
  if (!tallerDeZona.size) return new Map()

  const perfilDigital = await obtenerPerfilDigital(container)

  const { data: opciones } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "shipping_profile_id", "service_zone_id"],
    filters: { service_zone_id: [...tallerDeZona.keys()] },
  })

  const porTaller = new Map()
  for (const opcion of opciones || []) {
    const tallerId = tallerDeZona.get(opcion.service_zone_id)
    if (!tallerId) continue
    // Recoger en taller y la entrega digital nunca cuestan: un umbral sobre
    // ellas no significa nada.
    if (opcion.name === NOMBRE_RECOGER || opcion.name === NOMBRE_DIGITAL) continue
    if (perfilDigital?.id && opcion.shipping_profile_id === perfilDigital.id) continue

    if (!porTaller.has(tallerId)) porTaller.set(tallerId, [])
    porTaller.get(tallerId).push(opcion)
  }
  return porTaller
}

export type UmbralDeTaller = {
  // Monto del carrito a partir del cual este taller manda gratis.
  gratis_desde: number
  // Lo que cuesta su envío mientras no se alcanza. null si no se pudo leer.
  precio: number | null
}

// Para cada taller que lo tenga puesto, su umbral de envío gratis.
// Los talleres que no lo tengan simplemente no vienen en el mapa.
export async function umbralesDeEnvioGratis(
  container,
  sellerIds: string[]
): Promise<Record<string, UmbralDeTaller>> {
  if (!sellerIds.length) return {}

  const porTaller = await opcionesFisicasPorTaller(container, sellerIds)
  if (!porTaller.size) return {}

  const resultado: Record<string, UmbralDeTaller> = {}

  await Promise.all(
    [...porTaller.entries()].map(async ([tallerId, opciones]) => {
      const precios = await Promise.all(
        opciones.map((o) => leerPreciosDeOpcion(container, o.id))
      )
      for (const p of precios) {
        if (!(p.gratis_desde > 0)) continue
        const previo = resultado[tallerId]
        if (!previo || p.gratis_desde < previo.gratis_desde) {
          resultado[tallerId] = { gratis_desde: p.gratis_desde, precio: p.precio }
        }
      }
    })
  )

  return resultado
}
