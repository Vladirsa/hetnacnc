import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CAM_MODULE } from "../../../modules/cam"
import type CamModuleService from "../../../modules/cam/service"

export type CreateCamJobStepInput = {
  service: "cam_3" | "cam_4" | "cam_5" | "post"
  tier: string | null
  access_token: string
  customer_id: string | null
  email: string | null
  model_name: string
  model_file_id: string | null
  model_file_url: string | null
  gcode_file_id: string | null
  gcode_file_url: string | null
  controller: string | null
  kinematics: string | null
  config: Record<string, unknown>
  stats: Record<string, unknown> | null
  review_requested: boolean
  customer_notes: string | null
}

export const createCamJobStep = createStep(
  "create-cam-job",
  async (input: CreateCamJobStepInput, { container }) => {
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    const job = await camService.createCamJobs(input)
    return new StepResponse(job, job.id)
  },
  async (jobId, { container }) => {
    if (!jobId) {
      return
    }
    const camService: CamModuleService = container.resolve(CAM_MODULE)
    await camService.deleteCamJobs(jobId)
  }
)
