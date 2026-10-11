import { MedusaService } from "@medusajs/framework/utils"

import Course from "./models/course"
import CourseSection from "./models/course-section"
import Lesson from "./models/lesson"

class CourseModuleService extends MedusaService({
  Course,
  CourseSection,
  Lesson,
}) {}

export default CourseModuleService
