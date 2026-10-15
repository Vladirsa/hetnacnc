import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { grantCreditsStep, GrantCreditsStepInput } from "./steps/grant-credits"

export const grantCreditsWorkflow = createWorkflow(
  "grant-credits",
  function (input: GrantCreditsStepInput) {
    const result = grantCreditsStep(input)
    return new WorkflowResponse(result)
  }
)
