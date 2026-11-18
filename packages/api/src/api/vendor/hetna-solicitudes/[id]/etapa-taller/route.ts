// POST /vendor/hetna-solicitudes/:id/etapa-taller
//   Avanza el trabajo a la siguiente etapa:
//   En corte → En producción → En acabado → Listo para entregar.
//   Sólo el taller ganador y con el pago confirmado. Avisa al cliente.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avanzarEtapa } from "../../../../../lib/etapa-taller"
import { pedidoDelTaller } from "../../../../../lib/licitacion-hitos-pedido"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const r = await pedidoDelTaller(knex, String(req.params.id), sellerId)
  if (!r.ok) return res.status(r.error[0]).json({ message: r.error[1] })
  if (["entregada", "cerrada"].includes(String(r.s.etapa || ""))) {
    return res.status(409).json({ message: "Este pedido ya se entregó." })
  }
  const out = await avanzarEtapa(knex, r.s, r.inicio, logger)
  if (!out.ok) return res.status(out.status).json({ message: out.message })
  res.json(out)
}
