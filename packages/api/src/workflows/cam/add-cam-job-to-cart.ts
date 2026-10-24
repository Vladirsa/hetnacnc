import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { resolveCamLineItemsStep } from "./steps/resolve-cam-line-items"
import { updateCamJobStep } from "./steps/update-cam-job"
import { validateCamJobForCartStep } from "./steps/validate-cam-job-for-cart"

export type AddCamJobToCartInput = {
  job_id: string
  access_token: string
  cart_id: string
  review: boolean
}

/**
 * Agrega el servicio CAM al carrito: elige la variante por complejidad,
 * guarda el id del trabajo en la línea y deja el trabajo en estado "in_cart".
 */
export const addCamJobToCartWorkflow = createWorkflow(
  "add-cam-job-to-cart",
  (input: WorkflowData<AddCamJobToCartInput>) => {
    const job = validateCamJobForCartStep({
      job_id: input.job_id,
      access_token: input.access_token,
      cart_id: input.cart_id,
    })

    const items = resolveCamLineItemsStep({ job, review: input.review })

    addToCartWorkflow.runAsStep({
      input: { cart_id: input.cart_id, items },
    })

    const update = transform({ input }, ({ input }) => ({
      id: input.job_id,
      status: "in_cart" as const,
      cart_id: input.cart_id,
      review_requested: input.review,
    }))
    const updated = updateCamJobStep(update)

    return new WorkflowResponse(updated)
  }
)
