// GET/POST /admin/hetna-social/config -> redes activas, qué sale solo y horario.
// POST { probar: "instagram" } -> prueba la conexión con Instagram.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { enviarAN8n, guardarConfig, leerConfig } from "../../../../lib/social-hub"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await leerConfig(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  // { probar: "instagram" } -> revisa que n8n vea la cuenta de Instagram ligada a la página
  if ((req.body as any)?.probar === "instagram") return res.json(await enviarAN8n({ red: "instagram_info", texto: "" }))
  res.json(await guardarConfig(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), (req.body || {}) as any))
}
