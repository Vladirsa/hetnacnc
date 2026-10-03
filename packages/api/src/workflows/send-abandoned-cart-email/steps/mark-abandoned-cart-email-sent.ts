import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/framework/types"

export type MarkAbandonedCartEmailSentStepInput = {
  cart_id: string
  previous_metadata: Record<string, unknown> | null
}

// La única mutación real de este workflow: marca el carrito para que el job
// no vuelva a mandarle el recordatorio. Es lo que hace reintentable el job
// (criterio de idempotencia de la guía de subscribers-and-jobs).
export const markAbandonedCartEmailSentStep = createStep(
  "mark-abandoned-cart-email-sent",
  async (input: MarkAbandonedCartEmailSentStepInput, { container }) => {
    const cartModuleService = container.resolve<ICartModuleService>(Modules.CART)

    const updated = await cartModuleService.updateCarts(input.cart_id, {
      metadata: {
        ...(input.previous_metadata || {}),
        abandoned_email_sent_at: new Date().toISOString(),
      },
    })

    return new StepResponse(updated, {
      cart_id: input.cart_id,
      previous_metadata: input.previous_metadata,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) return
    const cartModuleService = container.resolve<ICartModuleService>(Modules.CART)
    await cartModuleService.updateCarts(compensationInput.cart_id, {
      metadata: compensationInput.previous_metadata || {},
    })
  }
)
