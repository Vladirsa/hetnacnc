import { MedusaService } from "@medusajs/framework/utils"
import { LearningArticle } from "./models/learning-article"

class LearningModuleService extends MedusaService({
  LearningArticle,
}) {}

export default LearningModuleService
