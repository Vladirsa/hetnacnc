// Rastreo de un pedido para el cliente (Mis pedidos): número de guía, liga de
// rastreo y paquetería. Solo responde con los pedidos del propio cliente.
//   GET /store/hetna-rastreo/:id
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarTablaGuias, T_GUIAS } from "../../../../lib/guias"

type Etiqueta = { tracking_number?: string | null; tracking_url?: string | null }
type Cumplimiento = { canceled_at?: string | null; delivered_at?: string | null; labels?: Etiqueta[] }

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [pedido],
  } = (await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "fulfillments.canceled_at",
      "fulfillments.delivered_at",
      "fulfillments.labels.tracking_number",
      "fulfillments.labels.tracking_url",
    ],
    filters: { id: req.params.id },
  })) as unknown as { data: { id: string; customer_id: string; fulfillments?: Cumplimiento[] }[] }
  if (!pedido || pedido.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "No encontramos ese pedido." })
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaGuias(knex)
  const guia = await knex(T_GUIAS).where({ order_id: pedido.id }).first()

  const envios = (pedido.fulfillments || [])
    .filter((f) => !f.canceled_at)
    .flatMap((f) =>
      (f.labels || [])
        .filter((l) => l.tracking_number)
        .map((l) => ({
          guia: l.tracking_number as string,
          url: /^https?:\/\//.test(l.tracking_url || "") ? l.tracking_url : null,
          paqueteria: guia && guia.guia === l.tracking_number ? guia.paqueteria : null,
          estado: guia && guia.guia === l.tracking_number ? guia.rastreo_estado : null,
          entregado: Boolean(f.delivered_at),
        }))
    )
  res.json({ envios })
}
