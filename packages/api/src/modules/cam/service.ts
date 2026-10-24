import { MedusaService } from "@medusajs/framework/utils"
import CamJob from "./models/cam-job"

class CamModuleService extends MedusaService({
  CamJob,
}) {}

export default CamModuleService
