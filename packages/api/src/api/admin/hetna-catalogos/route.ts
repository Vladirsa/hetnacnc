// GET /admin/hetna-catalogos → solicitudes de "Te cargamos tu catálogo" con ligas para bajar los archivos
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { adminListar } from "../../../lib/cotizador-catalogo"
import { responderTaller } from "../../api/cotizador-posventa/responder"

export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => responderTaller(req, res, "catálogos", () => adminListar())
