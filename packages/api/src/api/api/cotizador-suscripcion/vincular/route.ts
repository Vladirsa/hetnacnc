import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { vincularDesdeApp } from "../../../../lib/cotizador-vinculo"
import { responder, tokenDe } from "../respuesta"

// POST https://hetnacnc.com/api/cotizador-suscripcion/vincular  { codigo }
// La app (con la sesión del administrador del taller) manda el código de 6
// dígitos que la persona sacó en hetnacnc.com → Mi cuenta. Ver lib/cotizador-vinculo.ts.
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const codigo = String(((req.body || {}) as { codigo?: string }).codigo || "")
    return vincularDesdeApp(knex, tokenDe(req), codigo)
  })
