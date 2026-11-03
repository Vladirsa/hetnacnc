import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelarFactura } from "../../../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-cfdi/<id>/cancelar  (administrador)
// { motivo: "02" (comprobante con errores sin relación) | "03" (no se llevó a cabo) }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => cancelarFactura(tokenDe(req), String(req.params.id || ""), String((req.body as any)?.motivo || "02")))
