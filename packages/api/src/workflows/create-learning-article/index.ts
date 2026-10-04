import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createLearningArticleStep,
  CreateLearningArticleStepInput,
} from "./steps/create-learning-article"

export const createLearningArticleWorkflow = createWorkflow(
  "create-learning-article",
  function (input: CreateLearningArticleStepInput) {
    const article = createLearningArticleStep(input)

    return new WorkflowResponse(article)
  }
)
