import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { COURSE_MODULE } from "../../../modules/course"
import CourseModuleService from "../../../modules/course/service"

export type CreateCourseStepInput = {
  title: string
  slug: string
  description?: string | null
  thumbnail_url?: string | null
  level?: "principiante" | "intermedio" | "avanzado"
  language?: string
  seller_id?: string | null
}

export const createCourseStep = createStep(
  "create-course-step",
  async (input: CreateCourseStepInput, { container }) => {
    const courseModuleService = container.resolve<CourseModuleService>(COURSE_MODULE)

    const course = await courseModuleService.createCourses(input)

    return new StepResponse(course, course.id)
  },
  async (courseId: string | undefined, { container }) => {
    if (!courseId) return

    const courseModuleService = container.resolve<CourseModuleService>(COURSE_MODULE)
    await courseModuleService.deleteCourses(courseId)
  }
)
