import { PaginatedResponse } from "@medusajs/framework/types"
import { LearningArticleDTO } from "../../admin/learning-articles/types"

export interface StoreLearningArticleResponse {
  learning_article: LearningArticleDTO
}

export type StoreLearningArticleListResponse = PaginatedResponse<{
  learning_articles: LearningArticleDTO[]
}>
