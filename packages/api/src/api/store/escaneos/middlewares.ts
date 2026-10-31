import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

import { leerMultipart } from "../../cam-multipart"

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
    // Una foto por petición (las de celular pesan 3 a 8 MB)
    middlewares: [authenticate("customer", ["session", "bearer"]), leerMultipart({ campos: { foto: 1 }, maxMb: 12 })],
  },
  {
    method: ["GET"],
    matcher: "/store/escaneos/:id",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
