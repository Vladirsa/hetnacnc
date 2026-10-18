import { createWorkflow, WorkflowResponse, transform, when } from "@medusajs/framework/workflows-sdk"

import { createCotizacionStep, CreateCotizacionStepInput } from "./steps/create-cotizacion"
import { evaluarCobroCotizacionStep } from "./steps/evaluar-cobro"
import { spendCreditsStep } from "../spend-credits/steps/spend-credits"

// El cobro va DESPUÉS de crear la cotización, a propósito: spendCreditsStep
// truena con NOT_ALLOWED si no hay saldo, y al tronar el workflow se revierte
// -- la compensación de createCotizacionStep borra la cotización. Así no hay
// que duplicar la validación de saldo ni queda un cobro sin cotización.
export const createCotizacionWorkflow = createWorkflow(
  "create-cotizacion",
  function (input: CreateCotizacionStepInput) {
    const cotizacion = createCotizacionStep(input)

    const cobro = evaluarCobroCotizacionStep({ customer_id: input.customer_id })

    when({ cobro }, (data) => data.cobro.cobrar).then(() => {
      // input va dentro de transform, no leído por fuera: en un workflow los
      // valores son proxies hasta que un transform los resuelve, y leer
      // input.customer_id directo aquí manda un proxy al step.
      spendCreditsStep(
        transform({ cobro, cotizacion, input }, (data) => ({
          customer_id: data.input.customer_id,
          amount: data.cobro.creditos,
          reference_id: data.cotizacion.cotizacion_id,
          description: `Cotización ${data.cotizacion.folio}`,
        }))
      )
    })

    return new WorkflowResponse(
      transform({ cotizacion, cobro }, (data) => ({
        cotizacion_id: data.cotizacion.cotizacion_id,
        folio: data.cotizacion.folio,
        token_publico: data.cotizacion.token_publico,
        cobro: data.cobro,
      }))
    )
  }
)
