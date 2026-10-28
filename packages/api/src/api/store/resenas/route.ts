import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createReviewWorkflow } from "@mercurjs/core/workflows"

// Reseñas de producto para la tienda.
//
// El dominio Review ya viene con Mercur: un solo modelo que sirve para producto
// y para vendedor, con `reference` decidiendo cuál, los enlaces a la orden y al
// cliente que respaldan "esto lo compró de verdad", y la moderación. Lo que NO
// trae son rutas de tienda -- las de Admin y Vendor sí existen -- así que eso es
// lo único que se construye aquí. No hay modelo nuevo ni tabla nueva.
//
// Ver node_modules/@mercurjs/docs/content/platform/review/.

const LIMITE = 20

type Resena = {
  id: string
  rating: number
  customer_note: string | null
  seller_note: string | null
  status: string
  created_at: string
}

// GET /store/resenas?product_id=prod_123&limit=20&offset=0
//
// Devuelve SÓLO las publicadas, más el promedio y el desglose por estrellas. Lo
// pendiente y lo rechazado no sale: una reseña recién escrita no es pública
// hasta que alguien la modera.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = String(req.query.product_id || "")
  if (!productId) {
    return res.status(400).json({ message: "Falta product_id." })
  }

  const limite = Math.min(Number(req.query.limit) || LIMITE, 50)
  const desde = Number(req.query.offset) || 0

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // El producto no es una columna de la reseña: se llega por el enlace del
  // módulo. Así es como Mercur une reseña y producto.
  const { data: enlaces } = await query.graph({
    entity: "product_review",
    fields: [
      "review.id",
      "review.rating",
      "review.customer_note",
      "review.seller_note",
      "review.status",
      "review.created_at",
    ],
    filters: { product_id: productId },
  })

  const todas = ((enlaces || []) as unknown as { review?: Resena }[])
    .map((e) => e.review)
    .filter((r): r is Resena => !!r && r.status === "published")
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  const total = todas.length
  const suma = todas.reduce((s, r) => s + (r.rating || 0), 0)

  // Desglose 5→1, que es como se lee una gráfica de reseñas.
  const desglose = [5, 4, 3, 2, 1].map((estrellas) => ({
    estrellas,
    total: todas.filter((r) => Math.round(r.rating) === estrellas).length,
  }))

  res.json({
    promedio: total ? Number((suma / total).toFixed(1)) : null,
    total,
    desglose,
    resenas: todas.slice(desde, desde + limite).map((r) => ({
      id: r.id,
      calificacion: r.rating,
      comentario: r.customer_note,
      respuesta_taller: r.seller_note,
      creado: r.created_at,
    })),
  })
}

// POST /store/resenas  { product_id, order_id, calificacion, comentario }
//
// El workflow de Mercur valida que la orden sea del cliente y que no haya
// reseñado ya ese producto en esa orden. Si cualquiera falla, no se crea nada.
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cuerpo = (req.body || {}) as {
    product_id?: string
    order_id?: string
    calificacion?: number
    comentario?: string
  }

  const calificacion = Number(cuerpo.calificacion)
  if (!cuerpo.product_id || !cuerpo.order_id) {
    return res.status(400).json({ message: "Falta el producto o el pedido." })
  }
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ message: "La calificación va de 1 a 5 estrellas." })
  }

  try {
    const { result } = await createReviewWorkflow(req.scope).run({
      input: {
        order_id: cuerpo.order_id,
        reference: "product",
        reference_id: cuerpo.product_id,
        rating: calificacion,
        customer_note: (cuerpo.comentario || "").trim() || undefined,
        customer_id: customerId,
      },
    })

    // Nace como `pending`: no se enseña hasta que se modera. Se le dice al
    // cliente para que no crea que su reseña se perdió al no verla.
    res.status(201).json({ ok: true, id: (result as { id?: string })?.id, moderacion: true })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo guardar tu reseña."
    // El workflow rechaza la segunda reseña del mismo producto en el mismo
    // pedido, y la orden que no es del cliente. Los dos son 400, no 500.
    res.status(400).json({ message: mensaje })
  }
}
