import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { icsTaller } from "../../../../../../lib/calendario"
import { firmaDe, responderIcs } from "../../../responder-ics"

// GET https://hetnacnc.com/api/calendario/taller/<negocioId>/<firma>.ics
// Calendario del taller del Cotizador (entregas, citas, mantenimientos) para Google Calendar.
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  responderIcs(req, res, () => icsTaller(String(req.params.negocio || ""), firmaDe(req.params.firma)))
