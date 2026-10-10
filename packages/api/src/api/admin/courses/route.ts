import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { createCourseWorkflow } from "../../../workflows/create-course"
import { AdminCreateCourseType, AdminGetCoursesParamsType } from "./validators"
import { AdminCourseListResponse, AdminCourseResponse, CourseDTO } from "./types"

export const GET = async (
  req: AuthenticatedMedusaRequest<AdminGetCoursesParamsType>,
  res: MedusaResponse<AdminCourseListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: courses, metadata } = await query.graph({
    entity: "course",
    fields: req.queryConfig.fields,
    filters: req.filterableFields,
    pagination: req.queryConfig.pagination,
  })

  res.json({
    courses: courses as unknown as CourseDTO[],
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateCourseType>,
  res: MedusaResponse<AdminCourseResponse>
) => {
  const { result } = await createCourseWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json({ course: result as unknown as CourseDTO })
}
