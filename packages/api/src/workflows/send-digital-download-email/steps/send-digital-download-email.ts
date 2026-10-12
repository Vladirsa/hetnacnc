import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

import { sendEmail } from "../../../lib/resend"
import { digitalDownloadEmailHtml } from "../../../lib/email-templates"

export type SendDigitalDownloadEmailStepInput = {
  to: string
  product_title: string
  download_url: string
  expires_at: string
}

// Igual que el correo de carrito abandonado: enviar un correo es un efecto
// externo sin mutacion que compensar.
export const sendDigitalDownloadEmailStep = createStep(
  "send-digital-download-email",
  async (input: SendDigitalDownloadEmailStepInput, { container }) => {
    const logger = container.resolve("logger")

    const { sent, reason } = await sendEmail({
      to: input.to,
      subject: `Tu archivo de ${input.product_title} ya está listo`,
      html: digitalDownloadEmailHtml({
        productTitle: input.product_title,
        downloadUrl: input.download_url,
        expiresAt: input.expires_at,
      }),
    })

    if (!sent) {
      logger.info(`[digital-download] no enviado a ${input.to}: ${reason}`)
    }

    return new StepResponse({ sent })
  }
)
