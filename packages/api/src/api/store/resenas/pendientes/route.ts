import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /store/resenas/pendientes
//
// Lo que el cliente compró y todavía no reseña. Es el gancho: sin una lista así,
// nadie regresa solo a escribir una reseña, y sin reseñas la ficha del producto
// compite nada más por precio.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: ordenes } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "created_at",
      "items.product_id",
      "items.title",
      "items.thumbnail",
      "payment_collections.status",
    ],
    filters: { customer_id: customerId },
  })

  // `query.graph` devuelve los tipos completos de Medusa, con todo anulable.
  // Aquí sólo se leen cuatro campos, así que se estrecha a lo que de verdad se
  // usa en vez de pelearse con el tipo generado.
  type OrdenLigera = {
    id: string
    created_at: string
    items?: ({ product_id?: string | null; title?: string | null; thumbnail?: string | null } | null)[] | null
    payment_collections?: ({ status?: string | null } | null)[] | null
  }

  // Sólo lo pagado: una orden sin pago no da derecho a reseñar.
  const pagadas = ((ordenes || []) as unknown as OrdenLigera[]).filter((o) =>
    (o.payment_collections || []).some(
      (pc) => pc?.status === "completed" || pc?.status === "partially_captured"
    )
  )

  // Lo que ya reseñó, para no volver a pedírselo.
  const { data: yaResenadas } = await query.graph({
    entity: "customer_customer_review_review",
    fields: ["review.id", "review.reference"],
    filters: { customer_id: customerId },
  })
  const idsResenas = new Set(
    (yaResenadas || [])
      .map((e: { review?: { id?: string } }) => e.review?.id)
      .filter(Boolean) as string[]
  )

  const enlacesProducto = idsResenas.size
    ? (
        await query.graph({
          entity: "product_product_review_review",
          fields: ["product_id", "review_id"],
          filters: { review_id: [...idsResenas] },
        })
      ).data
    : []

  const productosResenados = new Set(
    (enlacesProducto as unknown as { product_id?: string }[])
      .map((e) => e.product_id)
      .filter(Boolean) as string[]
  )

  const pendientes: {
    order_id: string
    product_id: string
    titulo: string
    thumbnail: string | null
    comprado: string
  }[] = []
  const vistos = new Set<string>()

  for (const orden of pagadas) {
    for (const item of orden.items || []) {
      if (!item?.product_id) continue
      if (productosResenados.has(item.product_id)) continue
      // Un producto comprado dos veces se pide reseñar una sola vez.
      if (vistos.has(item.product_id)) continue
      vistos.add(item.product_id)
      pendientes.push({
        order_id: orden.id,
        product_id: item.product_id,
        titulo: item.title || "",
        thumbnail: item.thumbnail || null,
        comprado: orden.created_at,
      })
    }
  }

  res.json({ pendientes })
}
