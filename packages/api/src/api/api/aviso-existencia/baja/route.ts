// GET /api/aviso-existencia/baja?t=<token>  → deja de avisar (liga del correo)
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { darDeBaja } from "../../../../lib/aviso-existencia"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await darDeBaja(knex, String(req.query.t || ""))
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;color:#142033"><h2>Listo</h2><p>Ya no te avisaremos de este producto.</p><p><a href="https://hetnacnc.com/mx">Volver a la tienda</a></p></body>`)
}
