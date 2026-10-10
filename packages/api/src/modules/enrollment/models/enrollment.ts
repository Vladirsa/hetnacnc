import { model } from "@medusajs/framework/utils"

import LessonProgress from "./lesson-progress"

// customer_id / course_id / order_id son columnas planas (igual que seller_id
// en Offer): referencian otros módulos por id, sin relación de base de datos.
// El cruce real para Query (enrollment.customer.*, etc.) vive en src/links/,
// no aquí - ver "How to Link Two Modules" en los docs de Mercur.
const Enrollment = model
  .define("enrollment", {
    id: model.id({ prefix: "enr" }).primaryKey(),
    customer_id: model.text(),
    course_id: model.text(),
    order_id: model.text().nullable(),
    enrolled_at: model.dateTime(),
    progress_items: model.hasMany(() => LessonProgress, { mappedBy: "enrollment" }),
  })
  .cascades({ delete: ["progress_items"] })
  .indexes([
    {
      on: ["customer_id", "course_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default Enrollment
