import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// Leer reseñas es público -- son el argumento de venta de la ficha, tienen que
// verse sin cuenta. Escribir una y ver lo que te falta reseñar, no: ahí hace
// falta saber quién eres para validar contra tus pedidos.
export const storeResenasMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/resenas",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/resenas/pendientes",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
