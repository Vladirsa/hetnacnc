import { z } from "@medusajs/framework/zod"

const StatsSchema = z
  .object({
    minutes: z.number().nonnegative(),
    points: z.number().int().nonnegative(),
    triangles: z.number().int().nonnegative(),
    collisions: z.number().int().nonnegative(),
    adjusted: z.number().int().nonnegative(),
    cut_length_m: z.number().nonnegative(),
    gcode_lines: z.number().int().nonnegative(),
  })
  .partial()

export const CamJobPayloadSchema = z.object({
  service: z.enum(["cam", "post"]).default("cam"),
  review: z.boolean().default(false),
  email: z.string().email().max(200).nullish(),
  notes: z.string().max(2000).nullish(),
  model_name: z.string().min(1).max(200),
  controller: z.string().max(40).nullish(),
  kinematics: z.string().max(40).nullish(),
  strategy_kind: z.string().max(10).nullish(),
  config: z.record(z.string(), z.unknown()),
  stats: StatsSchema.nullish(),
})

export type CamJobPayload = z.infer<typeof CamJobPayloadSchema>

/**
 * El formulario llega como multipart: los archivos van aparte (cam-multipart) y el
 * resto viaja como texto JSON en el campo `payload`.
 */
export const StoreCreateCamJob = z.object({
  payload: z
    .string()
    .max(400000)
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown
      } catch {
        ctx.addIssue({ code: "custom", message: "payload no es JSON válido" })
        return z.NEVER
      }
    })
    .pipe(CamJobPayloadSchema),
})
export type StoreCreateCamJobType = z.infer<typeof StoreCreateCamJob>

export const StoreAddCamJobToCart = z.object({
  cart_id: z.string().min(1),
  access_token: z.string().min(16),
  review: z.boolean().default(false),
})
export type StoreAddCamJobToCartType = z.infer<typeof StoreAddCamJobToCart>

export const StoreGetCamJobQuery = z.object({
  token: z.string().min(16),
})
