// GET  /admin/hetna-social/tiktok -> { configurado, conectado, usuario, modo, redirect }
// POST /admin/hetna-social/tiktok { accion: "conectar" } -> { url } (abrir y entrar con la cuenta de HETNA)
//                                 | { accion: "probar" } | { accion: "desconectar" }
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { desconectarTikTok, estadoTikTok, infoTikTok, ligaConectar } from "../../../../lib/tiktok"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await estadoTikTok(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const b: any = req.body || {}
  try {
    if (b.accion === "conectar") return res.json({ url: await ligaConectar(knex) })
    if (b.accion === "probar") return res.json(await infoTikTok(knex))
    if (b.accion === "desconectar") {
      await desconectarTikTok(knex)
      return res.json({ ok: true, ...(await estadoTikTok(knex)) })
    }
    res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
