import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAM_MODULE } from "../../../../../modules/cam"
import type CamModuleService from "../../../../../modules/cam/service"
import { updateCamJobWorkflow } from "../../../../../workflows/cam/update-cam-job"
import type { AdminUpdateCamJobType } from "../../validators"

/** GET /admin/cam/jobs/:id */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const camService: CamModuleService = req.scope.resolve(CAM_MODULE)
  const { access_token: _t, ...job } = await camService.retrieveCamJob(req.params.id)
  res.json({ job })
}

/** POST /admin/cam/jobs/:id  { status?, tier?, internal_notes? } */
export async function POST(
  req: MedusaRequest<AdminUpdateCamJobType>,
  res: MedusaResponse
) {
  const { result } = await updateCamJobWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })
  const { access_token: _t, ...job } = result as unknown as Record<string, unknown>
  res.json({ job })
}
