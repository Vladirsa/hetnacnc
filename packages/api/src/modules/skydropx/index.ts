import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SkydropxProviderService from "./service"
export default ModuleProvider(Modules.FULFILLMENT, { services: [SkydropxProviderService] })
