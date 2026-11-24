// GET  /admin/hetna-fabrica/estudio -> estado, gasto, últimos videos
// POST /admin/hetna-fabrica/estudio { activo }               (prender o apagar el video diario)
//                                   | { accion: "google" | "tendencias" | "retencion" } | { accion: "referencia", url, nota? }
//                                   | { hacer: true, tipo? }  (hacer el de hoy ahora, en segundo plano)
//                                   | { accion: "explicativo", tema? } (video explicativo ahora, en segundo plano)
//                                   | { explicativo: boolean }  (prender o apagar el explicativo diario)
// Estudio diario: guion → voz → escenas con IA de video → publicación (lib/fabrica/estudio).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { agregarReferencia, ligaConectarGoogle, resumenDatos, revisarRetencion, revisarTendencias } from "../../../../lib/fabrica/estudio-datos"
import { limpiarMedios } from "../../../../lib/limpieza-medios"
import { posterPro } from "../../../../lib/fabrica/poster-pro"
import { subir } from "../../../../lib/fabrica/index"
import { publicarVideoEstudio, recuperarVideos, T_ESTUDIO } from "../../../../lib/fabrica/estudio"
import { estudioListo, guardarEstudioCfg, resumenEstudio, videoDelDia } from "../../../../lib/fabrica/estudio"
import { borradorExplicativo, explicativoListo, hacerExplicativo } from "../../../../lib/fabrica/explicativo"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ ...(await resumenEstudio(knex)), datos: await resumenDatos(knex).catch(() => null) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    if (b.accion === "imagen_prueba") {
      const r = await posterPro({ texto: String(b.texto || "Cotiza tu pieza CNC gratis en HETNA: talleres de tu zona te mandan propuesta y eliges. Pago protegido.").slice(0, 1500), formato: b.formato === "9:16" ? "9:16" : "4:5" }, logger)
      if (!r) return res.status(400).json({ message: "No se pudo hacer la imagen (revisa FAL_KEY y Chrome en el servidor, o el tope diario)." })
      return res.json({ url: await subir(req.scope, `estudio-prueba-${Date.now()}.png`, "image/png", r.png), idea: r.idea })
    }
    if (b.accion === "recuperar") return res.json(await recuperarVideos(knex))
    if (b.accion === "publicar") {
      const f = await knex(T_ESTUDIO).where({ id: String(b.id || "") }).first()
      if (!f) return res.status(404).json({ message: "No encontré ese video." })
      if (f.post_id) return res.status(400).json({ message: "Ese video ya está en el Social Hub." })
      if (f.tipo === "explicativo") return res.json({ ...(await borradorExplicativo(knex, { id: f.id, guion: f.guion, video_url: f.video_url }, logger)), estado: "borrador" })
      return res.json(await publicarVideoEstudio(knex, { id: f.id, tipo: f.tipo, guion: f.guion, video_url: f.video_url }, logger))
    }
    if (b.accion === "limpiar") return res.json(await limpiarMedios(knex, logger, { simular: !!b.simular }))
    if (b.accion === "google") return res.json({ url: await ligaConectarGoogle(knex) })
    if (b.accion === "referencia") return res.json(await agregarReferencia(knex, String(b.url || ""), String(b.nota || "").slice(0, 200)))
    if (b.accion === "tendencias") return res.json(await revisarTendencias(knex, logger))
    if (b.accion === "retencion") return res.json(await revisarRetencion(knex, logger))
    if (b.accion === "explicativo") {
      if (!explicativoListo()) return res.status(400).json({ message: "Falta FAL_KEY, la IA, FFmpeg o Chrome en el servidor." })
      // Tarda de 3 a 8 minutos: se hace en segundo plano y llega a Pendientes y a Telegram
      hacerExplicativo(req.scope, logger, { forzar: true, tema: String(b.tema || "").slice(0, 200) || undefined }).catch((e) => logger.warn(`[explicativo] ${(e as Error).message}`))
      return res.json({ ok: true })
    }
    if (typeof b.explicativo === "boolean") {
      await guardarEstudioCfg(knex, { explicativo: b.explicativo })
      return res.json({ ok: true, ...(await resumenEstudio(knex)), datos: await resumenDatos(knex).catch(() => null) })
    }
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
