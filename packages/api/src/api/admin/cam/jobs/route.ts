import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CAM_MODULE } from "../../../../modules/cam"
import type CamModuleService from "../../../../modules/cam/service"
import { AdminListCamJobsQuery } from "../validators"

/** GET /admin/cam/jobs?status=&order_id=&q=&limit=&offset= */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = AdminListCamJobsQuery.safeParse(req.query)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error.message)
  }
  const { status, order_id, q, limit, offset } = parsed.data
  const filters: Record<string, unknown> = {}
  if (status) {
    filters.status = status
  }
  if (order_id) {
    filters.order_id = order_id
  }
  if (q) {
    filters.$or = [
      { model_name: { $ilike: `%${q}%` } },
      { email: { $ilike: `%${q}%` } },
      { id: q },
    ]
  }

  const camService: CamModuleService = req.scope.resolve(CAM_MODULE)
  const [jobs, count] = await camService.listAndCountCamJobs(filters, {
    skip: offset,
    take: limit,
    order: { created_at: "DESC" },
  })

  res.json({
    jobs: jobs.map(({ access_token: _t, ...rest }) => rest),
    count,
    limit,
    offset,
  })
}
