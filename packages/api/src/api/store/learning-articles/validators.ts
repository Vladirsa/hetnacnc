import { z } from "zod"
import { createFindParams, createSelectParams } from "@medusajs/medusa/api/utils/validators"

export const StoreGetLearningArticlesParams = createFindParams({
  limit: 12,
  offset: 0,
})

export type StoreGetLearningArticlesParamsType = z.infer<typeof StoreGetLearningArticlesParams>

export const StoreGetLearningArticleParams = createSelectParams()
export type StoreGetLearningArticleParamsType = z.infer<typeof StoreGetLearningArticleParams>
