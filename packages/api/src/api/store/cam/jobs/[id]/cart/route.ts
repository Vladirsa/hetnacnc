import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addCamJobToCartWorkflow } from "../../../../../../workflows/cam/add-cam-job-to-cart"
import { toStoreJob } from "../../../helpers"
import type { StoreAddCamJobToCartType } from "../../../validators"

/**
 * POST /store/cam/jobs/:id/cart  { cart_id, access_token, review }
 * El precio sale de la variante del producto de servicio (editable en el admin),
 * nunca del navegador.
 */
export async function POST(
  req: MedusaRequest<StoreAddCamJobToCartType>,
  res: MedusaResponse
) {
  const { result } = await addCamJobToCartWorkflow(req.scope).run({
    input: {
      job_id: req.params.id,
      access_token: req.validatedBody.access_token,
      cart_id: req.validatedBody.cart_id,
      review: req.validatedBody.review,
    },
  })
  res.json({ job: toStoreJob(result as unknown as Record<string, unknown>), cart_id: req.validatedBody.cart_id })
}
