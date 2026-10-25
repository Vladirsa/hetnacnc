import { MedusaService } from "@medusajs/framework/utils"
import ProductoVista from "./models/producto-vista"

class VistasModuleService extends MedusaService({
  ProductoVista,
}) {}

export default VistasModuleService
