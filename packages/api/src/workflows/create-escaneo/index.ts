import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { createEscaneoStep, type CreateEscaneoStepInput } from "./steps/create-escaneo"
import { spendCreditsStep } from "../spend-credits/steps/spend-credits"

export const createEscaneoWorkflow = createWorkflow(
  "create-escaneo",
  (input: CreateEscaneoStepInput) => {
    // El expediente se crea primero y el cobro va después: si el cobro truena
    // (saldo insuficiente), revertir una fila recién creada no cuesta nada.
    // Al revés habría que devolver créditos, que sí deja rastro en el ledger.
    //
    // El precio lo decide el paso de creación y queda guardado ahí; aquí sólo
    // se cobra esa cifra, para que el cobro y el expediente nunca difieran.
    const escaneo = createEscaneoStep(input)

    when({ escaneo }, (data) => data.escaneo.creditos > 0).then(() => {
      spendCreditsStep(
        transform({ escaneo, input }, (data) => ({
          customer_id: data.input.customer_id,
          amount: data.escaneo.creditos,
          reference_id: data.escaneo.escaneo_id,
          description: `Escaneo 3D${data.input.titulo ? ` — ${data.input.titulo}` : ""}`,
        }))
      )
    })

    return new WorkflowResponse(escaneo)
  }
)
