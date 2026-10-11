import { MedusaError } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"

import { COURSE_MODULE } from "../../../../../../../../modules/course"
import CourseModuleService from "../../../../../../../../modules/course/service"
import { VendorUpdateLessonType } from "../../../../../validators"
import { VendorLessonResponse, VendorLessonDTO } from "../../../../../types"
import { VendorRequest } from "../../../../../vendor-request"

const assertOwnedLesson = async (
  courseModuleService: CourseModuleService,
  courseId: string,
  sectionId: string,
  lessonId: string,
  sellerId: string
) => {
  const [course] = await courseModuleService.listCourses({ id: courseId, seller_id: sellerId })
  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${courseId}" not found`)
  }
  const [section] = await courseModuleService.listCourseSections({ id: sectionId, course_id: courseId })
  if (!section) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Section with id "${sectionId}" not found`)
  }
  const [lesson] = await courseModuleService.listLessons({ id: lessonId, section_id: sectionId })
  if (!lesson) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Lesson with id "${lessonId}" not found`)
  }
  return lesson
}

export const POST = async (
  req: VendorRequest<VendorUpdateLessonType>,
  res: MedusaResponse<VendorLessonResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  await assertOwnedLesson(
    courseModuleService,
    req.params.id,
    req.params.sectionId,
    req.params.lessonId,
    req.seller_context!.seller_id
  )

  const lesson = await courseModuleService.updateLessons({
    id: req.params.lessonId,
    ...req.validatedBody,
  } as any)

  res.json({ lesson: lesson as unknown as VendorLessonDTO })
}

export const DELETE = async (req: VendorRequest, res: MedusaResponse<{ id: string; deleted: boolean }>) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  await assertOwnedLesson(
    courseModuleService,
    req.params.id,
    req.params.sectionId,
    req.params.lessonId,
    req.seller_context!.seller_id
  )

  await courseModuleService.deleteLessons(req.params.lessonId)

  res.json({ id: req.params.lessonId, deleted: true })
}
