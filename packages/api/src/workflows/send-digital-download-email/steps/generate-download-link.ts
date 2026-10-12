import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

import { getSignedDownloadUrl } from "../../../lib/backblaze"

export type GenerateDownloadLinkStepInput = {
  storage_key: string
}

// Generamos el link en el momento de la compra, nunca reutilizamos uno
// viejo: asi la ventana de 7 dias siempre empieza cuando el cliente
// realmente puede usarla, y nunca le mandamos un link ya expirado.
export const generateDownloadLinkStep = createStep(
  "generate-download-link",
  async (input: GenerateDownloadLinkStepInput, { container }) => {
    const logger = container.resolve("logger")

    const result = await getSignedDownloadUrl(input.storage_key)

    if (!result.ok) {
      logger.info(`[digital-download] no se pudo generar link para ${input.storage_key}: ${result.reason}`)
      return new StepResponse({ ok: false, url: "", expiresAt: "" })
    }

    return new StepResponse({ ok: true, url: result.url, expiresAt: result.expiresAt })
  }
)
