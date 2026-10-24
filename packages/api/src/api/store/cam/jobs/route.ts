import { randomBytes } from "crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CAM_MODULE } from "../../../../modules/cam"
import { computeTier, serviceFromStrategy } from "../../../../modules/cam/catalog"
import type CamModuleService from "../../../../modules/cam/service"
import { createCamJobWorkflow } from "../../../../workflows/cam/create-cam-job"
import { archivosDe } from "../../../cam-multipart"
import { safeFilename, toStoreJob } from "../helpers"
import type { StoreCreateCamJobType } from "../validators"

/**
 * POST /store/cam/jobs  (multipart: model, gcode opcional, payload JSON)
 * Crea el trabajo CAM y devuelve su id y un token de acceso para el cliente.
 */
export async function POST(
  req: MedusaRequest<StoreCreateCamJobType>,
  res: MedusaResponse
) {
  const files = archivosDe(req)
  const model = files.model?.[0]
  if (!model) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta el archivo del modelo 3D")
  }
  const gcode = files.gcode?.[0]
  const p = req.validatedBody.payload
  const strategy = p.config.strategy as { kind?: string } | undefined
  const service = p.service === "post" ? "post" : serviceFromStrategy(p.strategy_kind ?? strategy?.kind)
  const stats = p.stats ?? null
  const customerId = (req as unknown as AuthenticatedMedusaRequest).auth_context?.actor_id || null

  const { result } = await createCamJobWorkflow(req.scope).run({
    input: {
      model: {
        filename: safeFilename(model.originalname),
        mimeType: model.mimetype || "application/octet-stream",
        content: model.buffer.toString("base64"),
      },
      gcode: gcode
        ? {
            filename: safeFilename(gcode.originalname || "programa.nc"),
            mimeType: "text/plain",
            content: gcode.buffer.toString("base64"),
          }
        : null,
      job: {
        service,
        tier: service === "post" ? null : computeTier(stats),
        access_token: randomBytes(24).toString("hex"),
        customer_id: customerId,
        email: p.email ?? null,
        model_name: p.model_name,
        controller: p.controller ?? null,
        kinematics: p.kinematics ?? null,
        config: p.config,
        stats,
        review_requested: p.review,
        customer_notes: p.notes ?? null,
      },
    },
  })

  res.status(201).json({ job: toStoreJob(result as unknown as Record<string, unknown>, { includeToken: true }) })
}

/** GET /store/cam/jobs  — trabajos del cliente con sesión iniciada. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const camService: CamModuleService = req.scope.resolve(CAM_MODULE)
  const jobs = await camService.listCamJobs(
    { customer_id: req.auth_context.actor_id },
    { order: { created_at: "DESC" }, take: 50 }
  )
  res.json({ jobs: jobs.map((j) => toStoreJob(j as unknown as Record<string, unknown>)) })
}
