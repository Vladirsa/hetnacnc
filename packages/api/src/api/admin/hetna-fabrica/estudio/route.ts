// GET  /admin/hetna-fabrica/estudio -> estado, gasto, últimos videos
// POST /admin/hetna-fabrica/estudio { activo }               (prender o apagar el video diario)
//                                   | { hacer: true, tipo? }  (hacer el de hoy ahora, en segundo plano)
// Estudio diario: guion → voz → escenas con IA de video → publicación (lib/fabrica/estudio).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estudioListo, guardarEstudioCfg, resumenEstudio, videoDelDia } from "../../../../lib/fabrica/estudio"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await resumenEstudio(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.hacer) {
      if (!estudioListo()) return res.status(400).json({ message: "Falta configurar el Estudio (FAL_KEY, IA o FFmpeg). Revisa el estado en la tarjeta." })
      const tipo = b.tipo === "novela" || b.tipo === "educativo" ? b.tipo : undefined
      // Tarda de 5 a 15 minutos: se hace en segundo plano y aparece en Pendientes
      videoDelDia(req.scope, logger, { forzar: true, tipo }).catch((e) => logger.warn(`[estudio] ${(e as Error).message}`))
      return res.json({ ok: true })
    }
    await guardarEstudioCfg(knex, { activo: !!b.activo })
    res.json({ ok: true, ...(await resumenEstudio(knex)) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
