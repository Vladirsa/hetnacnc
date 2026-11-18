import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { posventaPublica, reportarPosventa } from "../../../../../lib/cotizador-posventa"
import { ipCliente } from "../../../../../lib/ip-cliente"
import { responderTaller } from "../../../cotizador-catalogo/responder"

// GET  https://hetnacnc.com/api/cotizacion-liga/<token>/posventa  -> { disponible, casos: [...] }
// POST (multipart/form-data) tipo, descripcion, nombre, contacto, sitio_web (trampa) y fotos (hasta 3)
// Sin sesión: lo usa el cliente final desde la liga de su pedido (lib/cotizador-posventa.ts).
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "posventa", () => posventaPublica(String(req.params.token || "")))

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "posventa", () => {
    const archivos = ((req as any).files || {}) as Record<string, any[]>
    return reportarPosventa(
      String(req.params.token || ""),
      (req.body || {}) as Record<string, any>,
      archivos.fotos || [],
      ipCliente(req as any),
      req.scope.resolve("logger")
    )
  })
