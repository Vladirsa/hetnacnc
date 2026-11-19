import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// Buzón de opiniones (lib/opiniones.ts). El buzón de Mi cuenta pide sesión de
// cliente; la encuesta del correo entra con su liga firmada, sin sesión.
export const storeOpinionMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/hetna-opinion",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
