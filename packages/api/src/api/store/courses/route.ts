import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { StoreGetCoursesParamsType } from "./validators"
import { StoreCourseDTO, StoreCourseListResponse } from "./types"
import { enriquecerCursos } from "../../../lib/cursos"

export const GET = async (
  req: MedusaRequest<unknown, StoreGetCoursesParamsType>,
  res: MedusaResponse<StoreCourseListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: courses, metadata } = await query.graph({
    entity: "course",
    fields: req.queryConfig.fields,
    filters: { status: "published" },
    pagination: req.queryConfig.pagination,
  })

  res.json({
    courses: (await enriquecerCursos(req.scope, courses as any[])) as unknown as StoreCourseDTO[],
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  })
}
