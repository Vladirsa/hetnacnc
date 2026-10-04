import { z } from "zod"
import { createFindParams, createOperatorMap } from "@medusajs/medusa/api/utils/validators"

export const AdminCreateLearningArticle = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  content_html: z.string().min(1),
  cover_image_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  external_links: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  source: z.string().optional(),
  published: z.boolean().optional(),
})

export type AdminCreateLearningArticleType = z.infer<typeof AdminCreateLearningArticle>

export const AdminGetLearningArticlesParams = createFindParams({
  limit: 20,
  offset: 0,
}).merge(
  z.object({
    slug: z.union([z.string(), z.array(z.string())]).optional(),
    created_at: createOperatorMap().optional(),
  })
)

export type AdminGetLearningArticlesParamsType = z.infer<typeof AdminGetLearningArticlesParams>
