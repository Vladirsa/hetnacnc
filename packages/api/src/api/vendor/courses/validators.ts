import { z } from "zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const VendorCreateCourse = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
  level: z.enum(["principiante", "intermedio", "avanzado"]).optional(),
  language: z.string().optional(),
  // precio de acceso al curso, en pesos (ej. 499 = $499 MXN)
  price_amount: z.number().positive(),
})
export type VendorCreateCourseType = z.infer<typeof VendorCreateCourse>

export const VendorUpdateCourse = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  level: z.enum(["principiante", "intermedio", "avanzado"]).optional(),
  language: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
})
export type VendorUpdateCourseType = z.infer<typeof VendorUpdateCourse>

export const VendorGetCoursesParams = createFindParams({
  limit: 20,
  offset: 0,
})
export type VendorGetCoursesParamsType = z.infer<typeof VendorGetCoursesParams>

export const VendorCreateSection = z.object({
  title: z.string().min(1),
  position: z.number().int().nonnegative().optional(),
})
export type VendorCreateSectionType = z.infer<typeof VendorCreateSection>

export const VendorUpdateSection = z.object({
  title: z.string().min(1).optional(),
  position: z.number().int().nonnegative().optional(),
})
export type VendorUpdateSectionType = z.infer<typeof VendorUpdateSection>

export const VendorCreateLesson = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  duration_seconds: z.number().int().positive().optional(),
  is_preview: z.boolean().optional(),
})
export type VendorCreateLessonType = z.infer<typeof VendorCreateLesson>

export const VendorUpdateLesson = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
  duration_seconds: z.number().int().positive().nullable().optional(),
  is_preview: z.boolean().optional(),
})
export type VendorUpdateLessonType = z.infer<typeof VendorUpdateLesson>
