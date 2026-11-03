import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// CORS para las rutas /api/* que llama la app del Cotizador (Flutter).
// La app de Android no usa CORS y la versión web en hetnacnc.com/cotizador/ es
// del mismo origen; esto es para la web en localhost (flutter run --web-port 8080)
// o un subdominio. Orígenes extra: APP_CORS="https://a,https://b" (mismo
// formato que apps/storefront/src/lib/app-movil/cors.ts).
const BASE = ["https://hetnacnc.com", "https://www.hetnacnc.com", "http://localhost:8080", "http://localhost:5000"]
const permitidos = () => [...BASE, ...(process.env.APP_CORS || "").split(",").map((x) => x.trim()).filter(Boolean)]

export function corsApp(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const origen = String(req.headers.origin || "")
  if (origen && permitidos().includes(origen)) {
    res.setHeader("Access-Control-Allow-Origin", origen)
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    res.setHeader("Access-Control-Max-Age", "86400")
  }
  res.setHeader("Vary", "Origin")
  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  next()
}

export const corsAppMiddlewares = [
  { matcher: "/api/cotizador-mp/*", middlewares: [corsApp] },
  { matcher: "/api/cotizador-suscripcion", middlewares: [corsApp] },
  { matcher: "/api/cotizador-suscripcion/*", middlewares: [corsApp] },
]
