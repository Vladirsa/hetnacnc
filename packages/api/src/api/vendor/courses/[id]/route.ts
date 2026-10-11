import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"

import { COURSE_MODULE } from "../../../../modules/course"
import CourseModuleService from "../../../../modules/course/service"
import { VendorUpdateCourseType } from "../validators"
import { VendorCourseResponse, VendorCourseDTO } from "../types"
import { VendorRequest } from "../vendor-request"

export const GET = async (req: VendorRequest, res: MedusaResponse<VendorCourseResponse>) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [course],
  } = await query.graph({
    entity: "course",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id, seller_id: req.seller_context!.seller_id },
  })

  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }

  res.json({ course: course as unknown as VendorCourseDTO })
}

export const POST = async (
  req: VendorRequest<VendorUpdateCourseType>,
  res: MedusaResponse<VendorCourseResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const [existing] = await courseModuleService.listCourses({
    id: req.params.id,
    seller_id: req.seller_context!.seller_id,
  })
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }

  const body = req.validatedBody
  const updateData: Record<string, unknown> = { id: req.params.id, ...body }
  if (body.status === "published" && !existing.published_at) {
    updateData.published_at = new Date()
  }

  const course = await courseModuleService.updateCourses(updateData as any)

  res.json({ course: course as unknown as VendorCourseDTO })
}
