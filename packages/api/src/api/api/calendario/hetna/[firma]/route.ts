import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { icsHetna } from "../../../../../lib/calendario"
import { firmaDe, responderIcs } from "../../responder-ics"

// GET https://hetnacnc.com/api/calendario/hetna/<firma>.ics
// Calendario de HETNA: pedidos de la tienda y licitaciones (cierres, entregas, hitos).
export const GET = (req: MedusaRequest, res: MedusaResponse) => responderIcs(req, res, () => icsHetna(req.scope, firmaDe(req.params.firma)))
