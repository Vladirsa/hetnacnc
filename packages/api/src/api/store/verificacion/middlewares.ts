import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

export const storeVerificacionMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/verificacion",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
