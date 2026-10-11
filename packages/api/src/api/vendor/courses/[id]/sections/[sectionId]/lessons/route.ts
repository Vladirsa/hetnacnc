import { MedusaError } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"

import { COURSE_MODULE } from "../../../../../../../modules/course"
import CourseModuleService from "../../../../../../../modules/course/service"
import { VendorCreateLessonType } from "../../../../validators"
import { VendorLessonResponse, VendorLessonDTO } from "../../../../types"
import { VendorRequest } from "../../../../vendor-request"

export const POST = async (
  req: VendorRequest<VendorCreateLessonType>,
  res: MedusaResponse<VendorLessonResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const [course] = await courseModuleService.listCourses({
    id: req.params.id,
    seller_id: req.seller_context!.seller_id,
  })
  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }
  const [section] = await courseModuleService.listCourseSections({
    id: req.params.sectionId,
    course_id: req.params.id,
  })
  if (!section) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Section with id "${req.params.sectionId}" not found`)
  }

  const lesson = await courseModuleService.createLessons({
    ...req.validatedBody,
    section_id: req.params.sectionId,
  } as any)

  res.json({ lesson: lesson as unknown as VendorLessonDTO })
}
