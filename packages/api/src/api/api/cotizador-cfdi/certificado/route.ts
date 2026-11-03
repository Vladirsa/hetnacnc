import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { subirCsd } from "../../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-cfdi/certificado  (administrador, multipart)
// Archivos `cer` y `key` del CSD y campo `password`. Se mandan directo a
// Facturapi; HETNA no guarda los archivos ni la contraseña.
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () =>
    subirCsd(tokenDe(req), ((req as any).files || {}) as Record<string, any[]>, String((req.body as any)?.password || ""))
  )
