// ¿Está pagado este pedido? Una sola regla para todo el sitio.
//
// Mercur divide cada carrito en un pedido por taller y el cobro se queda en el
// CARRITO, no en cada pedido (node_modules/@mercurjs/docs/.../order-groups.mdx):
// los pedidos divididos no tienen `payment_collections` propios. Por eso se lee
// el cobro por los dos caminos: pedido → payment_collections (pedidos de un solo
// cobro) y pedido → carrito → payment_collection (pedidos de Mercur).
//
// "authorized" cuenta como pagado: Mercado Pago (Checkout Pro, binary_mode) y
// PayPal ya cobraron cuando el pago queda autorizado, y en Medusa nadie lo
// "captura" después. `order.payment_status` no se puede pedir con query.graph.

/** Campos para pedir junto con el pedido en query.graph. */
export const CAMPOS_PAGO = [
  "payment_collections.status",
  "payment_collections.refunded_amount",
  "cart.payment_collection.status",
  "cart.payment_collection.refunded_amount",
]

const PAGADO = new Set(["authorized", "partially_authorized", "completed", "partially_captured"])

type Cobro = { status?: string | null; refunded_amount?: unknown } | null | undefined
export type ConCobro = {
  payment_collections?: Cobro[] | null
  cart?: { payment_collection?: Cobro } | null
}

export function cobrosDe(o: ConCobro | null | undefined): NonNullable<Cobro>[] {
  if (!o) return []
  return [...(o.payment_collections || []), o.cart?.payment_collection].filter(Boolean) as NonNullable<Cobro>[]
}

export const pedidoPagado = (o: ConCobro | null | undefined): boolean => cobrosDe(o).some((c) => PAGADO.has(String(c.status)))

export const pedidoReembolsado = (o: ConCobro | null | undefined): boolean =>
  cobrosDe(o).some((c) => Number((c.refunded_amount as any)?.value ?? c.refunded_amount ?? 0) > 0)

/** Lo mismo para SQL (alias `o` = tabla "order"): el pedido tiene un cobro pagado por cualquiera de los dos caminos. */
export const PAGADO_SQL = `(exists (select 1 from order_payment_collection opc
    join payment_collection pc on pc.id = opc.payment_collection_id
    where opc.order_id = o.id and opc.deleted_at is null and pc.deleted_at is null
      and pc.status in ('authorized','partially_authorized','completed','partially_captured'))
  or exists (select 1 from order_cart oc
    join cart_payment_collection cpc on cpc.cart_id = oc.cart_id and cpc.deleted_at is null
    join payment_collection pc on pc.id = cpc.payment_collection_id
    where oc.order_id = o.id and oc.deleted_at is null and pc.deleted_at is null
      and pc.status in ('authorized','partially_authorized','completed','partially_captured')))`

/** Los pedidos de un cobro: el ligado directo o los pedidos divididos de su carrito. */
export async function pedidosDelCobro(knex: any, paymentCollectionId: string): Promise<string[]> {
  const { rows } = await knex.raw(
    `select order_id from order_payment_collection where payment_collection_id = ? and deleted_at is null
     union
     select oc.order_id from cart_payment_collection cpc
       join order_cart oc on oc.cart_id = cpc.cart_id and oc.deleted_at is null
     where cpc.payment_collection_id = ? and cpc.deleted_at is null`,
    [paymentCollectionId, paymentCollectionId]
  )
  return (rows as { order_id: string }[]).map((r) => r.order_id)
}
