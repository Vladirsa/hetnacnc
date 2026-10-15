// @ts-nocheck
// Ver y poner existencias (inventario) de un producto en la ubicación de un taller,
// sin entrar al panel. Sirve cuando un producto sale con "insufficient stock".
//
// Uso (en /root/hetnacnc/packages/api):
//   1) Ver productos y sus existencias por ubicación (no cambia nada):
//        NODE_ENV=production bunx medusa exec ./src/scripts/poner-existencias.ts
//   2) Poner existencias (la ubicación es la del taller, ej. sloc_...):
//        PRODUCTO=<handle> UBICACION=sloc_xxx CANTIDAD=10 NODE_ENV=production bunx medusa exec ./src/scripts/poner-existencias.ts
//   Agrega DRY_RUN=1 para probar sin cambiar nada.
//
// Es seguro correrlo varias veces: si ya existe el nivel de inventario lo actualiza,
// y si no existe lo crea.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function ponerExistencias({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventario = container.resolve(Modules.INVENTORY)
  const log = (m: string) => console.log("[existencias] " + m)
  const dry = process.env.DRY_RUN === "1"
  const handle = (process.env.PRODUCTO || "").trim()
  const ubicacion = (process.env.UBICACION || "").trim()
  const cantidad = Number(process.env.CANTIDAD || 10)

  const { data: productos } = await query.graph({
    entity: "product",
    fields: [
      "id", "handle", "title",
      "variants.id", "variants.title", "variants.manage_inventory",
      "variants.inventory_items.inventory_item_id",
      "variants.inventory_items.inventory.location_levels.location_id",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    filters: handle ? { handle } : {},
  })

  // Modo lista: muestra productos y existencias por ubicación
  if (!handle) {
    log("Productos (usa PRODUCTO=<handle> UBICACION=<sloc_...> CANTIDAD=<n> para poner existencias):")
    for (const p of productos) {
      for (const v of p.variants || []) {
        const items = v.inventory_items || []
        if (!items.length) {
          log(`${p.handle} | ${p.title} | variante ${v.id} | SIN artículo de inventario ligado (manage_inventory=${v.manage_inventory})`)
          continue
        }
        for (const it of items) {
          const niveles = (it.inventory?.location_levels || [])
            .map((n) => `${n.location_id}: ${n.stocked_quantity} (reservadas ${n.reserved_quantity})`)
            .join(" ; ") || "sin ubicaciones"
          log(`${p.handle} | ${p.title} | artículo ${it.inventory_item_id} | ${niveles}`)
        }
      }
    }
    return
  }

  if (!productos.length) throw new Error("No existe un producto con handle: " + handle)
  if (!ubicacion.startsWith("sloc_")) throw new Error("Falta UBICACION=sloc_... (la ubicación del taller)")
  if (!(cantidad >= 0)) throw new Error("CANTIDAD debe ser un número, por ejemplo CANTIDAD=10")

  const p = productos[0]
  log(`Producto: ${p.title} (${p.handle})`)

  for (const v of p.variants || []) {
    for (const it of v.inventory_items || []) {
      const idArticulo = it.inventory_item_id
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
}
