// GET  /admin/hetna-fabrica/buen-fin -> configuración, etapa y productos con la etiqueta
// POST /admin/hetna-fabrica/buen-fin { activo, desde, hasta, descuento, cupon, etiquetas }  (guardar)
//                                    | { hacer: true }  (imagen y video ahora, si está en fechas)
// Buen Fin con fechas y descuento que pone el dueño (lib/fabrica/buen-fin).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { etapa, guardarBuenFin, leerBuenFin, promoBuenFin, resumenBuenFin } from "../../../../lib/fabrica/buen-fin"
import { productosDeFecha } from "../../../../lib/fabrica/temporadas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await resumenBuenFin(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.hacer) {
      const c = await leerBuenFin(knex)
      if (!etapa(c)) return res.status(400).json({ message: c.activo ? "Hoy no está en las fechas del Buen Fin ni en los 5 días de aviso." : "Primero activa el Buen Fin y guarda sus datos." })
      const prods = await productosDeFecha(knex, c.etiquetas, { limite: 3 })
      if (!prods.length) return res.status(400).json({ message: `Ningún producto publicado tiene la etiqueta ${c.etiquetas.join(", ")}.` })
      promoBuenFin(req.scope, logger, { forzar: true }).catch((e) => logger.warn(`[buen-fin] ${(e as Error).message}`))
      return res.json({ ok: true, productos: prods.map((p: any) => p.title) })
    }
    await guardarBuenFin(knex, b)
    res.json({ ok: true, ...(await resumenBuenFin(knex)) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
