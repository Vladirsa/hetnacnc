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
  // Artículos de instructores (talleres): quién lo escribió y su revisión.
  // revision: null = no necesita (o ya aprobado) | "pendiente" | "rechazado".
  // aprobado_at: primera aprobación; cuenta para bajar la comisión de cursos
  // (lib/comision-autores.ts) y no cambia al editar.
  seller_id: model.text().nullable(),
  revision: model.text().nullable(),
  motivo_revision: model.text().nullable(),
  aprobado_at: model.dateTime().nullable(),
  // texto simple que escribió el taller (para volver a editarlo); el HTML se arma de aquí
  texto_original: model.text().nullable(),
})
