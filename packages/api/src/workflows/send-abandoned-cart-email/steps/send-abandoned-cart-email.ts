import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../../../lib/baja"
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

    // Correo promocional: no se manda a quien se dio de baja
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    if (await estaDeBaja(knex, input.to).catch(() => false)) {
      logger.info(`[%s] ${input.to} se dio de baja de promociones; no se envía`.replace("%s", "abandoned-cart"))
      return new StepResponse({ sent: false })
    }

    const { sent, reason } = await sendEmail({
      to: input.to,
      bajaUrl: ligaBaja(input.to),
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
