import { MedusaService } from "@medusajs/framework/utils"
import VerificacionTaller from "./models/verificacion-taller"

class VerificacionModuleService extends MedusaService({
  VerificacionTaller,
}) {}

export default VerificacionModuleService
