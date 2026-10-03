import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

import { sendEmail } from "../../../lib/resend"
import { abandonedCartEmailHtml } from "../../../lib/email-templates"

export type SendAbandonedCartEmailStepInput = {
  to: string
  items: { title: string; quantity: number }[]
  total: number
  currency_code: string
  cart_url: string
}

// Enviar el correo es un efecto externo, no una mutación: no hay nada que
// compensar si una mutación posterior del workflow falla (no se puede
// "desenviar" un correo).
export const sendAbandonedCartEmailStep = createStep(
  "send-abandoned-cart-email",
  async (input: SendAbandonedCartEmailStepInput, { container }) => {
    const logger = container.resolve("logger")

    const { sent, reason } = await sendEmail({
      to: input.to,
      subject: "Dejaste algo en tu carrito",
      html: abandonedCartEmailHtml({
        items: input.items,
        total: input.total,
        currencyCode: input.currency_code,
        cartUrl: input.cart_url,
      }),
    })

    if (!sent) {
      logger.info(`[abandoned-cart] no enviado a ${input.to}: ${reason}`)
    }

    return new StepResponse({ sent })
  }
)
