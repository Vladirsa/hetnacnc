import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { LEARNING_MODULE } from "../../../modules/learning"

export type CreateLearningArticleStepInput = {
  slug: string
  title: string
  excerpt: string
  content_html: string
  cover_image_url?: string | null
  video_url?: string | null
  external_links?: { label: string; url: string }[] | null
  seo_title?: string | null
  seo_description?: string | null
  source?: string
  published_at?: string | null
}

export const createLearningArticleStep = createStep(
  "create-learning-article-step",
  async (input: CreateLearningArticleStepInput, { container }) => {
    const learningModuleService = container.resolve(LEARNING_MODULE) as any

    // external_links is a flat array stored in a JSON column; the generated
    // service types that column as a generic object, so it needs a cast here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const article = await learningModuleService.createLearningArticles(input as any)

    return new StepResponse(article, article.id)
  },
  async (articleId: string | undefined, { container }) => {
    if (!articleId) return

    const learningModuleService = container.resolve(LEARNING_MODULE) as any
    await learningModuleService.deleteLearningArticles(articleId)
  }
)
