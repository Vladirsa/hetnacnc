import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { CAM_MODULE } from "../../../../../../../modules/cam"
import type CamModuleService from "../../../../../../../modules/cam/service"
import { jobFileIds, tokensMatch } from "../../../../helpers"

/**
 * GET /store/cam/jobs/:id/files/:file_id[?token=]
 * Devuelve un enlace temporal de descarga para un entregable del trabajo.
 * Acceso: el token del trabajo o el cliente con sesión dueño del trabajo.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const camService: CamModuleService = req.scope.resolve(CAM_MODULE)
  const [job] = await camService.listCamJobs({ id: req.params.id }, { take: 1 })
  const token = typeof req.query.token === "string" ? req.query.token : null
  const actor = (req as unknown as AuthenticatedMedusaRequest).auth_context?.actor_id
  const allowed = job && (tokensMatch(job.access_token, token) || (actor && job.customer_id === actor))
  if (!job || !allowed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Archivo no encontrado")
  }
  const ready = ["paid", "in_review", "delivered"].includes(job.status)
  const fileIds = jobFileIds(job as unknown as Record<string, unknown>, { includeInputs: true })
  const isDeliverable = jobFileIds(job as unknown as Record<string, unknown>, { includeInputs: false }).includes(req.params.file_id)
  if (!fileIds.includes(req.params.file_id) || (isDeliverable && !ready)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Archivo no encontrado")
  }
  const fileService = req.scope.resolve(Modules.FILE)
  const file = await fileService.retrieveFile(req.params.file_id)
  res.json({ url: file.url })
}
