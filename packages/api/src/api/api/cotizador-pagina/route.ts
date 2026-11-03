import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarPaginaTaller, paginaDelTaller } from "../../../lib/cotizador-en-linea"
import { responder, tokenDe } from "../cotizador-suscripcion/respuesta"

// GET  https://hetnacnc.com/api/cotizador-pagina  (sesión de Supabase del administrador)
//      -> { tabla_lista, slug, url, pagina: {...}, servicios: [...] }
// POST { activa?, slug?, titulo?, descripcion?, ciudad?, servicios?, mostrar_precio?, en_directorio? }
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => paginaDelTaller(tokenDe(req)))

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => guardarPaginaTaller(tokenDe(req), (req.body || {}) as Record<string, any>))
