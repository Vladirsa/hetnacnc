import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

import { limitarFormulario } from "../../../lib/limite-formularios"

// Licitaciones 2.0: la sesión del cliente es opcional al mandar y al ver su
// solicitud (si la hay, la solicitud queda en "Mis solicitudes"), y obligatoria
// para listar las suyas.
export const storeSolicitudesTallerMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/quote-leads",
    middlewares: [limitarFormulario({ nombre: "quote-lead", porCorreoHora: 4, totalHora: 200 })],
  },
  {
    method: ["POST"],
    matcher: "/store/solicitudes-taller",
    middlewares: [
      authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true }),
      // Sin sesión: 4 por hora por correo y 120 por hora en total
      limitarFormulario({ nombre: "solicitud", porCorreoHora: 4, totalHora: 120 }),
    ],
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
  // Estrategia 2.4: piezas para repetir pedido y datos de empresa (factura)
  {
    method: ["GET"],
    matcher: "/store/mis-piezas",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET", "POST"],
    matcher: "/store/mi-empresa",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET", "POST"],
    matcher: "/store/mi-equipo",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
