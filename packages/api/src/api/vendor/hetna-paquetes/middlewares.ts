import type { MiddlewareRoute } from "@medusajs/framework/http"

import { leerMultipart } from "../../cam-multipart"
import { MAX_MB_MODELO } from "../../../lib/paquetes-servicio"

// Modelo 3D de muestra de un servicio: un archivo por vez
export const vendorPaquetesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/vendor/hetna-paquetes/modelo",
    middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB_MODELO, forma: "lista" })],
  },
]
