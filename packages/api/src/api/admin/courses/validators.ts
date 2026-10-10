import { z } from "zod"
import { createFindParams, createOperatorMap } from "@medusajs/medusa/api/utils/validators"

export const AdminCreateCourse = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
  level: z.enum(["principiante", "intermedio", "avanzado"]).optional(),
  language: z.string().optional(),
  // producto vendible ya existente que representa este curso
  product_id: z.string().min(1),
})

export type AdminCreateCourseType = z.infer<typeof AdminCreateCourse>

export const AdminGetCoursesParams = createFindParams({
  limit: 20,
  offset: 0,
}).merge(
  z.object({
    slug: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.union([z.string(), z.array(z.string())]).optional(),
    created_at: createOperatorMap().optional(),
  })
)

export type AdminGetCoursesParamsType = z.infer<typeof AdminGetCoursesParams>
