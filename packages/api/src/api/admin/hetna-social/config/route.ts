// GET/POST /admin/hetna-social/config -> redes activas, qué sale solo y horario.
// POST { probar: "instagram" } -> prueba la conexión con Instagram.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { enviarAN8n, guardarConfig, leerConfig } from "../../../../lib/social-hub"
import { infoThreads } from "../../../../lib/threads"
import { desvincular, leerTg, mandarBorradores, nuevoCodigo } from "../../../../lib/social-telegram"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ ...(await leerConfig(knex)), telegram: { vinculado: !!(await leerTg(knex)).chat_id } })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  // { probar: "instagram" } -> revisa que n8n vea la cuenta de Instagram ligada a la página
  const knexTg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  // Telegram: { telegram: "codigo" | "desvincular" | "probar" }
  const tg = (req.body as any)?.telegram
  if (tg === "codigo") return res.json({ codigo: await nuevoCodigo(knexTg) })
  if (tg === "desvincular") return res.json({ ok: true, r: await desvincular(knexTg) })
  if (tg === "probar") return res.json(await mandarBorradores(knexTg))
  if ((req.body as any)?.probar === "youtube") return res.json(await enviarAN8n({ red: "youtube_info", texto: "" }))
  if ((req.body as any)?.probar === "threads") {
    return res.json(await infoThreads(knexTg))
  }
  if ((req.body as any)?.probar === "instagram") return res.json(await enviarAN8n({ red: "instagram_info", texto: "" }))
  res.json(await guardarConfig(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), (req.body || {}) as any))
}
