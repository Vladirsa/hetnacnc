import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

export const storeHetnaPedidosMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/hetna-pedidos/:id/recibido",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
