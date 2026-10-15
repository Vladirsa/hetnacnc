// @ts-nocheck
// Ver y poner existencias (inventario) de las OFERTAS de un taller, sin entrar al panel.
// Mercur revisa el inventario ligado a cada oferta (no el de la variante) antes de dejar
// agregar al carrito. Si una oferta no tiene piezas en una ubicación ligada al canal de
// ventas, sale el error "insufficient stock".
//
// Uso (en /root/hetnacnc/packages/api):
//   1) Ver ofertas y sus existencias (no cambia nada):
//        NODE_ENV=production bunx medusa exec ./src/scripts/poner-existencias.ts
//   2) Poner existencias a UNA oferta:
//        OFERTA=offer_xxx UBICACION=sloc_xxx CANTIDAD=10 NODE_ENV=production bunx medusa exec ./src/scripts/poner-existencias.ts
//   Agrega DRY_RUN=1 para probar sin cambiar nada.
//
// Es seguro correrlo varias veces: si el nivel ya existe lo actualiza, si no, lo crea.
// También liga la ubicación al canal de ventas si le falta.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkSalesChannelsToStockLocationWorkflow } from "@medusajs/medusa/core-flows"

export default async function ponerExistencias({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventario = container.resolve(Modules.INVENTORY)
  const log = (m: string) => console.log("[existencias] " + m)
  const dry = process.env.DRY_RUN === "1"
  const ofertaId = (process.env.OFERTA || "").trim()
  const ubicacion = (process.env.UBICACION || "").trim()
  const cantidad = Number(process.env.CANTIDAD || 10)

  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: [
      "id", "seller_id", "sku", "product_id", "variant_id",
      "manage_inventory", "allow_backorder",
      "inventory_item_link.required_quantity",
      "inventory_item_link.inventory_item.id",
      "inventory_item_link.inventory_item.location_levels.location_id",
      "inventory_item_link.inventory_item.location_levels.stocked_quantity",
      "inventory_item_link.inventory_item.location_levels.reserved_quantity",
    ],
    filters: ofertaId ? { id: ofertaId } : {},
  })

  // Modo lista
  if (!ofertaId) {
    log("Ofertas (usa OFERTA=<id> UBICACION=<sloc_...> CANTIDAD=<n> para poner existencias):")
    if (!ofertas.length) log("(no hay ofertas)")
    for (const o of ofertas) {
      const enlaces = o.inventory_item_link || []
      if (!enlaces.length) {
        log(`${o.id} | taller ${o.seller_id} | sku ${o.sku} | SIN inventario ligado (manage_inventory=${o.manage_inventory}, backorder=${o.allow_backorder})`)
        continue
      }
      for (const e of enlaces) {
        const it = e.inventory_item
        const niveles = (it?.location_levels || [])
          .map((n) => `${n.location_id}: ${n.stocked_quantity} (reservadas ${n.reserved_quantity})`)
          .join(" ; ") || "sin ubicaciones"
        log(`${o.id} | taller ${o.seller_id} | sku ${o.sku} | artículo ${it?.id} | manage_inventory=${o.manage_inventory} backorder=${o.allow_backorder} | ${niveles}`)
      }
    }
    return
  }

  if (!ofertas.length) throw new Error("No existe la oferta: " + ofertaId)
  if (!ubicacion.startsWith("sloc_")) throw new Error("Falta UBICACION=sloc_... (la ubicación del taller)")
  if (!(cantidad >= 0)) throw new Error("CANTIDAD debe ser un número, por ejemplo CANTIDAD=10")

  const oferta = ofertas[0]
  const enlaces = oferta.inventory_item_link || []
  if (!enlaces.length) {
    throw new Error(`La oferta ${oferta.id} no tiene inventario ligado; hay que crearlo primero (avísame y lo agrego al script).`)
  }

  // La ubicación debe estar ligada al canal de ventas, o Mercur no la cuenta
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id", "name"] })
  if (!dry && canales[0]) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: ubicacion, add: [canales[0].id] } })
      log("ubicación ligada al canal de ventas")
    } catch (e) {
      log("la ubicación ya estaba ligada al canal de ventas")
    }
  }

  for (const e of enlaces) {
    const idArticulo = e.inventory_item.id
    const existentes = await inventario.listInventoryLevels({ inventory_item_id: idArticulo, location_id: ubicacion })
    if (dry) {
      log(`DRY_RUN: ${existentes.length ? "actualizaría" : "crearía"} el nivel de ${idArticulo} en ${ubicacion} a ${cantidad}`)
      continue
    }
    if (existentes.length) {
      await inventario.updateInventoryLevels([{ inventory_item_id: idArticulo, location_id: ubicacion, stocked_quantity: cantidad }])
      log(`Actualizado: ${idArticulo} en ${ubicacion} -> ${cantidad}`)
    } else {
      await inventario.createInventoryLevels([{ inventory_item_id: idArticulo, location_id: ubicacion, stocked_quantity: cantidad }])
      log(`Creado: ${idArticulo} en ${ubicacion} -> ${cantidad}`)
    }
  }
}
