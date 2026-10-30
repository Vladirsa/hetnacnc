import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// Vincular la cuenta de la tienda con el Cotizador: sólo con sesión de cliente.
export const storeCotizadorVinculoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET", "POST"],
    matcher: "/store/cotizador-vinculo",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
