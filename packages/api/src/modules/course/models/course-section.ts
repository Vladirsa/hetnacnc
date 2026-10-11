import { model } from "@medusajs/framework/utils"

import Course from "./course"
import Lesson from "./lesson"

const CourseSection = model
  .define("course_section", {
    id: model.id({ prefix: "crssec" }).primaryKey(),
    title: model.text(),
    position: model.number().default(0),
    course: model.belongsTo(() => Course, { mappedBy: "sections" }),
    lessons: model.hasMany(() => Lesson, { mappedBy: "section" }),
  })
  .cascades({ delete: ["lessons"] })

export default CourseSection
