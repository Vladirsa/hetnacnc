import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/framework/types"

export type MarkReviewRequestSentStepInput = {
  order_id: string
  previous_metadata: Record<string, unknown> | null
}

// La única mutación real de este workflow: marca la orden para que el job no
// vuelva a pedir la misma reseña. Es lo que lo hace reintentable -- y lo que
// evita que el cliente reciba el mismo correo cada hora.
export const markReviewRequestSentStep = createStep(
  "mark-review-request-sent",
  async (input: MarkReviewRequestSentStepInput, { container }) => {
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER)

    const updated = await orderModuleService.updateOrders(input.order_id, {
      metadata: {
        ...(input.previous_metadata || {}),
        resena_email_sent_at: new Date().toISOString(),
      },
    })

    return new StepResponse(updated, {
      order_id: input.order_id,
      previous_metadata: input.previous_metadata,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) return
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModuleService.updateOrders(compensationInput.order_id, {
      metadata: compensationInput.previous_metadata || {},
    })
  }
)
