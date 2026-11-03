import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrAhora } from "../../../../lib/cotizador-marketing"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-marketing/correr  (sesión de Supabase)
// Revisa ahora mismo las automatizaciones del taller (sin esperar a mañana).
// -> { talleres, whatsapp, correos }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () =>
    correrAhora(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), tokenDe(req), req.scope.resolve("logger"))
  )
