// GET  /admin/hetna-campanas -> campañas generadas con sus resultados medidos
// POST /admin/hetna-campanas { accion: "generar", que, objetivo, zona, diario, dias, plataformas[] }  (en segundo plano)
//                            | { accion: "meta", id }        (crear en Meta EN PAUSA)
//                            | { accion: "csv_google", id }  (archivo para Google Ads Editor)
//                            | { accion: "borrar", id }
// Motor de campañas de anuncios (lib/campanas.ts).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { OBJETIVOS, PLATAFORMAS, QUE_VENDER, T_CAMPANA, asegurarCampanas, crearEnMeta, csvGoogle, generarCampana, listarCampanas } from "../../../lib/campanas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ ...(await listarCampanas(knex)), opciones: { que: QUE_VENDER, objetivos: OBJETIVOS, plataformas: PLATAFORMAS } })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.accion === "generar") {
      // La IA y las imágenes tardan 1 o 2 minutos: se hace en segundo plano y el panel se actualiza solo
      setImmediate(() =>
        generarCampana(req.scope, { que: String(b.que), objetivo: String(b.objetivo), zona: b.zona, diario: Number(b.diario), dias: Number(b.dias), plataformas: Array.isArray(b.plataformas) ? b.plataformas : [] }, logger).catch((e) =>
          logger.warn(`[campañas] ${(e as Error).message}`)
        )
      )
      return res.json({ ok: true, en_proceso: true })
    }
    await asegurarCampanas(knex)
    const id = String(b.id || "")
    if (b.accion === "meta") return res.json(await crearEnMeta(knex, id, logger))
    if (b.accion === "csv_google") {
      const c = await knex(T_CAMPANA).where({ id }).first()
      if (!c) return res.status(404).json({ message: "No existe esa campaña." })
      return res.json({ ok: true, nombre: `${String(c.nombre).replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 50)}-google-ads.csv`, csv: csvGoogle(c) })
    }
    if (b.accion === "borrar") {
      await knex(T_CAMPANA).where({ id }).whereNot("estado", "creada_meta").del()
      return res.json({ ok: true })
    }
    res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
