import { model } from "@medusajs/framework/utils"

export const LearningArticle = model.define("learning_article", {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  title: model.text(),
  excerpt: model.text(),
  content_html: model.text(),
  cover_image_url: model.text().nullable(),
  video_url: model.text().nullable(),
  external_links: model.json().nullable(),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
  source: model.text().default("manual"),
  published_at: model.dateTime().nullable(),
})
