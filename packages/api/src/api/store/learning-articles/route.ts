import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { StoreGetLearningArticlesParamsType } from "./validators"
import { StoreLearningArticleListResponse } from "./types"
import { LearningArticleDTO } from "../../admin/learning-articles/types"

export const GET = async (
  req: MedusaRequest<unknown, StoreGetLearningArticlesParamsType>,
  res: MedusaResponse<StoreLearningArticleListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: learning_articles, metadata } = await query.graph({
    entity: "learning_article",
    fields: req.queryConfig.fields,
    filters: { published_at: { $ne: null } },
    pagination: req.queryConfig.pagination,
  })

  res.json({
    learning_articles: learning_articles as unknown as LearningArticleDTO[],
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  })
}
