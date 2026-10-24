import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CAM_MODULE } from "../../../modules/cam"
import type CamModuleService from "../../../modules/cam/service"

export type UpdateCamJobStepInput = {
  id: string
  status?: "received" | "in_cart" | "paid" | "in_review" | "delivered" | "cancelled"
  tier?: string | null
  cart_id?: string | null
  order_id?: string | null
  customer_id?: string | null
  email?: string | null
  review_requested?: boolean
  internal_notes?: string | null
  deliverables?: Record<string, unknown>[] | null
}

/**
 * Actualiza un trabajo CAM. Las fechas de pago y entrega se ponen aquí (no en
 * el constructor del workflow) cuando el estado cambia.
 */
export const updateCamJobStep = createStep(
  "update-cam-job",
  async (input: UpdateCamJobStepInput, { container }) => {
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    const previous = await camService.retrieveCamJob(input.id)

    const data: Record<string, unknown> = { ...input }
    if (input.status === "delivered" && previous.status !== "delivered") {
      data.delivered_at = new Date()
    }
    if (input.status === "paid" && previous.status !== "paid") {
      data.paid_at = new Date()
    }

    const job = await camService.updateCamJobs(data as { id: string })
    return new StepResponse(job, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    await camService.updateCamJobs({
      id: previous.id,
      status: previous.status,
      tier: previous.tier,
      cart_id: previous.cart_id,
      order_id: previous.order_id,
      customer_id: previous.customer_id,
      email: previous.email,
      review_requested: previous.review_requested,
      internal_notes: previous.internal_notes,
      deliverables: previous.deliverables,
      paid_at: previous.paid_at,
      delivered_at: previous.delivered_at,
    })
  }
)
