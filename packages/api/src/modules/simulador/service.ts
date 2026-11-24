import { MedusaService } from "@medusajs/framework/utils"
import SimResultado from "./models/sim-resultado"

class SimuladorModuleService extends MedusaService({
  SimResultado,
}) {}

export default SimuladorModuleService
