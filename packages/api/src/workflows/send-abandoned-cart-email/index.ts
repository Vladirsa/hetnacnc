import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { sendAbandonedCartEmailStep } from "./steps/send-abandoned-cart-email"
import { markAbandonedCartEmailSentStep } from "./steps/mark-abandoned-cart-email-sent"

export type SendAbandonedCartEmailWorkflowInput = {
  cart_id: string
  email: string
  items: { title: string; quantity: number }[]
  total: number
  currency_code: string
  cart_url: string
  metadata: Record<string, unknown> | null
}

export const sendAbandonedCartEmailWorkflow = createWorkflow(
  "send-abandoned-cart-email",
  function (input: SendAbandonedCartEmailWorkflowInput) {
    const sendResult = sendAbandonedCartEmailStep({
      to: input.email,
      items: input.items,
      total: input.total,
      currency_code: input.currency_code,
      cart_url: input.cart_url,
    })

    // Solo marcamos el carrito como "notificado" si el correo salió de
    // verdad; si Resend no está configurado o falló, el job puede
    // reintentar en la siguiente corrida.
    when(sendResult, (result) => result.sent).then(() => {
      return markAbandonedCartEmailSentStep({
        cart_id: input.cart_id,
        previous_metadata: input.metadata,
      })
    })

    // Devolvemos { sent } para que el job sepa si el correo salió
    return new WorkflowResponse(sendResult)
  }
)
