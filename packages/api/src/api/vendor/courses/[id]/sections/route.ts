import { MedusaError } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"

import { COURSE_MODULE } from "../../../../../modules/course"
import CourseModuleService from "../../../../../modules/course/service"
import { VendorCreateSectionType } from "../../validators"
import { VendorCourseSectionResponse, VendorCourseSectionDTO } from "../../types"
import { VendorRequest } from "../../vendor-request"

export const POST = async (
  req: VendorRequest<VendorCreateSectionType>,
  res: MedusaResponse<VendorCourseSectionResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const [course] = await courseModuleService.listCourses({
    id: req.params.id,
    seller_id: req.seller_context!.seller_id,
  })
  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }

  const section = await courseModuleService.createCourseSections({
    ...req.validatedBody,
    course_id: req.params.id,
  } as any)

  res.json({ section: { ...section, lessons: [] } as unknown as VendorCourseSectionDTO })
}
