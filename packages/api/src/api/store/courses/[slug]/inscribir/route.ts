// Inscribirse a un curso GRATIS con un clic. Los de pago se compran en su
// ficha de producto y la inscripción llega sola al pagarse el pedido.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { inscribir, precioDeProducto } from "../../../../../lib/cursos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión para inscribirte" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "course",
    fields: ["id", "status", "product.handle", "product.metadata"],
    filters: { slug: req.params.slug, status: "published" },
  })
  const curso = data[0] as any
  if (!curso) return res.status(404).json({ message: "Ese curso no existe" })

  const precio = precioDeProducto(curso.product)
  if (!precio.gratis) {
    return res.status(402).json({ message: "Este curso es de pago", product_handle: curso.product?.handle ?? null })
  }
  const nuevo = await inscribir(req.scope, customerId, curso.id, null)
  res.json({ inscrito: true, nuevo })
}
