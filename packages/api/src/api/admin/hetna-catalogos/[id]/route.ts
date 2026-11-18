// POST /admin/hetna-catalogos/<id>  { estado: recibida|en_proceso|lista|rechazada, respuesta? }
// Al pasar a "lista" o "rechazada" se avisa al taller (alerta, push y correo).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { adminCambiar } from "../../../../lib/cotizador-catalogo"
import { responderTaller } from "../../../api/cotizador-posventa/responder"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) =>
  responderTaller(req, res, "catálogos", () => adminCambiar(String(req.params.id || ""), (req.body || {}) as any, req.scope.resolve("logger")))
