// GET  /admin/hetna-fabrica/estudio -> estado, gasto, últimos videos
// POST /admin/hetna-fabrica/estudio { activo }               (prender o apagar el video diario)
//                                   | { accion: "google" | "tendencias" | "retencion" } | { accion: "referencia", url, nota? }
//                                   | { hacer: true, tipo? }  (hacer el de hoy ahora, en segundo plano)
// Estudio diario: guion → voz → escenas con IA de video → publicación (lib/fabrica/estudio).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { agregarReferencia, ligaConectarGoogle, resumenDatos, revisarRetencion, revisarTendencias } from "../../../../lib/fabrica/estudio-datos"
import { estudioListo, guardarEstudioCfg, resumenEstudio, videoDelDia } from "../../../../lib/fabrica/estudio"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ ...(await resumenEstudio(knex)), datos: await resumenDatos(knex).catch(() => null) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.accion === "google") return res.json({ url: await ligaConectarGoogle(knex) })
    if (b.accion === "referencia") return res.json(await agregarReferencia(knex, String(b.url || ""), String(b.nota || "").slice(0, 200)))
    if (b.accion === "tendencias") return res.json(await revisarTendencias(knex, logger))
    if (b.accion === "retencion") return res.json(await revisarRetencion(knex, logger))
    if (b.hacer) {
      if (!estudioListo()) return res.status(400).json({ message: "Falta configurar el Estudio (FAL_KEY, IA o FFmpeg). Revisa el estado en la tarjeta." })
      const tipo = b.tipo === "novela" || b.tipo === "educativo" ? b.tipo : undefined
      // Tarda de 5 a 15 minutos: se hace en segundo plano y aparece en Pendientes
      videoDelDia(req.scope, logger, { forzar: true, tipo }).catch((e) => logger.warn(`[estudio] ${(e as Error).message}`))
      return res.json({ ok: true })
    }
    await guardarEstudioCfg(knex, { activo: !!b.activo })
    res.json({ ok: true, ...(await resumenEstudio(knex)), datos: await resumenDatos(knex).catch(() => null) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
