import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { estimarPublico } from "../../../../../lib/cotizador-en-linea"
import { responder } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/taller-publico/<slug>/estimar
// { servicio_id, tipo_id, cantidad, medidas: { largo, ancho, alto, corte_mm, perforaciones, volumen_cm3 } }
// -> { estimable, moneda, minimo, recomendado, iva_pct } (con las tarifas del simulador del taller)
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => estimarPublico(String(req.params.slug || ""), req.body || {}))
