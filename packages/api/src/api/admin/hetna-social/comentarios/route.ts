// GET  /admin/hetna-social/comentarios?estado= -> comentarios de Instagram y Facebook con su respuesta propuesta
// POST /admin/hetna-social/comentarios { id, accion: "enviar" | "ignorar" | "guardar", texto? }
//      { accion: "revisar" } -> lee ahora los comentarios nuevos
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cambiarRespuesta, enviarRespuesta, ignorar, listarComentarios, revisarComentarios } from "../../../../lib/social-comentarios"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ comentarios: await listarComentarios(knex, String((req.query as any)?.estado || "") || undefined) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const b: any = req.body || {}
  const id = String(b.id || "")
  if (b.accion === "revisar") return res.json(await revisarComentarios(knex, req.scope.resolve("logger")))
  if (b.accion === "ignorar") {
    await ignorar(knex, id)
    return res.json({ ok: true })
  }
  if (b.accion === "guardar") {
    await cambiarRespuesta(knex, id, String(b.texto || ""))
    return res.json({ ok: true })
  }
  if (b.accion === "enviar") {
    const r: any = await enviarRespuesta(knex, id, b.texto ? String(b.texto) : undefined)
    return r.ok ? res.json({ ok: true }) : res.status(400).json({ message: r.error || "No se pudo enviar." })
  }
  res.status(400).json({ message: "Acción no válida." })
}
