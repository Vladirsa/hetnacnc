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
    method: ["POST"],
    matcher: "/store/resenas/fotos",
    middlewares: [authenticate("customer", ["session", "bearer"])],
    // Una foto ya reducida en el navegador pesa ~200-500 KB; en base64 un poco más
    bodyParser: { sizeLimit: "3mb" },
  },
  {
    method: ["GET"],
    matcher: "/store/resenas/pendientes",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
