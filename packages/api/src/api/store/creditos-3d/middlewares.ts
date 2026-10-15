import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

export const storeCreditos3dMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/creditos-3d/saldo",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
