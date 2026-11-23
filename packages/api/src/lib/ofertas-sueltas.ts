// Ofertas sueltas: el precio y las existencias de un taller apuntando a un
// producto (o presentación) que ya se borró.
//
// Medusa borra el producto y sus presentaciones, pero las ofertas de Mercur se
// quedan vivas. Nadie las puede comprar ("la presentación no existe"), pero
// cuentan en los productos del taller y confunden al revisar. El 23 nov 2026
// había 49 (casi todas de Hetna CNC, más una de SASA).
//
// Se dan de baja con el flujo de Mercur (deleteOffersWorkflow: baja suave de la
// oferta; su inventario y precios se quedan como estaban). Lo llaman
// subscribers/producto-borrado-ofertas.ts al borrar un producto o una
// presentación, y jobs/ofertas-sueltas.ts una vez al día por si algún aviso se
// perdió.
//
// No se tocan las ofertas con un pedido pendiente (ni completado ni cancelado):
// el envío y las comisiones de ese pedido todavía leen la oferta. Se dan de baja
// en la revisión diaria cuando el pedido termine.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteOffersWorkflow } from "@mercurjs/core/workflows"

const LOTE = 200
const MAX_LOTES = 25

/** Ids de ofertas vivas cuya presentación ya no existe o está borrada, sin pedidos pendientes. */
export async function ofertasSueltas(container: Pick<MedusaContainer, "resolve">, limite = LOTE): Promise<string[]> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const { rows } = await knex.raw(
    `select o.id from offer o
     left join product_variant v on v.id = o.variant_id
     where o.deleted_at is null and (v.id is null or v.deleted_at is not null)
       and not exists (
         select 1 from order_order_line_item_offer_offer l
         join order_item oi on oi.item_id = l.order_line_item_id and oi.deleted_at is null
         join "order" ord on ord.id = oi.order_id and ord.deleted_at is null
         where l.offer_id = o.id and l.deleted_at is null
           and ord.status not in ('completed', 'canceled', 'archived')
       )
     order by o.id
     limit ?`,
    [limite]
  )
  return (rows as { id: string }[]).map((r) => r.id)
}

/** Da de baja todas las ofertas sueltas (por lotes). Devuelve cuántas. */
export async function bajaOfertasSueltas(container: MedusaContainer): Promise<number> {
  let total = 0
  for (let i = 0; i < MAX_LOTES; i++) {
    const ids = await ofertasSueltas(container)
    if (!ids.length) break
    await deleteOffersWorkflow(container).run({ input: { ids } })
    total += ids.length
    if (ids.length < LOTE) break
  }
  return total
}
