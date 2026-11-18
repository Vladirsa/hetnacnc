import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { ArchivoLocalSeguroService } from "./service"

export default ModuleProvider(Modules.FILE, { services: [ArchivoLocalSeguroService] })
