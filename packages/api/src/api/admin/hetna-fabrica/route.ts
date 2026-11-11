// GET  /admin/hetna-fabrica -> trabajos de la Fábrica, biblioteca de fondos y música, y si hay FFmpeg
// POST /admin/hetna-fabrica { accion: "crear", guion|tema, mercado, publico, tema_visual }
//                          | { accion: "reintentar", id }
//                          | { accion: "fondo", tema, url, fuente, licencia } | { accion: "musica", titulo, url, estilo, licencia }
//                          | { accion: "borrar_fondo" | "borrar_musica", id }
//                          | { accion: "semanales" }  (genera ahora taller destacado, opinión e índice)
//                          | { accion: "promo", tipo: "producto" | "blog" | "herramienta" | "cotizador", clave? }  (imagen y video ahora)
// Marketing HETNA — Fábrica de contenido (Fase A).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_FONDO, T_MUSICA, T_TRABAJO, asegurarFabrica, crearTrabajo, fondosConIa, piezasSemanales, producir } from "../../../lib/fabrica"
import { ligasB2, runpodListo, salud } from "../../../lib/fabrica/runpod"
import { TEMAS } from "../../../lib/fabrica/render"
import { ffmpegDisponible } from "../../../lib/fabrica/video"
import * as op from "../../../lib/fabrica/oportunidades"
import { HERRAMIENTAS, promoBlog, promoHerramienta, promoProducto } from "../../../lib/fabrica/promociones"
import { nuevoId } from "../../../lib/licitacion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarFabrica(knex)
  const [trabajos, fondos, musica] = await Promise.all([
    knex(T_TRABAJO).orderBy("created_at", "desc").limit(30).select("id", "entrada", "estado", "error", "piezas", "created_at", knex.raw("paquete->>'titulo' as titulo")),
    knex(T_FONDO).orderBy("created_at", "desc").limit(200),
    knex(T_MUSICA).orderBy("created_at", "desc").limit(100),
  ])
  res.json({ trabajos, fondos, musica, temas: TEMAS, ffmpeg: ffmpegDisponible(), runpod: await salud() })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  await asegurarFabrica(knex)
  const b: any = req.body || {}
  const url = String(b.url || "")
  try {
    switch (b.accion) {
      case "crear":
        return res.json({ ok: true, id: await crearTrabajo(req.scope, b, logger) })
      case "reintentar": {
        await knex(T_TRABAJO).where({ id: String(b.id) }).whereIn("estado", ["error", "listo"]).update({ estado: "pendiente", intentos: 0, error: null })
        setImmediate(() => producir(req.scope, String(b.id), logger).catch(() => {}))
        return res.json({ ok: true })
      }
      case "fondo":
        if (!(TEMAS as readonly string[]).includes(b.tema) || !/^https:\/\//.test(url)) return res.status(400).json({ message: "Elige el tema y sube una imagen." })
        await knex(T_FONDO).insert({ id: nuevoId("fon"), tema: b.tema, url, fuente: String(b.fuente || "").slice(0, 200) || null, licencia: String(b.licencia || "").slice(0, 300) || null })
        return res.json({ ok: true })
      case "musica":
        if (!/^https:\/\//.test(url) || !String(b.titulo || "").trim()) return res.status(400).json({ message: "Escribe el título y sube el audio." })
        if (!String(b.licencia || "").trim()) return res.status(400).json({ message: "Pon la liga de la licencia (para comprobar que se puede usar en redes)." })
        await knex(T_MUSICA).insert({ id: nuevoId("mus"), titulo: String(b.titulo).slice(0, 120), url, estilo: String(b.estilo || "").slice(0, 60) || null, licencia: String(b.licencia).slice(0, 300) })
        return res.json({ ok: true })
      case "borrar_fondo":
        await knex(T_FONDO).where({ id: String(b.id) }).del()
        return res.json({ ok: true })
      case "borrar_musica":
        await knex(T_MUSICA).where({ id: String(b.id) }).del()
        return res.json({ ok: true })
      case "fondos_ia": {
        if (!runpodListo()) return res.status(400).json({ message: "Falta configurar RunPod (RUNPOD_FABRICA_ENDPOINT_ID)." })
        if (!(TEMAS as readonly string[]).includes(b.tema)) return res.status(400).json({ message: "Elige un tema." })
        // Puede tardar minutos (la GPU arranca en frío): se hace en segundo plano
        const tema = b.tema, cantidad = Number(b.cantidad) || 4
        setImmediate(() => fondosConIa(req.scope, tema, cantidad, logger).catch((e) => logger.warn(`[fabrica] fondos IA: ${(e as Error).message}`)))
        return res.json({ ok: true, en_proceso: true })
      }
      case "descargar": {
        const clave = String(b.clave || "")
        if (!/^fabrica\//.test(clave)) return res.status(400).json({ message: "Archivo no válido." })
        const [url] = await ligasB2([clave], 3600)
        return res.json({ ok: true, url })
      }
      case "promo": {
        // Video + imagen tardan (y la voz en frío más): se hace en segundo plano
        const fn = b.tipo === "radar" ? () => op.radarEstado(req.scope, logger) : b.tipo === "talleres" ? () => op.talleresListos(req.scope, logger) : b.tipo === "blog" ? () => promoBlog(req.scope, logger) : b.tipo === "herramienta" ? () => promoHerramienta(req.scope, logger, b.clave ? String(b.clave) : undefined) : b.tipo === "cotizador" ? () => promoHerramienta(req.scope, logger, undefined, { soloCotizador: true }) : () => promoProducto(req.scope, logger)
        setImmediate(() => fn().then((r) => { if (!r) logger.info(`[promo] ${b.tipo}: no hay nada nuevo que promover`) }).catch((e) => logger.warn(`[promo] ${(e as Error).message}`)))
        return res.json({ ok: true, en_proceso: true })
      }
      case "herramientas":
        return res.json({ ok: true, herramientas: HERRAMIENTAS.map((h) => ({ clave: h.clave, nombre: h.nombre })) })
      case "semanales":
        return res.json({ ok: true, creadas: await piezasSemanales(req.scope, logger) })
      default:
        return res.status(400).json({ message: "Acción no válida." })
    }
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.message })
  }
}
