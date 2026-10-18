import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { createCotizacionStep, CreateCotizacionStepInput } from "./steps/create-cotizacion"

export const createCotizacionWorkflow = createWorkflow(
  "create-cotizacion",
  function (input: CreateCotizacionStepInput) {
    const result = createCotizacionStep(input)
    return new WorkflowResponse(result)
  }
)
