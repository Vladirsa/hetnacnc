// Crear o actualizar UNA oferta de una tienda (HETNA o un taller) con su
// precio y existencias. Lo usan el importador de productos, el publicador de
// Diseños listos y el panel del taller (Piezas para imprimir).
//
// Al actualizar el precio NO se usa updateOffersWorkflow con `prices`: eso
// reemplaza todos los precios de la oferta y borraría los escalones de
// "Precios por cantidad" que el taller puso (api/vendor/hetna-volumen). Aquí
// se reenvía el precio base con su id y se conservan los escalones que siguen
// siendo más baratos que el nuevo precio.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOffersWorkflow, updateOffersWorkflow, upsertOfferPricesWorkflow } from "@mercurjs/core/workflows"
import type { CreateOfferDTO } from "@mercurjs/types"

import type { Tienda } from "./importar-productos/importar"
import { precioEnDolares } from "./publicar-diseno"

export function preciosOferta(precio: number, aceptaUsd: boolean) {
  const precios = [{ currency_code: "mxn", amount: precio }]
  if (aceptaUsd) precios.push({ currency_code: "usd", amount: precioEnDolares(precio) })
  return precios
}

/** Existencias de una oferta en el almacén de la tienda (crea el nivel si falta). */
export async function ponerExistencias(container: MedusaContainer, offerId: string, locationId: string, cantidad: number) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inv = container.resolve(Modules.INVENTORY)
  const { data } = await query.graph({ entity: "offer", fields: ["id", "inventory_item_link.inventory_item.id"], filters: { id: offerId } })
  const itemId = (data[0] as any)?.inventory_item_link?.[0]?.inventory_item?.id as string | undefined
  if (!itemId) throw new Error("la oferta no tiene inventario ligado")
  const niveles = await inv.listInventoryLevels({ inventory_item_id: itemId, location_id: locationId })
  if (niveles.length) await inv.updateInventoryLevels([{ inventory_item_id: itemId, location_id: locationId, stocked_quantity: cantidad }])
  else await inv.createInventoryLevels([{ inventory_item_id: itemId, location_id: locationId, stocked_quantity: cantidad }])
}

type Precio = { id?: string; amount: number; currency_code: string; min_quantity?: number | null }

/** Precios para reenviar: el base de cada moneda con su id y los escalones que siguen bajando el precio. */
export function preciosActualizados(actuales: Precio[], nuevos: { amount: number; currency_code: string }[]): Precio[] {
  const min = (p: Precio) => (p.min_quantity == null ? null : Number(p.min_quantity))
  const salida: Precio[] = []
  for (const n of nuevos) {
    const base = actuales.find((p) => p.currency_code?.toLowerCase() === n.currency_code && (min(p) === null || min(p)! <= 1))
    salida.push({ ...(base?.id ? { id: base.id } : {}), amount: n.amount, currency_code: n.currency_code })
    for (const e of actuales)
      if (e.currency_code?.toLowerCase() === n.currency_code && (min(e) ?? 0) >= 2 && Number(e.amount) < n.amount)
        salida.push({ id: e.id, amount: Number(e.amount), currency_code: n.currency_code, min_quantity: min(e) })
  }
  return salida
}

export async function guardarOferta(
  container: MedusaContainer,
  t: Pick<Tienda, "sellerId" | "memberId" | "locationId" | "perfilId" | "aceptaUsd">,
  o: { offerId?: string; variantId: string; sku: string; precio: number; existencias: number; metadata?: Record<string, unknown> }
): Promise<{ id?: string; accion: "creada" | "actualizada" }> {
  const nuevos = preciosOferta(o.precio, t.aceptaUsd)
  if (o.offerId) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "offer", fields: ["id", "prices.id", "prices.amount", "prices.currency_code", "prices.min_quantity"], filters: { id: o.offerId } })
    const actuales = ((data[0] as { prices?: Precio[] } | undefined)?.prices || []) as Precio[]
    // existencias primero: el cambio de la oferta (al final) avisa a la tienda y
    // así no se guarda en caché con las existencias de antes
    await ponerExistencias(container, o.offerId, t.locationId, o.existencias)
    await upsertOfferPricesWorkflow(container).run({ input: { offers: [{ id: o.offerId, prices: preciosActualizados(actuales, nuevos) }] } as any })
    // siempre al final (aunque no cambie nada más): emite offer.updated y la tienda refresca su caché
    await updateOffersWorkflow(container).run({ input: { offers: [{ id: o.offerId, ...(o.metadata ? { metadata: o.metadata } : {}) } as any] } })
    return { id: o.offerId, accion: "actualizada" }
  }
  const { result } = await createOffersWorkflow(container).run({
    input: {
      offers: [{
        seller_id: t.sellerId, created_by: t.memberId, sku: o.sku, variant_id: o.variantId, shipping_profile_id: t.perfilId,
        manage_inventory: true, allow_backorder: false,
        inventory_items: [{ sku: o.sku, stock_levels: [{ location_id: t.locationId, stocked_quantity: o.existencias }] }],
        prices: nuevos,
        ...(o.metadata ? { metadata: o.metadata } : {}),
      } as CreateOfferDTO],
    },
  })
  return { id: (result as { id?: string }[] | undefined)?.[0]?.id, accion: "creada" }
}
