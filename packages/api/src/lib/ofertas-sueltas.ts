// Ofertas sueltas: el precio y las existencias de un taller apuntando a un
// producto (o presentación) que ya se borró.
//
// Medusa borra el producto y sus presentaciones, pero las ofertas de Mercur se
// quedan vivas. Nadie las puede comprar ("la presentación no existe"), pero
// cuentan en los productos y existencias del taller y confunden al revisar.
// El 23 nov 2026 había 49 (casi todas de Hetna CNC, más una de SASA).
//
// Se dan de baja con el flujo de Mercur (deleteOffersWorkflow: baja suave, se
// puede restaurar). Lo llaman subscribers/producto-borrado-ofertas.ts al borrar
// un producto o una presentación, y jobs/ofertas-sueltas.ts una vez al día por
// si algún aviso se perdió.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteOffersWorkflow } from "@mercurjs/core/workflows"

const LOTE = 200

/** Ids de ofertas vivas cuya presentación ya no existe o está borrada. */
export async function ofertasSueltas(container: Pick<MedusaContainer, "resolve">, limite = LOTE): Promise<string[]> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const { rows } = await knex.raw(
    `select o.id from offer o
     left join product_variant v on v.id = o.variant_id
     where o.deleted_at is null and (v.id is null or v.deleted_at is not null)
     order by o.id
     limit ?`,
    [limite]
  )
  return (rows as { id: string }[]).map((r) => r.id)
}

/** Da de baja las ofertas sueltas. Devuelve cuántas. */
export async function bajaOfertasSueltas(container: MedusaContainer): Promise<number> {
  const ids = await ofertasSueltas(container)
  if (!ids.length) return 0
  await deleteOffersWorkflow(container).run({ input: { ids } })
  return ids.length
}
