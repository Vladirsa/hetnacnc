import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

import { exigirCorreoVerificado } from "../../../lib/verificar-correo"

// Recomienda y gana: solo con sesión de cliente. Vincular va sin exigir el
// correo confirmado porque se llama justo al registrarse, antes de confirmarlo.
export const storeRecomiendaMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/hetna-recomienda",
    middlewares: [authenticate("customer", ["session", "bearer"]), exigirCorreoVerificado()],
  },
  {
    method: ["POST"],
    matcher: "/store/hetna-recomienda/vincular",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
