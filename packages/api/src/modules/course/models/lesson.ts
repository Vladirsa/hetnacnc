import { model } from "@medusajs/framework/utils"

import CourseSection from "./course-section"

// video_provider/video_asset_id apuntan a un proveedor externo de streaming
// (Mux, Cloudflare Stream, Bunny, etc.) - este módulo no aloja video, solo
// guarda la referencia. is_preview marca lecciones que cualquiera puede ver
// sin haberse inscrito (gancho de venta).
const Lesson = model.define("lesson", {
  id: model.id({ prefix: "lesson" }).primaryKey(),
  title: model.text(),
  description: model.text().nullable(),
  position: model.number().default(0),
  video_provider: model.text().nullable(),
  video_asset_id: model.text().nullable(),
  duration_seconds: model.number().nullable(),
  is_preview: model.boolean().default(false),
  section: model.belongsTo(() => CourseSection, { mappedBy: "lessons" }),
})

export default Lesson
