import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../../../modules/cotizador"
import CotizadorModuleService from "../../../../../modules/cotizador/service"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  const [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })
  if (!perfil) {
    return res.status(404).json({ message: "Cotización no encontrada" })
  }

  // El filtro por perfil_id es el aislamiento entre talleres: pedir el id de
  // una cotización ajena responde 404, no la cotización.
  const [cotizacion] = await cotizadorModuleService.listCotizacions({ id, perfil_id: perfil.id })
  if (!cotizacion) {
    return res.status(404).json({ message: "Cotización no encontrada" })
  }

  const partidas = await cotizadorModuleService.listCotizacionPartidas(
    { cotizacion_id: cotizacion.id },
    { order: { posicion: "ASC" } }
  )

  res.json({ cotizacion, partidas })
}
