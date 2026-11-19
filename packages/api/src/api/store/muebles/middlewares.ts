import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

const soloClientes = authenticate("customer", ["session", "bearer"])

export const storeMueblesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET", "POST", "DELETE"],
    matcher: "/store/muebles/disenos*",
    // un diseño (tableros y opciones en JSON) pesa poco; una cocina grande, unos cientos de KB
    bodyParser: { sizeLimit: "2mb" },
    middlewares: [soloClientes],
  },
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
