import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import type { ProductoAResenar } from "../../lib/email-templates"
import { sendReviewRequestEmailStep } from "./steps/send-review-request-email"
import { markReviewRequestSentStep } from "./steps/mark-review-request-sent"

export type SendReviewRequestEmailWorkflowInput = {
  order_id: string
  email: string
  nombre?: string | null
  productos: ProductoAResenar[]
  metadata: Record<string, unknown> | null
}

export const sendReviewRequestEmailWorkflow = createWorkflow(
  "send-review-request-email",
  function (input: SendReviewRequestEmailWorkflowInput) {
    const sendResult = sendReviewRequestEmailStep({
      to: input.email,
      nombre: input.nombre,
      productos: input.productos,
    })

    // Sólo se marca la orden si el correo salió de verdad: si Resend no está
    // configurado o falló, el job lo reintenta en la siguiente corrida en vez
    // de dar por avisado a alguien que nunca recibió nada.
    when(sendResult, (result) => result.sent).then(() => {
      return markReviewRequestSentStep({
        order_id: input.order_id,
        previous_metadata: input.metadata,
      })
    })

    return new WorkflowResponse(sendResult)
  }
)
