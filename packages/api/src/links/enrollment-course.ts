import { defineLink } from "@medusajs/framework/utils"

import CourseModule from "../modules/course"
import EnrollmentModule from "../modules/enrollment"

// Muchas inscripciones por curso.
export default defineLink(
  { linkable: EnrollmentModule.linkable.enrollment, isList: true },
  CourseModule.linkable.course
)
