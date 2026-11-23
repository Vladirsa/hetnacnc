import { MedusaService } from "@medusajs/framework/utils"
import MlCuenta from "./models/ml-cuenta"
import MlPublicacion from "./models/ml-publicacion"

class MercadoLibreModuleService extends MedusaService({
  MlCuenta,
  MlPublicacion,
}) {}

export default MercadoLibreModuleService
