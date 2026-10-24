import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CAM_MODULE } from "../../../modules/cam"
import type CamModuleService from "../../../modules/cam/service"

type PreviousState = { id: string; status: string; order_id: string | null; paid_at: Date | null }

/**
 * Busca en el pedido las líneas que traen `cam_job_id` y marca esos trabajos
 * como pagados, guardando el pedido, el cliente y su correo.
 */
export const markCamJobsPaidStep = createStep(
  "mark-cam-jobs-paid",
  async (input: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const camService: CamModuleService = container.resolve(CAM_MODULE)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "email", "customer_id", "items.id", "items.metadata"],
      filters: { id: input.order_id },
    })
    const order = orders[0]
    if (!order) {
      return new StepResponse([], [] as PreviousState[])
    }

    const jobIds = Array.from(
      new Set(
        (order.items ?? [])
          .map((item) => (item?.metadata as Record<string, unknown> | null)?.cam_job_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    )
    if (!jobIds.length) {
      return new StepResponse([], [] as PreviousState[])
    }

    const existing = await camService.listCamJobs({ id: jobIds })
    const previous: PreviousState[] = existing.map((j) => ({
      id: j.id,
      status: j.status,
      order_id: j.order_id,
      paid_at: j.paid_at,
    }))

    const now = new Date()
    const updated = await camService.updateCamJobs(
      existing.map((j) => ({
        id: j.id,
        status: "paid" as const,
        order_id: order.id,
        paid_at: now,
        customer_id: j.customer_id ?? order.customer_id ?? null,
        email: j.email ?? order.email ?? null,
      }))
    )

    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (!previous?.length) {
      return
    }
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    await camService.updateCamJobs(
      previous.map((p) => ({
        id: p.id,
        status: p.status as "received",
        order_id: p.order_id,
        paid_at: p.paid_at,
      }))
    )
  }
)
