import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

import { exigirCorreoVerificado } from "../../../lib/verificar-correo"

// Puente del foro con el resto de HETNA. Las dos rutas necesitan saber quién
// es el cliente: una para decirle SÓLO a él si su correo es de un taller, la
// otra para que nadie anónimo dispare correos a los talleres.
export const storeForoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/foro/mi-taller",
    // Con el correo confirmado: si no, cualquiera se registraba con el correo de
    // un taller y salía en el foro como ese taller verificado (auditoría Thermos)
    middlewares: [authenticate("customer", ["session", "bearer"]), exigirCorreoVerificado()],
  },
  {
    method: ["POST"],
    matcher: "/store/foro/aviso",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
