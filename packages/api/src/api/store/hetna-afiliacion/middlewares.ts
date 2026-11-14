import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// Número de afiliación (lib/afiliacion.ts).
//   GET  /store/hetna-afiliacion          -> mi número (con sesión; lo crea si falta)
//   GET  /store/hetna-afiliacion/activar  -> datos de la liga «Activar mi cuenta» (sin sesión)
//   POST /store/hetna-afiliacion/activar  -> liga la cuenta recién creada con su número
export const storeAfiliacionMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/hetna-afiliacion",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST"],
    matcher: "/store/hetna-afiliacion/activar",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
