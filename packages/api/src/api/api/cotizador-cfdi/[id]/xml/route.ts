import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { archivoFactura } from "../../../../../lib/cotizador-cfdi"
import { ErrorSuscripcion } from "../../../../../lib/cotizador-suscripciones"
import { tokenDe } from "../../../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/cotizador-cfdi/<id>/xml  (sesión de Supabase)
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const a = await archivoFactura(tokenDe(req), String(req.params.id || ""), "xml")
    res.setHeader("Content-Type", "application/xml")
    res.setHeader("Content-Disposition", `inline; filename="${a.nombre}"`)
    res.setHeader("Cache-Control", "private, no-store")
    res.end(a.datos)
  } catch (e) {
    const status = e instanceof ErrorSuscripcion ? e.status : 502
    res.status(status).json({ error: e instanceof ErrorSuscripcion ? e.message : "No se pudo descargar la factura." })
  }
}
