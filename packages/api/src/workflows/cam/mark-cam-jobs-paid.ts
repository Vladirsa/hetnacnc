import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { markCamJobsPaidStep } from "./steps/mark-cam-jobs-paid"
import { notifyCamWebhookStep } from "./steps/notify-cam-webhook"

/** Se ejecuta cuando se crea un pedido: marca como pagados sus trabajos CAM. */
export const markCamJobsPaidWorkflow = createWorkflow(
  "mark-cam-jobs-paid",
  (input: WorkflowData<{ order_id: string }>) => {
    const jobs = markCamJobsPaidStep(input)

    const notification = transform({ jobs }, ({ jobs }) => ({
      event: "cam_job.paid",
      jobs: jobs as unknown as Record<string, unknown>[],
    }))
    notifyCamWebhookStep(notification)

    return new WorkflowResponse(jobs)
  }
)
