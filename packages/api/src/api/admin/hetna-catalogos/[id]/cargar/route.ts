// POST /admin/hetna-catalogos/<id>/cargar  (multipart: archivo = plantilla llena .xlsx o .csv)
//   ?probar=1 → sólo dice cuántos productos entrarían, cuáles ya existían y los errores
//   sin probar → los escribe en el catálogo del taller, marca la solicitud "lista" y le avisa
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { adminCargar } from "../../../../../lib/cotizador-catalogo"
import { listaDeArchivos } from "../../../../cam-multipart"
import { responderTaller } from "../../../../api/cotizador-posventa/responder"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "cargar catálogo", () => {
    const probar = String((req.query as any)?.probar || "") === "1"
    return adminCargar(String(req.params.id || ""), listaDeArchivos(req as any)[0], probar, req.scope.resolve("logger"))
  })
