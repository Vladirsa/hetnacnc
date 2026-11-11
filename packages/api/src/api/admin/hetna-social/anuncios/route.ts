// GET  /admin/hetna-social/anuncios -> configuración, si hay token y los anuncios (propuestas, activos, terminados)
// POST /admin/hetna-social/anuncios { accion: "config", activo, cuenta, presupuesto_semanal, dias }
//                                   | { accion: "proponer" } (busca la mejor publicación ahora)
//                                   | { accion: "aprobar" | "rechazar" | "pausar", id }
// Agente de anuncios de Meta (lib/anuncios.ts): cuesta dinero; nada sale sin aprobar.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarAnuncios, lanzarAnuncio, listarAnuncios, pausarAnuncio, proponerAnuncio, rechazarAnuncio } from "../../../../lib/anuncios"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json(await listarAnuncios(knex))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.accion === "config") await guardarAnuncios(knex, { activo: b.activo, cuenta: b.cuenta, presupuesto_semanal: b.presupuesto_semanal, dias: b.dias })
    else if (b.accion === "proponer") {
      const id = await proponerAnuncio(knex, logger)
      if (!id) return res.status(400).json({ message: "No hay propuesta: revisa que esté prendido, con cuenta, presupuesto y token, que no haya otro anuncio abierto y que haya publicaciones de Facebook de las últimas 2 semanas con resultados." })
    } else if (b.accion === "aprobar") await lanzarAnuncio(knex, String(b.id), logger)
    else if (b.accion === "rechazar") await rechazarAnuncio(knex, String(b.id))
    else if (b.accion === "pausar") await pausarAnuncio(knex, String(b.id))
    else return res.status(400).json({ message: "Acción no válida." })
    res.json({ ok: true, ...(await listarAnuncios(knex)) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
