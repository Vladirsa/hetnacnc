import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

import { sendEmail } from "../../../lib/resend"
import { reviewRequestEmailHtml, type ProductoAResenar } from "../../../lib/email-templates"

export type SendReviewRequestEmailStepInput = {
  to: string
  nombre?: string | null
  productos: ProductoAResenar[]
}

// Enviar el correo es un efecto externo, no una mutación: no hay nada que
// compensar si una mutación posterior del workflow falla (no se puede
// "desenviar" un correo).
export const sendReviewRequestEmailStep = createStep(
  "send-review-request-email",
  async (input: SendReviewRequestEmailStepInput, { container }) => {
    const logger = container.resolve("logger")

    const { sent, reason } = await sendEmail({
      to: input.to,
      subject:
        input.productos.length === 1
          ? "¿Cómo te fue con tu compra?"
          : "¿Cómo te fue con tus compras?",
      html: reviewRequestEmailHtml({
        nombre: input.nombre,
        productos: input.productos,
      }),
    })

    if (!sent) {
      logger.info(`[resenas-correo] no enviado a ${input.to}: ${reason}`)
    }

    return new StepResponse({ sent })
  }
)
