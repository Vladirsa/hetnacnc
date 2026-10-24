import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { notifyCamWebhookStep } from "./steps/notify-cam-webhook"
import { updateCamJobStep, type UpdateCamJobStepInput } from "./steps/update-cam-job"

/** Cambios hechos desde el admin: estado, nivel y notas internas. */
export const updateCamJobWorkflow = createWorkflow(
  "update-cam-job",
  (input: WorkflowData<UpdateCamJobStepInput>) => {
    const job = updateCamJobStep(input)

    const notification = transform({ job }, ({ job }) => ({
      event: `cam_job.${job.status}`,
      jobs: [job as unknown as Record<string, unknown>],
    }))
    notifyCamWebhookStep(notification)

    return new WorkflowResponse(job)
  }
)
