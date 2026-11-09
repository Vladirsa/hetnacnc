// GET  /admin/hetna-radar?estado=nuevo&tipo=… -> hallazgos del Radar y búsquedas configuradas
// POST /admin/hetna-radar { accion: "buscar", id } | { accion: "busquedas", lista } | { accion: "estado", id, estado } | { accion: "publicar", id }
// Marketing HETNA: agente que busca oportunidades CNC en la web.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_HALLAZGO, TIPOS, aPublicacion, correrBusqueda, guardarBusquedas, leerBusquedas, listarHallazgos, mensajeSugerido } from "../../../lib/radar"
import { MERCADOS } from "../../../lib/social-hub"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const q: any = req.query || {}
  const estado = ["nuevo", "util", "descartado", "convertido"].includes(q.estado) ? q.estado : "nuevo"
  const tipo = (TIPOS as readonly string[]).includes(q.tipo) ? q.tipo : undefined
  const filas = await listarHallazgos(knex, { estado, tipo })
  const conteo = await knex(T_HALLAZGO).where({ estado: "nuevo" }).groupBy("tipo").select("tipo").count({ n: "*" })
  res.json({
    hallazgos: filas.map((h: any) => ({ ...h, mensaje: mensajeSugerido(h) })),
    conteo: Object.fromEntries(conteo.map((c: any) => [c.tipo, Number(c.n)])),
    busquedas: await leerBusquedas(knex),
    tipos: TIPOS,
    mercados: Object.entries(MERCADOS).map(([clave, m]) => ({ clave, nombre: m.nombre })),
    tope_dia: Number(process.env.RADAR_BUSQUEDAS_DIA ?? 6),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.accion === "buscar") {
      const busq = (await leerBusquedas(knex)).find((x) => x.id === b.id)
      if (!busq) return res.status(404).json({ message: "Búsqueda no encontrada." })
      const r = await correrBusqueda(knex, busq, logger)
      if (!r.ok) return res.status(502).json({ message: r.error })
      return res.json(r)
    }
    if (b.accion === "busquedas") return res.json({ busquedas: await guardarBusquedas(knex, b.lista) })
    if (b.accion === "estado") {
      if (!["nuevo", "util", "descartado"].includes(b.estado)) return res.status(400).json({ message: "Estado no válido." })
      await knex(T_HALLAZGO).where({ id: String(b.id) }).update({ estado: b.estado })
      return res.json({ ok: true })
    }
    if (b.accion === "publicar") return res.json({ ok: true, ...(await aPublicacion(knex, String(b.id), logger)) })
    return res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.message })
  }
}
