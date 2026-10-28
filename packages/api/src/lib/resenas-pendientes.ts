import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Qué significa "pendiente de reseñar", en un solo lugar.
//
// Lo preguntan dos cosas distintas: la ficha del producto (para abrir el
// formulario al cliente que ya compró) y el correo que invita a reseñar. Si cada
// una lo decidiera por su cuenta, acabarían discrepando -- el correo pidiendo
// una reseña que la ficha ya da por hecha, o al revés.
//
// Las tres reglas: la orden tiene que estar pagada, el producto no puede estar
// ya reseñado por ese cliente, y un producto comprado dos veces se pide una
// sola vez.

// `query.graph` devuelve los tipos completos de Medusa, con todo anulable. Aquí
// sólo se leen unos campos, así que se estrecha a lo que de verdad se usa en vez
// de pelearse con el tipo generado.
export type OrdenLigera = {
  id: string
  created_at: string
  email?: string | null
  customer_id?: string | null
  metadata?: Record<string, unknown> | null
  items?:
    | ({
        product_id?: string | null
        product_handle?: string | null
        title?: string | null
        thumbnail?: string | null
      } | null)[]
    | null
  payment_collections?: ({ status?: string | null } | null)[] | null
}

export const CAMPOS_ORDEN_PENDIENTES = [
  "id",
  "created_at",
  "email",
  "customer_id",
  "metadata",
  "items.product_id",
  "items.product_handle",
  "items.title",
  "items.thumbnail",
  "payment_collections.status",
]

// Una orden sin pago no da derecho a reseñar.
export const estaPagada = (orden: OrdenLigera): boolean =>
  (orden.payment_collections || []).some(
    (pc) => pc?.status === "completed" || pc?.status === "partially_captured"
  )

// Los productos que un cliente ya reseñó. Se va por los enlaces del dominio
// Review de Mercur: cliente -> reseña -> producto.
export async function productosResenadosPor(
  container,
  customerId: string
): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: suyas } = await query.graph({
    entity: "customer_review",
    fields: ["review.id"],
    filters: { customer_id: customerId },
  })

  const idsResenas = (suyas || [])
    .map((e: { review?: { id?: string } }) => e.review?.id)
    .filter(Boolean) as string[]

  if (!idsResenas.length) return new Set()

  const { data: enlaces } = await query.graph({
    entity: "product_review",
    fields: ["product_id", "review_id"],
    filters: { review_id: idsResenas },
  })

  return new Set(
    (enlaces as unknown as { product_id?: string }[])
      .map((e) => e.product_id)
      .filter(Boolean) as string[]
  )
}

export type Pendiente = {
  order_id: string
  product_id: string
  handle: string | null
  titulo: string
  thumbnail: string | null
  comprado: string
}

// Lo pendiente de un juego de órdenes YA FILTRADAS como pagadas, descontando lo
// que el cliente ya reseñó.
export function pendientesDeOrdenes(
  ordenes: OrdenLigera[],
  productosResenados: Set<string>
): Pendiente[] {
  const pendientes: Pendiente[] = []
  const vistos = new Set<string>()

  for (const orden of ordenes) {
    for (const item of orden.items || []) {
      if (!item?.product_id) continue
      if (productosResenados.has(item.product_id)) continue
      if (vistos.has(item.product_id)) continue
      vistos.add(item.product_id)
      pendientes.push({
        order_id: orden.id,
        product_id: item.product_id,
        handle: item.product_handle || null,
        titulo: item.title || "",
        thumbnail: item.thumbnail || null,
        comprado: orden.created_at,
      })
    }
  }

  return pendientes
}
