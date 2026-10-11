import { MedusaError } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"

import { COURSE_MODULE } from "../../../../../../modules/course"
import CourseModuleService from "../../../../../../modules/course/service"
import { VendorUpdateSectionType } from "../../../validators"
import { VendorCourseSectionResponse, VendorCourseSectionDTO } from "../../../types"
import { VendorRequest } from "../../../vendor-request"

const assertOwnedSection = async (
  courseModuleService: CourseModuleService,
  courseId: string,
  sectionId: string,
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
  return section
}

export const POST = async (
  req: VendorRequest<VendorUpdateSectionType>,
  res: MedusaResponse<VendorCourseSectionResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  await assertOwnedSection(courseModuleService, req.params.id, req.params.sectionId, req.seller_context!.seller_id)

  const section = await courseModuleService.updateCourseSections({
    id: req.params.sectionId,
    ...req.validatedBody,
  } as any)

  res.json({ section: section as unknown as VendorCourseSectionDTO })
}

export const DELETE = async (req: VendorRequest, res: MedusaResponse<{ id: string; deleted: boolean }>) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  await assertOwnedSection(courseModuleService, req.params.id, req.params.sectionId, req.seller_context!.seller_id)

  await courseModuleService.deleteCourseSections(req.params.sectionId)

  res.json({ id: req.params.sectionId, deleted: true })
}
