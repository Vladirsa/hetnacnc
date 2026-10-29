import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

export const storeRastreoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/hetna-rastreo/:id",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
