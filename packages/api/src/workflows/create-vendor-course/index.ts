import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import type { LinkDefinition } from "@medusajs/framework/types"
import { createProductsWorkflow } from "@mercurjs/core/workflows"

import { COURSE_MODULE } from "../../modules/course"
import { createCourseStep, CreateCourseStepInput } from "../create-course/steps/create-course"

export type CreateVendorCourseWorkflowInput = Omit<CreateCourseStepInput, "seller_id"> & {
  seller_id: string
  // precio de acceso al curso, en la unidad menor de la moneda (ej. 499 = $499 MXN)
  price_amount: number
  currency_code?: string
}

export const createVendorCourseWorkflow = createWorkflow(
  "create-vendor-course",
  function (input: CreateVendorCourseWorkflowInput) {
    const productsInput = transform({ input }, ({ input }) => ({
      created_by: "vendor-course-panel",
      products: [
        {
          title: input.title,
          handle: input.slug,
          status: "published" as any,
          seller_ids: [input.seller_id],
          variants: [
            {
              title: "Acceso completo",
              prices: [{ currency_code: input.currency_code || "mxn", amount: input.price_amount }],
            } as any,
          ],
        } as any,
      ],
    }))

    const products = createProductsWorkflow.runAsStep({ input: productsInput })

    const course = createCourseStep(
      transform({ input }, ({ input }) => {
        const { price_amount, currency_code, ...courseInput } = input
        return courseInput
      })
    )

    const links = transform({ course, products }, ({ course, products }): LinkDefinition[] => [
      {
        [Modules.PRODUCT]: { product_id: products[0].id },
        [COURSE_MODULE]: { course_id: course.id },
      },
    ])
    createRemoteLinkStep(links)

    return new WorkflowResponse(
      transform({ course, products }, ({ course, products }) => ({ course, product: products[0] }))
    )
  }
)
