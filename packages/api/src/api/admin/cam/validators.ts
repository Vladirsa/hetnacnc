import { z } from "@medusajs/framework/zod"

export const CAM_STATUSES = ["received", "in_cart", "paid", "in_review", "delivered", "cancelled"] as const

export const AdminListCamJobsQuery = z.object({
  status: z.enum(CAM_STATUSES).optional(),
  order_id: z.string().optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
})

export const AdminUpdateCamJob = z.object({
  status: z.enum(CAM_STATUSES).optional(),
  tier: z.string().max(20).nullish(),
  internal_notes: z.string().max(5000).nullish(),
})
export type AdminUpdateCamJobType = z.infer<typeof AdminUpdateCamJob>

export const AdminAddCamDeliverables = z.object({
  mark_delivered: z.enum(["true", "false"]).optional(),
})
export type AdminAddCamDeliverablesType = z.infer<typeof AdminAddCamDeliverables>
