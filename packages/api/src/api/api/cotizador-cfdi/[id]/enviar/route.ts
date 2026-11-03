import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { enviarFactura } from "../../../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-cfdi/<id>/enviar  { correo }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => enviarFactura(tokenDe(req), String(req.params.id || ""), String((req.body as any)?.correo || "")))
