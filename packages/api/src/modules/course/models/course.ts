import { model } from "@medusajs/framework/utils"

import CourseSection from "./course-section"

const Course = model
  .define("course", {
    id: model.id({ prefix: "course" }).primaryKey(),
    // Denormalizado desde el seller del producto vinculado al crear el curso:
    // query.graph no resuelve un segundo salto de link (course -> product ->
    // seller), asi que guardamos el seller_id aqui para poder filtrar "mis
    // cursos" en el panel de vendedor sin el Index Module.
    seller_id: model.text().nullable(),
    title: model.text().searchable(),
    slug: model.text().unique(),
    description: model.text().nullable(),
    thumbnail_url: model.text().nullable(),
    level: model.enum(["principiante", "intermedio", "avanzado"]).default("principiante"),
    language: model.text().default("es"),
    status: model.enum(["draft", "published"]).default("draft"),
    published_at: model.dateTime().nullable(),
    sections: model.hasMany(() => CourseSection, { mappedBy: "course" }),
  })
  .cascades({ delete: ["sections"] })

export default Course
