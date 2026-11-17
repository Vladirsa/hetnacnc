import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelarFactura } from "../../../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-cfdi/<id>/cancelar  (administrador)
// { motivo: "01" (con errores con relación; lleva sustituta: id de la factura nueva)
//         | "02" (con errores sin relación) | "03" (no se llevó a cabo)
//         | "04" (operación nominativa relacionada en una factura global) }
// Para corregir una factura conviene más emitir la nueva con { sustituye }:
// la anterior se cancela sola con motivo 01.
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => {
    const b = (req.body as any) || {}
    return cancelarFactura(tokenDe(req), String(req.params.id || ""), String(b.motivo || "02"), b.sustituta ? String(b.sustituta) : undefined)
  })
