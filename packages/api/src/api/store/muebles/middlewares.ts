import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

const soloClientes = authenticate("customer", ["session", "bearer"])

export const storeMueblesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/muebles/descarga",
    middlewares: [soloClientes],
  },
  {
    method: ["POST"],
    matcher: "/store/muebles/imagen",
    // la imagen viaja en base64 dentro del JSON (máx. ~5 MB de imagen)
    bodyParser: { sizeLimit: "8mb" },
    middlewares: [soloClientes],
  },
  {
    method: ["POST"],
    matcher: "/store/muebles/tableros",
    // la imagen viaja en base64 dentro del JSON (máx. ~5 MB de imagen)
    bodyParser: { sizeLimit: "8mb" },
    middlewares: [soloClientes],
  },
]
