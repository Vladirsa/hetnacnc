import { MedusaService } from "@medusajs/framework/utils"

import Enrollment from "./models/enrollment"
import LessonProgress from "./models/lesson-progress"

class EnrollmentModuleService extends MedusaService({
  Enrollment,
  LessonProgress,
}) {}

export default EnrollmentModuleService
