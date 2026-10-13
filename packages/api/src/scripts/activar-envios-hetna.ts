// @ts-nocheck
// Activa "Envíos HETNA" (Skydropx) para las ubicaciones de un taller.
// Uso: [DRY_RUN=1] [SELLER_ID=sel_...] bunx medusa exec ./src/scripts/activar-envios-hetna.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createSellerShippingOptionsWorkflow } from "@mercurjs/core/workflows"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

const PROVEEDOR = "skydropx_envios-hetna"

export default async function activarEnvios({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const log = (m: string) => console.log("[envios-hetna] " + m)
  const dry = process.env.DRY_RUN === "1"
  const sellerId = process.env.SELLER_ID

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "stock_locations.id", "stock_locations.name", "stock_locations.address.*"],
  })

  if (!sellerId) {
    for (const s of sellers) {
      log(`${s.id} | ${s.name} | ubicaciones: ${JSON.stringify((s.stock_locations || []).map((l) => `${l.id} ${l.name} CP:${l.address?.postal_code}`))}`)
    }
    return
  }

  const seller = sellers.find((s) => s.id === sellerId)
  if (!seller) throw new Error("Vendedor no encontrado: " + sellerId)
  const ubicaciones = seller.stock_locations || []
  if (!ubicaciones.length) throw new Error(`${seller.name} aun no tiene ubicacion. Debe capturarla en /seller primero.`)

  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = perfiles.find((p) => p.name === "Marketplace Shipping") || perfiles[0]
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id", "name"] })
  if (!perfil || !canales[0]) throw new Error("Falta perfil de envio o canal de ventas")

  for (const loc of ubicaciones) {
    const cp = loc.address?.postal_code
    log(`Ubicacion ${loc.id} (${loc.name}) CP=${cp || "SIN CP"}`)
    if (!cp) { log("  OMITIDA: la ubicacion no tiene codigo postal"); continue }

    const { data: [det] } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id", "fulfillment_sets.type", "fulfillment_sets.service_zones.id"],
      filters: { id: loc.id },
    })
    let fsId = det?.fulfillment_sets?.find((f) => f.type === "shipping")?.id
    let zoneId = det?.fulfillment_sets?.flatMap((f) => f.service_zones || [])[0]?.id
    log(`  conjunto=${fsId || "(crear)"} zona=${zoneId || "(crear)"}`)
    if (dry) { log("  DRY_RUN: crearia proveedor, canal, conjunto/zona (si faltan) y la opcion Envios HETNA"); continue }

    try { await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: loc.id }, [Modules.FULFILLMENT]: { fulfillment_provider_id: PROVEEDOR } }) } catch (e) { log("  proveedor ya ligado") }
    try { await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: loc.id, add: [canales[0].id] } }) } catch (e) { log("  canal ya ligado") }

    if (!fsId) {
      await createLocationFulfillmentSetWorkflow(container).run({ input: { location_id: loc.id, fulfillment_set_data: { name: `${seller.name} envios`, type: "shipping" } } })
      const { data: [d2] } = await query.graph({ entity: "stock_location", fields: ["fulfillment_sets.id"], filters: { id: loc.id } })
      fsId = d2.fulfillment_sets[0].id
    }
    if (!zoneId) {
      const { result } = await createServiceZonesWorkflow(container).run({
        input: { data: [{ fulfillment_set_id: fsId, name: `${seller.name} Mexico`, geo_zones: [{ country_code: "mx", type: "country" }] }] },
      })
      zoneId = result[0].id
    }
    const { data: ya } = await query.graph({ entity: "shipping_option", fields: ["id"], filters: { name: "Envíos HETNA", service_zone_id: zoneId } })
    if (ya.length) { log("  ya existe la opcion Envios HETNA, nada que hacer"); continue }

    await createSellerShippingOptionsWorkflow(container).run({
      input: {
        seller_id: seller.id,
        shipping_options: [{
          name: "Envíos HETNA",
          price_type: "calculated",
          provider_id: PROVEEDOR,
          service_zone_id: zoneId,
          shipping_profile_id: perfil.id,
          data: { id: "envios-hetna" },
          type: { label: "Envíos HETNA", description: "Cotizado al momento con paqueterías.", code: "envios-hetna" },
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        }],
      },
    })
    log("  CREADA la opcion Envios HETNA")
  }
}
