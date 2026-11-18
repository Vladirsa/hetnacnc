// Subidas de la pantalla "Subir diseños" (lib/subir-disenos.ts): el archivo del
// diseño y la imagen llegan como formulario multipart.
import type { MiddlewareRoute } from "@medusajs/framework/http"

import { leerMultipart } from "../../cam-multipart"
import { MAX_MB_ARCHIVO, MAX_MB_IMAGEN } from "../../../lib/subir-disenos"

export const adminSubirDisenosMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/hetna-subir-disenos/archivo",
    middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB_ARCHIVO, forma: "lista" })],
  },
  {
    method: ["POST"],
    matcher: "/admin/hetna-subir-disenos/imagen",
    middlewares: [leerMultipart({ campos: { imagen: 1 }, maxMb: MAX_MB_IMAGEN, forma: "lista" })],
  },
]
