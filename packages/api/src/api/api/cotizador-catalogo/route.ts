import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { misSolicitudes, solicitarCarga } from "../../../lib/cotizador-catalogo"
import { tokenDe } from "../cotizador-suscripcion/respuesta"
import { responderTaller } from "../cotizador-posventa/responder"

// GET  https://hetnacnc.com/api/cotizador-catalogo  (sesión de Supabase del taller) -> { disponible, solicitudes }
// POST multipart: archivos (hasta 5: Excel, PDF, Word o fotos) y nota  -> { ok, id }
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "catálogo", () => misSolicitudes(tokenDe(req)))

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "catálogo", () => {
    const archivos = ((req as any).files || {}) as Record<string, any[]>
    return solicitarCarga(tokenDe(req), (req.body || {}) as Record<string, any>, archivos.archivos || [], req.scope.resolve("logger"))
  })
