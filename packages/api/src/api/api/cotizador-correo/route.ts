import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { enviarCotizacionPorCorreo } from "../../../lib/cotizador-correo"
import { responder, tokenDe } from "../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-correo  (sesión de Supabase, multipart)
// Archivo `pdf` (la cotización con la plantilla del taller) y campos
// cotizacion_id, para, asunto y mensaje. -> { ok, enviada_a }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () =>
    enviarCotizacionPorCorreo(
      tokenDe(req),
      ((req.body || {}) as Record<string, unknown>),
      ((req as any).files?.pdf?.[0]) as { buffer: Buffer; originalname?: string } | undefined
    )
  )
