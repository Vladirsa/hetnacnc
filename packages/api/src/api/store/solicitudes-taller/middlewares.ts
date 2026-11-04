import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// Licitaciones 2.0: la sesión del cliente es opcional al mandar y al ver su
// solicitud (si la hay, la solicitud queda en "Mis solicitudes"), y obligatoria
// para listar las suyas.
export const storeSolicitudesTallerMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/solicitudes-taller",
    middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
  },
  {
    method: ["GET"],
    matcher: "/store/solicitudes-taller/:token",
    middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
  },
  {
    method: ["GET"],
    matcher: "/store/mis-solicitudes",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
