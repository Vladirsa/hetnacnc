// GET https://hetnacnc.com/api/cotizador-exportar  (sesión de Supabase, sólo administrador)
// Descarga un ZIP con todos los datos del taller: CSV para Excel y JSON por
// tabla, sin llaves ni contraseñas (lib/cotizador-exportar.ts).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { exportarTaller, negocioDeAdmin } from "../../../lib/cotizador-exportar"
import { ErrorSuscripcion } from "../../../lib/cotizador-suscripciones"
import { tokenDe } from "../cotizador-suscripcion/respuesta"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  try {
    const n = await negocioDeAdmin(tokenDe(req))
    const r = await exportarTaller(n.id, n.nombre)
    const nombre = `hetna-datos-${String(n.nombre || "taller").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${r.fecha.slice(0, 10)}.zip`
    logger.info(`[cotizador] exportación de datos del taller ${n.id}: ${r.leidas.length} tablas${r.faltan.length ? `, sin leer: ${r.faltan.join(", ")}` : ""}`)
    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`)
    res.setHeader("Cache-Control", "no-store")
    res.status(200).send(Buffer.from(r.zip))
  } catch (e) {
    if (e instanceof ErrorSuscripcion) return res.status(e.status).json({ error: e.message })
    logger.error(`[cotizador] exportación: ${(e as Error).message}`)
    res.status(502).json({ error: "No pudimos preparar tus datos. Intenta de nuevo en un momento." })
  }
}
