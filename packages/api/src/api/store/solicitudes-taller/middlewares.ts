import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

import { limitarFormulario } from "../../../lib/limite-formularios"

// Licitaciones 2.0: la sesión del cliente es opcional al mandar y al ver su
// solicitud (si la hay, la solicitud queda en "Mis solicitudes"), y obligatoria
// para listar las suyas.
export const storeSolicitudesTallerMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/quote-leads",
    middlewares: [limitarFormulario({ nombre: "quote-lead", porIpHora: 10, porCorreoHora: 4 })],
  },
  {
    method: ["POST"],
    matcher: "/store/solicitudes-taller",
    middlewares: [
      authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true }),
      // Sin sesión: 8 por hora por IP; 4 por hora por correo (avisos y correos a terceros)
      limitarFormulario({ nombre: "solicitud", porIpHora: 8, porCorreoHora: 4 }),
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
]
