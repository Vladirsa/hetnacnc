import { MedusaService } from "@medusajs/framework/utils"

import { Portada } from "./models/portada"

class PortadasModuleService extends MedusaService({
  Portada,
}) {}

export default PortadasModuleService
