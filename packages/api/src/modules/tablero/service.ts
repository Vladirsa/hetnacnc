import { MedusaService } from "@medusajs/framework/utils"
import TallerMeta from "./models/taller-meta"

class TableroModuleService extends MedusaService({
  TallerMeta,
}) {}

export default TableroModuleService
