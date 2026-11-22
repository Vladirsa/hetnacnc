// ¿Está pagado este pedido? Una sola regla para todo el sitio.
//
// Mercur divide cada carrito en un pedido por taller y el cobro se queda en el
// CARRITO, no en cada pedido (node_modules/@mercurjs/docs/.../order-groups.mdx):
// los pedidos divididos no tienen `payment_collections` propios. Por eso se lee
// el cobro por los dos caminos: pedido → payment_collections (pedidos de un solo
// cobro) y pedido → carrito → payment_collection (pedidos de Mercur).
//
// "completed" / "partially_captured" (capturado) siempre cuenta.
// "authorized" cuenta SÓLO si el proveedor ya cobró al autorizar: Mercado Pago
// (Checkout Pro, binary_mode) y PayPal. Medusa no los captura después. Con
// "Pago manual" (pp_system_default) autorizado NO quiere decir cobrado: el cobro
// lo arregla el cliente con el taller, así que ahí hace falta la captura.
// `order.payment_status` no se puede pedir con query.graph.

/** Campos para pedir junto con el pedido en query.graph. */
export const CAMPOS_PAGO = [
  "payment_collections.status",
  "payment_collections.refunded_amount",
  "payment_collections.payments.provider_id",
  "cart.payment_collection.status",
  "cart.payment_collection.refunded_amount",
  "cart.payment_collection.payments.provider_id",
]

/** Proveedores que cobran al autorizar (prefijos de provider_id). */
export const COBRAN_AL_AUTORIZAR = ["pp_mercadopago", "pp_paypal"]
const CAPTURADO = ["completed", "partially_captured"]

type Cobro =
  | { status?: string | null; refunded_amount?: unknown; payments?: ({ provider_id?: string | null } | null)[] | null }
  | null
  | undefined
export type ConCobro = {
  payment_collections?: Cobro[] | null
  cart?: { payment_collection?: Cobro } | null
}

export function cobrosDe(o: ConCobro | null | undefined): NonNullable<Cobro>[] {
  if (!o) return []
  return [...(o.payment_collections || []), o.cart?.payment_collection].filter(Boolean) as NonNullable<Cobro>[]
}

const cobraAlAutorizar = (c: NonNullable<Cobro>) =>
  (c.payments || []).some((p) => COBRAN_AL_AUTORIZAR.some((pre) => String(p?.provider_id || "").startsWith(pre)))

export const cobroPagado = (c: NonNullable<Cobro>): boolean =>
  CAPTURADO.includes(String(c.status)) || (c.status === "authorized" && cobraAlAutorizar(c))

export const pedidoPagado = (o: ConCobro | null | undefined): boolean => cobrosDe(o).some(cobroPagado)

export const pedidoReembolsado = (o: ConCobro | null | undefined): boolean =>
  cobrosDe(o).some((c) => Number((c.refunded_amount as any)?.value ?? c.refunded_amount ?? 0) > 0)

// La misma regla en SQL (alias `o` = tabla "order"), armada con las mismas listas.
const lista = (xs: string[]) => xs.map((x) => `'${x}'`).join(",")
const COBRO_PAGADO_SQL = `(pc.status in (${lista(CAPTURADO)})
      or (pc.status = 'authorized' and exists (select 1 from payment p
        where p.payment_collection_id = pc.id and p.deleted_at is null
          and (${COBRAN_AL_AUTORIZAR.map((pre) => `p.provider_id like '${pre}%'`).join(" or ")}))))`

/** El pedido tiene un cobro pagado por cualquiera de los dos caminos. */
export const PAGADO_SQL = `(exists (select 1 from order_payment_collection opc
    join payment_collection pc on pc.id = opc.payment_collection_id
    where opc.order_id = o.id and opc.deleted_at is null and pc.deleted_at is null and ${COBRO_PAGADO_SQL})
  or exists (select 1 from order_cart oc
    join cart_payment_collection cpc on cpc.cart_id = oc.cart_id and cpc.deleted_at is null
    join payment_collection pc on pc.id = cpc.payment_collection_id
    where oc.order_id = o.id and oc.deleted_at is null and pc.deleted_at is null and ${COBRO_PAGADO_SQL}))`

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
