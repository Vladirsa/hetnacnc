import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// El cupo es por persona, así que hace falta saber quién descarga. La cuenta
// es gratis: es el precio del archivo, y lo que deja a HETNA volver a
// escribirle a quien lo bajó.
export const storeDescargasGratisMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET", "POST"],
    matcher: "/store/descargas-gratis",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
