// Entrar con LinkedIn (lib/auth-social.ts). Se activa con LINKEDIN_LOGIN_ID y LINKEDIN_LOGIN_SECRET.
import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { LinkedinAuthService } from "../../lib/auth-social"

export default ModuleProvider(Modules.AUTH, { services: [LinkedinAuthService] })
