// GET  /admin/hetna-social/pinterest -> { configurado, conectado, usuario, tablero, tableros, redirect }
// POST /admin/hetna-social/pinterest { accion: "conectar" } -> { url }
//                                    | { accion: "probar" } | { accion: "desconectar" } | { accion: "tablero", id }
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { desconectarPinterest, elegirTablero, estadoPinterest, infoPinterest, ligaConectarPinterest } from "../../../../lib/pinterest"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await estadoPinterest(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const b: any = req.body || {}
  try {
    if (b.accion === "conectar") return res.json({ url: await ligaConectarPinterest(knex) })
    if (b.accion === "probar") return res.json(await infoPinterest(knex))
    if (b.accion === "tablero") {
      await elegirTablero(knex, String(b.id || ""))
      return res.json({ ok: true, ...(await estadoPinterest(knex)) })
    }
    if (b.accion === "desconectar") {
      await desconectarPinterest(knex)
      return res.json({ ok: true, ...(await estadoPinterest(knex)) })
    }
    res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
