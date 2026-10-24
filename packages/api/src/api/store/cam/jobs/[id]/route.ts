import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CAM_MODULE } from "../../../../../modules/cam"
import type CamModuleService from "../../../../../modules/cam/service"
import { tokensMatch, toStoreJob } from "../../helpers"
import { StoreGetCamJobQuery } from "../../validators"

/** GET /store/cam/jobs/:id?token=...  — estado y entregables del trabajo. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = StoreGetCamJobQuery.safeParse(req.query)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta el token del trabajo")
  }
  const camService: CamModuleService = req.scope.resolve(CAM_MODULE)
  const [job] = await camService.listCamJobs({ id: req.params.id }, { take: 1 })
  if (!job || !tokensMatch(job.access_token, parsed.data.token)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Trabajo CAM no encontrado")
  }
  res.json({ job: toStoreJob(job as unknown as Record<string, unknown>) })
}
