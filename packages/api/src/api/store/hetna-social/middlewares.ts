import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// La identidad de la red social todavía no tiene cliente: se permite sin registrar
export const storeHetnaSocialMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/hetna-social/completar",
    middlewares: [authenticate("customer", ["bearer"], { allowUnregistered: true })],
  },
]
