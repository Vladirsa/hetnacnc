// @ts-nocheck
// Pantalla simple de "Envíos" del taller (/seller > Envíos).
//   GET  -> estado actual: precio del envío estándar, envío gratis desde, recoger en taller.
//   POST -> { precio, gratis_desde (número o null), recoger (true/false) }
// El taller NO ve proveedores, zonas ni perfiles: aquí se traduce todo a 3 datos simples.
// Si por alguna razón aún no tiene sus envíos listos, se preparan en ese momento.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createSellerShippingOptionsWorkflow } from "@mercurjs/core/workflows"
import { deleteShippingOptionsWorkflow, updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

import { aprovisionarEnvios, obtenerPerfilDigital } from "../../../lib/envios-automaticos"
import { leerPreciosDeOpcion } from "../../../lib/envio-gratis"

const PROVEEDOR = "manual_manual"
const NOMBRE_RECOGER = "Recoger en taller"
const NOMBRE_DIGITAL = "Entrega digital"

// Opciones de envío del taller (en las zonas de sus ubicaciones), ya clasificadas
async function cargarOpciones(container, sellerId) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [seller] } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "stock_locations.id"],
    filters: { id: sellerId },
  })
  const locIds = (seller?.stock_locations || []).map((l) => l.id)
  const zonas = []
  if (locIds.length) {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.service_zones.id"],
      filters: { id: locIds },
    })
    for (const l of locs) {
      for (const fs of l.fulfillment_sets || []) for (const z of fs.service_zones || []) zonas.push(z.id)
    }
  }
  if (!zonas.length) return { seller, zonas, estandar: null, recoger: null, digital: null }

  const digitalPerfil = await obtenerPerfilDigital(container)
  const { data: opciones } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "shipping_profile_id", "service_zone_id"],
    filters: { service_zone_id: zonas },
  })
  const estandar = opciones.find(
    (o) => o.shipping_profile_id !== digitalPerfil.id && o.name !== NOMBRE_RECOGER
  )
  const recoger = opciones.find((o) => o.name === NOMBRE_RECOGER)
  const digital = opciones.find((o) => o.shipping_profile_id === digitalPerfil.id || o.name === NOMBRE_DIGITAL)
  return { seller, zonas, estandar, recoger, digital }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const { zonas, estandar, recoger, digital } = await cargarOpciones(req.scope, sellerId)
  if (!zonas.length) {
    return res.json({
      listo: false,
      mensaje: "Primero captura la dirección de tu taller. En unos minutos tus envíos quedan listos solos.",
    })
  }
  const precios = estandar
    ? await leerPreciosDeOpcion(req.scope, estandar.id)
    : { precio: null, gratis_desde: null }
  return res.json({
    listo: !!estandar,
    precio: precios.precio,
    gratis_desde: precios.gratis_desde,
    recoger: !!recoger,
    digital: !!digital,
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const body = (req.body || {}) as { precio?: unknown; gratis_desde?: unknown; recoger?: unknown }
  const precio = Number(body.precio)
  if (!Number.isFinite(precio) || precio < 0 || precio > 20000) {
    return res.status(400).json({ message: "El precio de envío debe ser un número entre 0 y 20,000." })
  }
  let gratisDesde = null
  if (body.gratis_desde !== null && body.gratis_desde !== undefined && body.gratis_desde !== "") {
    gratisDesde = Number(body.gratis_desde)
    if (!Number.isFinite(gratisDesde) || gratisDesde <= 0 || gratisDesde > 10000000) {
      return res.status(400).json({ message: "El monto para envío gratis debe ser mayor a 0." })
    }
  }
  const quiereRecoger = body.recoger === true

  try {
    let estado = await cargarOpciones(req.scope, sellerId)
    if (!estado.zonas.length) {
      return res.status(400).json({ message: "Primero captura la dirección de tu taller." })
    }
    if (!estado.estandar) {
      await aprovisionarEnvios(req.scope, { sellerId })
      estado = await cargarOpciones(req.scope, sellerId)
    }
    if (!estado.estandar) {
      return res.status(409).json({ message: "Tus envíos aún no están listos. Intenta de nuevo en unos minutos." })
    }

    // 1) Precio y envío gratis desde cierto monto del pedido
    const precios = [{ currency_code: "mxn", amount: precio }]
    if (gratisDesde !== null) {
      precios.push({
        currency_code: "mxn",
        amount: 0,
        rules: [{ attribute: "item_total", operator: "gte", value: gratisDesde }],
      })
    }
    await updateShippingOptionsWorkflow(req.scope).run({
      input: [{ id: estado.estandar.id, prices: precios }],
    })

    // 2) Recoger en taller
    if (quiereRecoger && !estado.recoger) {
      await createSellerShippingOptionsWorkflow(req.scope).run({
        input: {
          seller_id: sellerId,
          shipping_options: [{
            name: NOMBRE_RECOGER,
            price_type: "flat",
            provider_id: PROVEEDOR,
            service_zone_id: estado.estandar.service_zone_id,
            shipping_profile_id: estado.estandar.shipping_profile_id,
            type: { label: NOMBRE_RECOGER, description: "Pasas por tu pedido al taller. Sin costo de envío.", code: "recoger-en-taller" },
            prices: [{ currency_code: "mxn", amount: 0 }],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          }],
        },
      })
    } else if (!quiereRecoger && estado.recoger) {
      await deleteShippingOptionsWorkflow(req.scope).run({ input: { ids: [estado.recoger.id] } })
    }

    return res.json({ ok: true })
  } catch (e) {
    const logger = req.scope.resolve("logger")
    logger.error(`[envios-taller] no se pudo guardar para ${sellerId}: ${e?.message || e}`)
    return res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo; si sigue igual, escríbenos." })
  }
}
