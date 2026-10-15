// @ts-nocheck
// Deja listo el envío "Envío estándar" (precio fijo, proveedor Manual) de un taller,
// sin que el taller tenga que configurar nada técnico.
//
// Hace, para cada ubicación (almacén) del taller y solo si falta:
//   1. Activa el proveedor de envío Manual en la ubicación.
//   2. Liga la ubicación al canal de ventas.
//   3. Crea el conjunto de envíos y la zona de servicio México.
//   4. Crea la opción "Envío estándar" con precio fijo en pesos.
//
// Es seguro correrlo varias veces: lo que ya existe no se duplica.
//
// Uso (en /root/hetnacnc/packages/api):
//   Ver talleres:   NODE_ENV=production bunx medusa exec ./src/scripts/activar-envio-fijo.ts
//   Probar sin cambiar nada:  DRY_RUN=1 SELLER_ID=sel_xxx NODE_ENV=production bunx medusa exec ./src/scripts/activar-envio-fijo.ts
//   Aplicar a un taller:      SELLER_ID=sel_xxx PRECIO=150 NODE_ENV=production bunx medusa exec ./src/scripts/activar-envio-fijo.ts
//   Aplicar a TODOS:          TODOS=1 PRECIO=150 NODE_ENV=production bunx medusa exec ./src/scripts/activar-envio-fijo.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createSellerShippingOptionsWorkflow } from "@mercurjs/core/workflows"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

const PROVEEDOR = "manual_manual"
const NOMBRE_OPCION = "Envío estándar"

export default async function activarEnvioFijo({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const log = (m: string) => console.log("[envio-fijo] " + m)
  const dry = process.env.DRY_RUN === "1"
  const sellerId = process.env.SELLER_ID
  const todos = process.env.TODOS === "1"
  const precio = Number(process.env.PRECIO || 150)
  if (!(precio >= 0)) throw new Error("PRECIO debe ser un número, por ejemplo PRECIO=150")

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "stock_locations.id", "stock_locations.name"],
  })

  // Sin SELLER_ID ni TODOS: solo muestra la lista de talleres.
  if (!sellerId && !todos) {
    log("Talleres encontrados (usa SELLER_ID=<id> o TODOS=1 para aplicar):")
    for (const s of sellers) {
      log(`${s.id} | ${s.name} | ubicaciones: ${(s.stock_locations || []).length}`)
    }
    return
  }

  const objetivo = todos ? sellers : sellers.filter((s) => s.id === sellerId)
  if (!objetivo.length) throw new Error("Taller no encontrado: " + sellerId)

  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = perfiles.find((p) => p.name === "Marketplace Shipping") || perfiles[0]
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id", "name"] })
  if (!perfil || !canales[0]) throw new Error("Falta el perfil de envío o el canal de ventas")

  for (const seller of objetivo) {
    const ubicaciones = seller.stock_locations || []
    log(`== ${seller.name} (${seller.id}) ==`)
    if (!ubicaciones.length) {
      log("  OMITIDO: aún no tiene ubicación. Debe capturar su dirección en /seller primero.")
      continue
    }

    for (const loc of ubicaciones) {
      log(`Ubicación ${loc.id} (${loc.name})`)

      const { data: [det] } = await query.graph({
        entity: "stock_location",
        fields: ["id", "fulfillment_sets.id", "fulfillment_sets.type", "fulfillment_sets.service_zones.id"],
        filters: { id: loc.id },
      })
      let fsId = det?.fulfillment_sets?.find((f) => f.type === "shipping")?.id
      let zoneId = det?.fulfillment_sets?.flatMap((f) => f.service_zones || [])[0]?.id
      log(`  conjunto=${fsId || "(crear)"} zona=${zoneId || "(crear)"}`)
      if (dry) {
        log(`  DRY_RUN: activaría proveedor Manual, canal, conjunto/zona (si faltan) y '${NOMBRE_OPCION}' a $${precio} MXN`)
        continue
      }

      try {
        await link.create({
          [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: PROVEEDOR },
        })
        log("  proveedor Manual activado")
      } catch (e) {
        log("  proveedor Manual ya estaba activado")
      }
      try {
        await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: loc.id, add: [canales[0].id] } })
      } catch (e) {
        log("  canal ya ligado")
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

      const { data: ya } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: NOMBRE_OPCION, service_zone_id: zoneId },
      })
      if (ya.length) {
        log(`  ya existe '${NOMBRE_OPCION}' en esta zona, nada que hacer (si no tiene precio, edítalo en el panel)`)
        continue
      }

      await createSellerShippingOptionsWorkflow(container).run({
        input: {
          seller_id: seller.id,
          shipping_options: [{
            name: NOMBRE_OPCION,
            price_type: "flat",
            provider_id: PROVEEDOR,
            service_zone_id: zoneId,
            shipping_profile_id: perfil.id,
            type: { label: NOMBRE_OPCION, description: "Envío con precio fijo definido por el taller.", code: "envio-estandar" },
            prices: [{ currency_code: "mxn", amount: precio }],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          }],
        },
      })
      log(`  CREADA la opción '${NOMBRE_OPCION}' a $${precio} MXN`)
    }
  }
}
