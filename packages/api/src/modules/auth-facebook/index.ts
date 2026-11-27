// Entrar con Facebook (lib/auth-social.ts). Se activa con FACEBOOK_LOGIN_ID y FACEBOOK_LOGIN_SECRET.
import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { FacebookAuthService } from "../../lib/auth-social"

export default ModuleProvider(Modules.AUTH, { services: [FacebookAuthService] })
