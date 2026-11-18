import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { posventaPublica, reportarPosventa } from "../../../../lib/cotizador-posventa"
import { ipCliente } from "../../../../lib/ip-cliente"
import { responderTaller } from "../responder"

// GET  https://hetnacnc.com/api/cotizador-posventa/<pedidoId>  -> { disponible, casos: [...] }
// POST (multipart/form-data) tipo, descripcion, nombre, contacto, sitio_web (trampa) y fotos (hasta 3)
// Sin sesión: lo usa el cliente final desde la liga de su pedido.
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "posventa", () => posventaPublica(String(req.params.pedido || "")))

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "posventa", () => {
    const archivos = ((req as any).files || {}) as Record<string, any[]>
    return reportarPosventa(
      String(req.params.pedido || ""),
      (req.body || {}) as Record<string, any>,
      archivos.fotos || [],
      ipCliente(req as any),
      req.scope.resolve("logger")
    )
  })
