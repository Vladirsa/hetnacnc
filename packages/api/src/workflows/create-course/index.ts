import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import type { LinkDefinition } from "@medusajs/framework/types"

import { COURSE_MODULE } from "../../modules/course"
import { createCourseStep, CreateCourseStepInput } from "./steps/create-course"

export type CreateCourseWorkflowInput = CreateCourseStepInput & {
  // el producto vendible ya existente (creado por el flujo normal de
  // productos de Mercur) que este curso representa - un instructor es el
  // seller de ese producto, igual que con cualquier otro producto.
  product_id: string
}

export const createCourseWorkflow = createWorkflow(
  "create-course",
  function (input: CreateCourseWorkflowInput) {
    const { product_id, ...courseInput } = input
    const course = createCourseStep(courseInput)

    const links = transform({ course, product_id }, ({ course, product_id }): LinkDefinition[] => [
      {
        [Modules.PRODUCT]: { product_id },
        [COURSE_MODULE]: { course_id: course.id },
      },
    ])
    createRemoteLinkStep(links)

    return new WorkflowResponse(course)
  }
)
