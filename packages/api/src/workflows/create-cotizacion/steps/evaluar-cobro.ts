import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { COTIZADOR_MODULE } from "../../../modules/cotizador"
import CotizadorModuleService from "../../../modules/cotizador/service"

export type EvaluarCobroStepInput = {
  customer_id: string
}

export type EvaluarCobroStepOutput = {
  cobrar: boolean
  creditos: number
  gratis_por_mes: number
  usadas_este_mes: number
}

// Cuántas cotizaciones al mes son gratis antes de consumir créditos, y qué
// cuesta cada una de más. Son decisiones de precio, no de código: se mueven
// con variables de entorno sin tocar el flujo.
const GRATIS_POR_MES_DEFAULT = 5
const CREDITOS_POR_COTIZACION_DEFAULT = 1

// Corre DESPUÉS de crear la cotización, así que la recién creada ya está en el
// conteo: pasarse del tope significa usadas > gratis, no >=.
export const evaluarCobroCotizacionStep = createStep(
  "evaluar-cobro-cotizacion-step",
  async (input: EvaluarCobroStepInput, { container }) => {
    const cotizadorModuleService = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

    const gratisPorMes = Number(process.env.COTIZADOR_GRATIS_POR_MES) || GRATIS_POR_MES_DEFAULT
    const creditos = Number(process.env.COTIZADOR_CREDITOS_POR_COTIZACION) || CREDITOS_POR_COTIZACION_DEFAULT

    const [perfil] = await cotizadorModuleService.listTallerPerfils({
      customer_id: input.customer_id,
    })
    if (!perfil) {
      return new StepResponse<EvaluarCobroStepOutput>({
        cobrar: false,
        creditos: 0,
        gratis_por_mes: gratisPorMes,
        usadas_este_mes: 0,
      })
    }

    const inicioDeMes = new Date()
    inicioDeMes.setDate(1)
    inicioDeMes.setHours(0, 0, 0, 0)

    const [, usadas] = await cotizadorModuleService.listAndCountCotizacions(
      {
        perfil_id: perfil.id,
        created_at: { $gte: inicioDeMes },
      } as any,
      { take: 1 }
    )

    return new StepResponse<EvaluarCobroStepOutput>({
      cobrar: usadas > gratisPorMes,
      creditos,
      gratis_por_mes: gratisPorMes,
      usadas_este_mes: usadas,
    })
  }
)
