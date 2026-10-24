import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CAM_MODULE } from "../../../modules/cam"
import type CamModuleService from "../../../modules/cam/service"

export type ValidateCamJobForCartInput = {
  job_id: string
  access_token: string
  cart_id: string
}

/**
 * Comprueba que quien agrega el trabajo al carrito es su dueño (token) y que
 * el trabajo todavía se puede comprar.
 */
export const validateCamJobForCartStep = createStep(
  "validate-cam-job-for-cart",
  async (input: ValidateCamJobForCartInput, { container }) => {
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    const [job] = await camService.listCamJobs({ id: input.job_id }, { take: 1 })

    if (!job || job.access_token !== input.access_token) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Trabajo CAM no encontrado")
    }
    if (["paid", "in_review", "delivered", "cancelled"].includes(job.status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Este trabajo CAM ya fue pagado o cerrado"
      )
    }
    if (job.status === "in_cart" && job.cart_id === input.cart_id) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "Este trabajo CAM ya está en tu carrito"
      )
    }

    return new StepResponse(job)
  }
)
