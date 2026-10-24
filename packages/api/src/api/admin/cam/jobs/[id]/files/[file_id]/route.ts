import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { CAM_MODULE } from "../../../../../../../modules/cam"
import type CamModuleService from "../../../../../../../modules/cam/service"
import { jobFileIds } from "../../../../../../store/cam/helpers"

/**
 * GET /admin/cam/jobs/:id/files/:file_id
 * Redirige a un enlace temporal del archivo (funciona con almacenamiento local
 * o con S3 / DigitalOcean Spaces privados). Con ?json=1 devuelve { url }: el
 * panel lo usa porque su sesión va en la cabecera, no en una cookie.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const camService: CamModuleService = req.scope.resolve(CAM_MODULE)
  const job = await camService.retrieveCamJob(req.params.id)
  if (!jobFileIds(job as unknown as Record<string, unknown>, { includeInputs: true }).includes(req.params.file_id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Archivo no encontrado")
  }
  const fileService = req.scope.resolve(Modules.FILE)
  const file = await fileService.retrieveFile(req.params.file_id)
  if (req.query.json) {
    res.json({ url: file.url })
    return
  }
  res.redirect(file.url)
}
