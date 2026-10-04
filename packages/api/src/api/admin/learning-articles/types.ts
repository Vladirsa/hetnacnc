import { PaginatedResponse } from "@medusajs/framework/types"

export type LearningArticleDTO = {
  id: string
  slug: string
  title: string
  excerpt: string
  content_html: string
  cover_image_url: string | null
  video_url: string | null
  external_links: { label: string; url: string }[] | null
  seo_title: string | null
  seo_description: string | null
  source: string
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminLearningArticleResponse {
  learning_article: LearningArticleDTO
}

export type AdminLearningArticleListResponse = PaginatedResponse<{
  learning_articles: LearningArticleDTO[]
}>
