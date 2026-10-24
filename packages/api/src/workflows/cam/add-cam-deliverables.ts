import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse, type WorkflowData } from "@medusajs/framework/workflows-sdk"
import { CAM_MODULE } from "../../modules/cam"
import type CamModuleService from "../../modules/cam/service"
import { notifyCamWebhookStep } from "./steps/notify-cam-webhook"
import { updateCamJobStep } from "./steps/update-cam-job"

export type AddCamDeliverablesInput = {
  job_id: string
  files: { filename: string; mimeType: string; content: string }[]
  mark_delivered: boolean
}

const getCamJobStep = createStep(
  "get-cam-job",
  async (input: { id: string }, { container }) => {
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    const job = await camService.retrieveCamJob(input.id)
    return new StepResponse(job)
  }
)

/**
 * Sube los archivos finales (programas revisados, posprocesador, hoja de
 * preparación) y los agrega a la lista de entregables del trabajo.
 */
export const addCamDeliverablesWorkflow = createWorkflow(
  "add-cam-deliverables",
  (input: WorkflowData<AddCamDeliverablesInput>) => {
    const job = getCamJobStep({ id: input.job_id })

    const files = transform({ input }, ({ input }) =>
      input.files.map((f) => ({ ...f, access: "private" as const }))
    )
    const uploaded = uploadFilesWorkflow.runAsStep({ input: { files } })

    const update = transform({ input, job, uploaded }, ({ input, job, uploaded }) => {
      const current = Array.isArray(job.deliverables) ? (job.deliverables as Record<string, unknown>[]) : []
      const added = uploaded.map((f, i) => ({
        id: f.id,
        url: f.url,
        name: input.files[i]?.filename ?? f.id,
      }))
      return {
        id: input.job_id,
        deliverables: [...current, ...added],
        ...(input.mark_delivered ? { status: "delivered" as const } : {}),
      }
    })
    const updated = updateCamJobStep(update)

    const notification = transform({ updated }, ({ updated }) => ({
      event: updated.status === "delivered" ? "cam_job.delivered" : "cam_job.files_added",
      jobs: [updated as unknown as Record<string, unknown>],
    }))
    notifyCamWebhookStep(notification)

    return new WorkflowResponse(updated)
  }
)
