// GET  /admin/hetna-referencias -> referencias (con su análisis) y la guía de estilo
// POST /admin/hetna-referencias { accion: "agregar", tipo, url, nota }
//                              | { accion: "reanalizar" | "borrar", id }
//                              | { accion: "generar_guia" } | { accion: "guardar_guia", texto }
// Marketing HETNA — biblioteca de referencias y guía de estilo (lib/referencias).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { agregarReferencia, analizarReferencia, borrarReferencia, generarGuia, guardarGuia, leerGuia, listarReferencias } from "../../../lib/referencias"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ referencias: await listarReferencias(knex), guia: await leerGuia(knex) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    switch (b.accion) {
      case "agregar":
        return res.json({ ok: true, id: await agregarReferencia(knex, b, logger) })
      case "reanalizar":
        setImmediate(() => analizarReferencia(knex, String(b.id), logger).catch(() => {}))
        return res.json({ ok: true })
      case "borrar":
        await borrarReferencia(knex, String(b.id))
        return res.json({ ok: true })
      case "generar_guia":
        return res.json({ ok: true, guia: await generarGuia(knex, logger) })
      case "guardar_guia":
        return res.json({ ok: true, guia: await guardarGuia(knex, String(b.texto || "")) })
      default:
        return res.status(400).json({ message: "Acción no válida." })
    }
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.message })
  }
}
