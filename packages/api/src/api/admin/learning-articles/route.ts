import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { createLearningArticleWorkflow } from "../../../workflows/create-learning-article"
import {
  AdminCreateLearningArticleType,
  AdminGetLearningArticlesParamsType,
} from "./validators"
import {
  AdminLearningArticleListResponse,
  AdminLearningArticleResponse,
  LearningArticleDTO,
} from "./types"

export const GET = async (
  req: AuthenticatedMedusaRequest<AdminGetLearningArticlesParamsType>,
  res: MedusaResponse<AdminLearningArticleListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: learning_articles, metadata } = await query.graph({
    entity: "learning_article",
    fields: req.queryConfig.fields,
    filters: req.filterableFields,
    pagination: req.queryConfig.pagination,
  })

  res.json({
    learning_articles: learning_articles as unknown as LearningArticleDTO[],
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateLearningArticleType>,
  res: MedusaResponse<AdminLearningArticleResponse>
) => {
  const { published, ...rest } = req.validatedBody

  const { result } = await createLearningArticleWorkflow(req.scope).run({
    input: {
      ...rest,
      published_at: published === false ? null : new Date().toISOString(),
    },
  })

  res.json({ learning_article: result as unknown as LearningArticleDTO })
}
