import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { spendCreditsStep, SpendCreditsStepInput } from "./steps/spend-credits"

export const spendCreditsWorkflow = createWorkflow(
  "spend-credits",
  function (input: SpendCreditsStepInput) {
    const result = spendCreditsStep(input)
    return new WorkflowResponse(result)
  }
)
