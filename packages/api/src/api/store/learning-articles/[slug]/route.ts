import { MedusaError } from "@medusajs/framework/utils"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { StoreGetLearningArticleParamsType } from "../validators"
import { StoreLearningArticleResponse } from "../types"
import { LearningArticleDTO } from "../../../admin/learning-articles/types"

export const GET = async (
  req: MedusaRequest<unknown, StoreGetLearningArticleParamsType>,
  res: MedusaResponse<StoreLearningArticleResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [learning_article],
  } = await query.graph({
    entity: "learning_article",
    fields: req.queryConfig.fields,
    filters: { slug: req.params.slug, published_at: { $ne: null } },
  })

  if (!learning_article) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Learning article with slug "${req.params.slug}" not found`
    )
  }

  res.json({ learning_article: learning_article as unknown as LearningArticleDTO })
}
