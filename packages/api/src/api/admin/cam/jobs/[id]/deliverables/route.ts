import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { addCamDeliverablesWorkflow } from "../../../../../../workflows/cam/add-cam-deliverables"
import { listaDeArchivos } from "../../../../../cam-multipart"
import { safeFilename } from "../../../../../store/cam/helpers"
import type { AdminAddCamDeliverablesType } from "../../../validators"

/**
 * POST /admin/cam/jobs/:id/deliverables  (multipart: files[], mark_delivered)
 * Sube los programas revisados y demás archivos que recibe el cliente.
 */
export async function POST(
  req: MedusaRequest<AdminAddCamDeliverablesType>,
  res: MedusaResponse
) {
  const files = listaDeArchivos(req)
  if (!files.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No se recibió ningún archivo")
  }
  const { result } = await addCamDeliverablesWorkflow(req.scope).run({
    input: {
      job_id: req.params.id,
      mark_delivered: req.validatedBody.mark_delivered === "true",
      files: files.map((f) => ({
        filename: safeFilename(f.originalname),
        mimeType: f.mimetype || "application/octet-stream",
        content: f.buffer.toString("base64"),
      })),
    },
  })
  const { access_token: _t, ...job } = result as unknown as Record<string, unknown>
  res.json({ job })
}
