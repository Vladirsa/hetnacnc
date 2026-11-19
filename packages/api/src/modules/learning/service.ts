import { MedusaService } from "@medusajs/framework/utils"
import { LearningArticle } from "./models/learning-article"
import { LearningResource } from "./models/learning-resource"

class LearningModuleService extends MedusaService({
  LearningArticle,
  LearningResource,
}) {}

export default LearningModuleService
