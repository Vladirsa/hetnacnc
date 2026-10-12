import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { generateDownloadLinkStep } from "./steps/generate-download-link"
import { sendDigitalDownloadEmailStep } from "./steps/send-digital-download-email"

export type SendDigitalDownloadEmailWorkflowInput = {
  to: string
  product_title: string
  storage_key: string
}

export const sendDigitalDownloadEmailWorkflow = createWorkflow(
  "send-digital-download-email",
  function (input: SendDigitalDownloadEmailWorkflowInput) {
    const linkResult = generateDownloadLinkStep({ storage_key: input.storage_key })

    // Solo mandamos el correo si de verdad se pudo generar el link firmado
    // (B2 configurado y el archivo respaldado existe). Si no, no hay nada
    // reintentable aqui: el administrador debe revisar manualmente.
    const sendResult = when(linkResult, (result) => result.ok).then(() => {
      return sendDigitalDownloadEmailStep({
        to: input.to,
        product_title: input.product_title,
        download_url: linkResult.url,
        expires_at: linkResult.expiresAt,
      })
    })

    // `when().then()` tipa el resultado como posiblemente undefined para la
    // rama no tomada, pero WorkflowResponse solo ve la referencia del grafo
    // construido, nunca un undefined en tiempo de ejecucion.
    return new WorkflowResponse(sendResult!)
  }
)
