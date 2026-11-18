import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ligaCalendarioTaller } from "../../../lib/calendario"
import { responderTaller } from "../cotizador-catalogo/responder"
import { tokenDe } from "../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/cotizador-calendario  (sesión de Supabase del taller)
//   -> { url, webcal, google }: ligas para suscribir Google Calendar a sus pedidos, citas y mantenimientos
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "calendario", () => ligaCalendarioTaller(tokenDe(req)))
