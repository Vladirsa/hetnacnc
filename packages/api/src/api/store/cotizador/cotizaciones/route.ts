import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../../modules/cotizador"
import CotizadorModuleService from "../../../../modules/cotizador/service"
import { createCotizacionWorkflow } from "../../../../workflows/create-cotizacion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  const [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })
  if (!perfil) {
    return res.json({ cotizaciones: [], count: 0 })
  }

  const filtros: Record<string, unknown> = { perfil_id: perfil.id }
  if (req.query.estatus) {
    filtros.estatus = String(req.query.estatus)
  }

  const [cotizaciones, count] = await cotizadorModuleService.listAndCountCotizacions(filtros, {
    order: { created_at: "DESC" },
    take: Number(req.query.limit) || 50,
    skip: Number(req.query.offset) || 0,
  })

  res.json({ cotizaciones, count })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const body = (req.validatedBody || req.body || {}) as Record<string, any>

  if (!body.cliente_nombre) {
    return res.status(400).json({ message: "cliente_nombre es requerido" })
  }
  if (!Array.isArray(body.partidas) || body.partidas.length === 0) {
    return res.status(400).json({ message: "partidas debe traer al menos una partida" })
  }

  const { result } = await createCotizacionWorkflow(req.scope).run({
    input: { ...body, customer_id: customerId } as any,
  })

  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)
  const cotizacion = await cotizadorModuleService.retrieveCotizacion(result.cotizacion_id)

  res.status(201).json({ cotizacion })
}
