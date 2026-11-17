import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CAM_MODULE } from "../../../modules/cam"
import type CamModuleService from "../../../modules/cam/service"
import { CAM_PRODUCT_HANDLES, CAM_TIER_OPTION, TIERED_SERVICES, type CamService } from "../../../modules/cam/catalog"

type PreviousState = { id: string; status: string; order_id: string | null; paid_at: Date | null }

type ProductoCam = { handle?: string | null; variants?: { id: string; options?: { value?: string | null; option?: { title?: string | null } | null }[] | null }[] | null }
type LineaCam = { metadata?: unknown; variant_id?: string | null } | null | undefined

/** Trabajos que este pedido de verdad paga: línea del producto y nivel del servicio, y trabajo en el carrito. */
export function trabajosPagables<T extends { id: string; status: string; service: string; tier: string | null }>(
  candidatos: T[],
  lineas: LineaCam[],
  productos: ProductoCam[]
): T[] {
  const varianteOk = (job: T, variantId?: string | null) => {
    const prod = productos.find((p) => p.handle === CAM_PRODUCT_HANDLES[job.service as CamService])
    const v = (prod?.variants ?? []).find((x) => x.id === variantId)
    if (!v) return false
    if (!TIERED_SERVICES.includes(job.service as CamService) || !job.tier) return true
    return (v.options ?? []).some((o) => o?.option?.title === CAM_TIER_OPTION && o?.value === job.tier)
  }
  return candidatos.filter(
    (j) =>
      j.status === "in_cart" &&
      lineas.some((it) => {
        const m = (it?.metadata || {}) as Record<string, unknown>
        return m.cam_job_id === j.id && m.cam_addon !== "review" && varianteOk(j, it?.variant_id)
      })
  )
}

/**
 * Busca en el pedido las líneas que traen `cam_job_id` y marca esos trabajos
 * como pagados, guardando el pedido, el cliente y su correo.
 *
 * La línea tiene que ser del producto de ese servicio y del nivel del trabajo,
 * y el trabajo tiene que estar en el carrito: el carrito de Mercur acepta
 * metadata libre, así que antes bastaba poner cam_job_id en la línea de
 * cualquier producto barato para dejar pagado un trabajo de 5 ejes
 * (auditoría Thermos, 15 nov 2026).
 */
export const markCamJobsPaidStep = createStep(
  "mark-cam-jobs-paid",
  async (input: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const camService: CamModuleService = container.resolve(CAM_MODULE)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "email", "customer_id", "items.id", "items.metadata", "items.variant_id", "items.product_handle"],
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

    const candidatos = await camService.listCamJobs({ id: jobIds })

    // Variantes válidas de cada servicio (y su nivel)
    const { data: productos } = await query.graph({
      entity: "product",
      fields: ["handle", "variants.id", "variants.options.value", "variants.options.option.title"],
      filters: { handle: Object.values(CAM_PRODUCT_HANDLES) },
    })
    const existing = trabajosPagables(candidatos, order.items ?? [], productos as ProductoCam[])
    if (existing.length < candidatos.length) {
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
      const fuera = candidatos.filter((c) => !existing.includes(c)).map((c) => `${c.id} (${c.status})`)
      logger.warn(`[cam] pedido ${order.id}: no se marcan pagados ${fuera.join(", ")}: la línea no es del servicio/nivel del trabajo o no estaba en el carrito`)
    }
    if (!existing.length) {
      return new StepResponse([], [] as PreviousState[])
    }
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
