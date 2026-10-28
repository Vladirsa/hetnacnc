import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

const soloClientes = authenticate("customer", ["session", "bearer"])

export const storeCreditos3dMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/creditos-3d/saldo",
    middlewares: [soloClientes],
  },
  {
    method: ["POST"],
    matcher: "/store/creditos-3d/comprar",
    middlewares: [soloClientes],
  },
  {
    method: ["POST"],
    matcher: "/store/creditos-3d/confirmar",
    middlewares: [soloClientes],
  },
]
