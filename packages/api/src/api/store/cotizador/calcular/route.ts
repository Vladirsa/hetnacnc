import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../../modules/cotizador"
import CotizadorModuleService from "../../../../modules/cotizador/service"
import { calcular } from "../../../../lib/cotizador-engine"
import { cfgDeTaller, costosDeTaller, servicioPorClave, tipoPorNombre } from "../../../../lib/cotizador-config"

// Calculadora: corre el motor con los costos y tarifas DEL TALLER que pide, no
// con los de HETNA. No guarda nada -- es la pantalla donde el taller tantea un
// precio antes de armar la cotización formal.
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)
  const body = (req.validatedBody || req.body || {}) as Record<string, any>

  const { servicio: servicioClave, tipo: tipoNombre, ...params } = body

  if (!servicioClave) {
    return res.status(400).json({ message: "servicio es requerido" })
  }

  const servicio = servicioPorClave(String(servicioClave))
  if (!servicio) {
    return res.status(400).json({ message: `servicio desconocido: ${servicioClave}` })
  }

  const tipo = tipoPorNombre(servicio, tipoNombre ? String(tipoNombre) : undefined)
  if (!tipo) {
    return res.status(400).json({ message: `El servicio ${servicio.nombre} no tiene un tipo de trabajo válido` })
  }

  const [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })
  const perfilParaMotor = perfil ?? {}

  const resultado = calcular({
    ...params,
    cfg: cfgDeTaller(perfilParaMotor, servicio),
    costos: costosDeTaller(perfilParaMotor),
    tipo,
    nombreServicio: servicio.nombre,
    emojiServicio: servicio.emoji,
  })

  res.json({
    resultado,
    // Para que la interfaz pueda avisar "estás cotizando con los costos de
    // referencia, captura los tuyos" en vez de dar un precio como si fuera suyo.
    usando_costos_propios: Boolean(perfil?.costo_hora_maquina || perfil?.costo_hora_operador || perfil?.costo_hora_taller),
  })
}
