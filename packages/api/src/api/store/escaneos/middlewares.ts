import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// El callback que reporta el resultado NO está aquí: vive en /escaneos/callback,
// fuera de /store, porque lo llama n8n y no un cliente con sesión. Se protege
// con un secreto compartido, no con authenticate.
export const storeEscaneosMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET", "POST"],
    matcher: "/store/escaneos",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST"],
    matcher: "/store/escaneos/subida",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/escaneos/:id",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
