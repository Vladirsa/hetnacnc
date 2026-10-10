import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { StoreGetCourseParamsType } from "../validators"
import { StoreCourseDTO, StoreCourseResponse } from "../types"

export const GET = async (
  req: MedusaRequest<unknown, StoreGetCourseParamsType>,
  res: MedusaResponse<StoreCourseResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [course],
  } = await query.graph({
    entity: "course",
    fields: req.queryConfig.fields,
    filters: { slug: req.params.slug, status: "published" },
  })

  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with slug "${req.params.slug}" not found`)
  }

  const result = course as unknown as StoreCourseDTO
  if (result.sections) {
    result.sections = [...result.sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ ...s, lessons: [...s.lessons].sort((a, b) => a.position - b.position) }))
  }

  res.json({ course: result })
}
