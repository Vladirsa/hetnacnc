import { model } from "@medusajs/framework/utils"

import Enrollment from "./enrollment"

// lesson_id es columna plana: la lección vive en el módulo course (otro
// dominio), igual que customer_id/course_id en Enrollment.
const LessonProgress = model
  .define("lesson_progress", {
    id: model.id({ prefix: "lsnprg" }).primaryKey(),
    lesson_id: model.text(),
    completed_at: model.dateTime().nullable(),
    last_position_seconds: model.number().default(0),
    enrollment: model.belongsTo(() => Enrollment, { mappedBy: "progress_items" }),
  })
  .indexes([
    {
      on: ["enrollment_id", "lesson_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default LessonProgress
