import { z } from "zod"
import { createFindParams, createSelectParams } from "@medusajs/medusa/api/utils/validators"

export const StoreGetCoursesParams = createFindParams({
  limit: 12,
  offset: 0,
})
export type StoreGetCoursesParamsType = z.infer<typeof StoreGetCoursesParams>

export const StoreGetCourseParams = createSelectParams()
export type StoreGetCourseParamsType = z.infer<typeof StoreGetCourseParams>
