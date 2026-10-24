import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type NotifyCamWebhookInput = {
  event: string
  jobs: Record<string, unknown>[]
}

const PUBLIC_FIELDS = [
  "id", "status", "service", "tier", "customer_id", "email", "order_id", "model_name",
  "controller", "kinematics", "stats", "review_requested", "customer_notes",
  "created_at", "paid_at", "delivered_at",
]

/**
 * Avisa a una automatización externa (por ejemplo n8n) cuando un trabajo se
 * crea, se paga o se entrega. Se activa con la variable CAM_WEBHOOK_URL.
 * Nunca hace fallar el flujo: si el webhook no responde, solo deja un aviso.
 */
export const notifyCamWebhookStep = createStep(
  "notify-cam-webhook",
  async (input: NotifyCamWebhookInput, { container }) => {
    const url = process.env.CAM_WEBHOOK_URL
    if (!url || !input.jobs.length) {
      return new StepResponse({ sent: false })
    }
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const jobs = input.jobs.map((job) =>
      Object.fromEntries(PUBLIC_FIELDS.filter((k) => k in job).map((k) => [k, job[k]]))
    )
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.CAM_WEBHOOK_SECRET
            ? { "x-hetna-secret": process.env.CAM_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify({ event: input.event, jobs }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        logger.warn(`Webhook CAM respondió ${res.status} para ${input.event}`)
      }
      return new StepResponse({ sent: res.ok })
    } catch (e) {
      logger.warn(`No se pudo enviar el webhook CAM (${input.event}): ${(e as Error).message}`)
      return new StepResponse({ sent: false })
    }
  }
)
