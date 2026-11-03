import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarReceta, recetasDelTaller } from "../../../lib/cotizador-marketing"
import { responder, tokenDe } from "../cotizador-suscripcion/respuesta"

// GET  https://hetnacnc.com/api/cotizador-marketing  (sesión de Supabase)
//      -> { permitido, tabla_lista, recetas: [...] }  (Marketing → Automático)
// POST { receta, activa?, mensaje?, correo?, whatsapp?, config? } -> { ok }
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => recetasDelTaller(tokenDe(req)))

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => guardarReceta(tokenDe(req), (req.body || {}) as Record<string, any>))
