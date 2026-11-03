import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { solicitar } from "../../../../../lib/cotizador-en-linea"
import { responder } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/taller-publico/<slug>/solicitar  (multipart/form-data)
// Campos: nombre, telefono, correo, empresa, mensaje, servicio_id, tipo_id,
// cantidad, medidas (JSON), sitio_web (trampa para robots, va vacío) y archivo.
// El middleware leerMultipart deja el archivo en req.files.archivo[0].
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => {
    const archivos = ((req as any).files || {}) as Record<string, any[]>
    const ip = String(req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.ip || "")
    return solicitar(String(req.params.slug || ""), (req.body || {}) as Record<string, any>, archivos.archivo?.[0], ip, req.scope.resolve("logger"))
  })
