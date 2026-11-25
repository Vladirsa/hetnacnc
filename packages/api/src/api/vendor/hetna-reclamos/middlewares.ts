import type { MiddlewareRoute } from "@medusajs/framework/http"

import { leerMultipart } from "../../cam-multipart"
import { MAX_MB_EVIDENCIA } from "../../../lib/reclamos-pedido"

// Evidencia del taller para responder un reclamo: un archivo por vez
export const vendorReclamosMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/vendor/hetna-reclamos/:id/evidencia",
    middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB_EVIDENCIA, forma: "lista" })],
  },
]
