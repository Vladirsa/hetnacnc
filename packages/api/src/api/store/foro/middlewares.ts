import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// Puente del foro con el resto de HETNA. Las dos rutas necesitan saber quién
// es el cliente: una para decirle SÓLO a él si su correo es de un taller, la
// otra para que nadie anónimo dispare correos a los talleres.
export const storeForoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/foro/mi-taller",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST"],
    matcher: "/store/foro/aviso",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
