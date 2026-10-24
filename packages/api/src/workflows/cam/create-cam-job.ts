import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { createCamJobStep, type CreateCamJobStepInput } from "./steps/create-cam-job"
import { notifyCamWebhookStep } from "./steps/notify-cam-webhook"

type IncomingFile = { filename: string; mimeType: string; content: string }

export type CreateCamJobWorkflowInput = {
  model: IncomingFile
  gcode?: IncomingFile | null
  job: Omit<CreateCamJobStepInput, "model_file_id" | "model_file_url" | "gcode_file_id" | "gcode_file_url">
}

/**
 * Guarda los archivos del cliente (modelo 3D y G-code) como privados y crea el
 * trabajo CAM. Si algo falla, los archivos subidos se borran solos.
 */
export const createCamJobWorkflow = createWorkflow(
  "create-cam-job",
  (input: WorkflowData<CreateCamJobWorkflowInput>) => {
    const files = transform({ input }, ({ input }) => {
      const list = [{ ...input.model, access: "private" as const }]
      if (input.gcode) {
        list.push({ ...input.gcode, access: "private" as const })
      }
      return list
    })

    const uploaded = uploadFilesWorkflow.runAsStep({ input: { files } })

    const jobData = transform({ input, uploaded }, ({ input, uploaded }) => ({
      ...input.job,
      model_file_id: uploaded[0]?.id ?? null,
      model_file_url: uploaded[0]?.url ?? null,
      gcode_file_id: uploaded[1]?.id ?? null,
      gcode_file_url: uploaded[1]?.url ?? null,
    }))

    const job = createCamJobStep(jobData)

    const notification = transform({ job }, ({ job }) => ({
      event: "cam_job.created",
      jobs: [job as unknown as Record<string, unknown>],
    }))
    notifyCamWebhookStep(notification)

    return new WorkflowResponse(job)
  }
)
