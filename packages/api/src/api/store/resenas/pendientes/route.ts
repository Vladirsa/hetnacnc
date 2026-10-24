import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  CAMPOS_ORDEN_PENDIENTES,
  estaPagada,
  pendientesDeOrdenes,
  productosResenadosPor,
  type OrdenLigera,
} from "../../../../lib/resenas-pendientes"

// GET /store/resenas/pendientes
//
// Lo que el cliente compró y todavía no reseña. Es el gancho: sin una lista así,
// nadie regresa solo a escribir una reseña, y sin reseñas la ficha del producto
// compite nada más por precio.
//
// Las reglas de qué cuenta como pendiente viven en lib/resenas-pendientes, que
// también usa el correo que invita a reseñar: si cada uno lo decidiera por su
// cuenta acabarían discrepando.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: ordenes } = await query.graph({
    entity: "order",
    fields: CAMPOS_ORDEN_PENDIENTES,
    filters: { customer_id: customerId },
  })

  const pagadas = ((ordenes || []) as unknown as OrdenLigera[]).filter(estaPagada)
  const productosResenados = await productosResenadosPor(req.scope, customerId)

  res.json({ pendientes: pendientesDeOrdenes(pagadas, productosResenados) })
}
