// GET  /admin/hetna-fabrica/temporadas -> fechas especiales, cuándo caen y qué productos coinciden
// POST /admin/hetna-fabrica/temporadas { clave, etiquetas?: string[], activa?: boolean }  (guardar)
//                                     | { clave, hacer: true }  (imagen y video de esa fecha ahora)
// Videos de productos por fecha especial (lib/fabrica/temporadas).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarFecha, leerFechas, productosDeFecha, promoTemporada, resumenFechas } from "../../../../lib/fabrica/temporadas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  res.json({ fechas: await resumenFechas(knex) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  const clave = String(b.clave || "")
  try {
    if (b.hacer) {
      const ajustes = await leerFechas(knex)
      if (!ajustes[clave]) return res.status(400).json({ message: "Fecha desconocida" })
      const prods = await productosDeFecha(knex, ajustes[clave].etiquetas, { limite: 3 })
      if (!prods.length) return res.status(400).json({ message: `Ningún producto publicado tiene estas etiquetas o categorías: ${ajustes[clave].etiquetas.join(", ")}` })
      // El video puede tardar unos minutos: se hace en segundo plano y aparece en Pendientes
      promoTemporada(req.scope, logger, { clave, forzar: true }).catch((e) => logger.warn(`[temporada] ${clave}: ${(e as Error).message}`))
      return res.json({ ok: true, productos: prods.map((p: any) => p.title) })
    }
    await guardarFecha(knex, clave, { etiquetas: Array.isArray(b.etiquetas) ? b.etiquetas : undefined, activa: typeof b.activa === "boolean" ? b.activa : undefined })
    res.json({ ok: true, fechas: await resumenFechas(knex) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
