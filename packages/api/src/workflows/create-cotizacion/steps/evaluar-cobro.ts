import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { COTIZADOR_MODULE } from "../../../modules/cotizador"
import CotizadorModuleService from "../../../modules/cotizador/service"
import { resumenPlan, type PlanEfectivo } from "../../../lib/cotizador-plan"

export type EvaluarCobroStepInput = {
  customer_id: string
}

export type EvaluarCobroStepOutput = {
  cobrar: boolean
  creditos: number
  plan: PlanEfectivo
  limite: number | null
  usadas: number
  prueba_dias: number
}

// Cuántos créditos cuesta una cotización que se pasa del cupo del plan. Es
// decisión de precio, no de código.
const CREDITOS_POR_COTIZACION_DEFAULT = 1

// Corre DESPUÉS de crear la cotización, que ya movió el contador del mes, así
// que la recién emitida va incluida en `usadas`: pasarse del cupo significa
// usadas > límite.
//
// Los dos cobros conviven: el plan da el cupo mensual y los créditos sirven
// para pasarse de él. Un plan de pago o la prueba no tienen límite, así que
// nunca cobran créditos.
export const evaluarCobroCotizacionStep = createStep(
  "evaluar-cobro-cotizacion-step",
  async (input: EvaluarCobroStepInput, { container }) => {
    const cotizadorModuleService = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)
    const creditos = Number(process.env.COTIZADOR_CREDITOS_POR_COTIZACION) || CREDITOS_POR_COTIZACION_DEFAULT

    const [perfil] = await cotizadorModuleService.listTallerPerfils({
      customer_id: input.customer_id,
    })
    if (!perfil) {
      return new StepResponse<EvaluarCobroStepOutput>({
        cobrar: false,
        creditos: 0,
        plan: "gratis",
        limite: null,
        usadas: 0,
        prueba_dias: 0,
      })
    }

    const resumen = resumenPlan(perfil)

    return new StepResponse<EvaluarCobroStepOutput>({
      cobrar: resumen.limite !== null && resumen.usadas > resumen.limite,
      creditos,
      plan: resumen.plan,
      limite: resumen.limite,
      usadas: resumen.usadas,
      prueba_dias: resumen.prueba_dias,
    })
  }
)
