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
  // Blog del foro: la sección del foro a la que pertenece (slug de
  // foro.secciones, p. ej. "diseno-cam") y si es la guía fija de esa sección.
  categoria: model.text().nullable(),
  guia: model.boolean().default(false),
  autor: model.text().nullable(),
})
