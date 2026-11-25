// GET /store/hetna-planos -> { planos } publicados desde la base de datos
// (lib/planos-biblioteca.ts). La tienda los suma a los planos del código.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { publicadosDeBiblioteca } from "../../../lib/planos-biblioteca"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const planos = await publicadosDeBiblioteca(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
    res.setHeader("Cache-Control", "public, max-age=60")
    res.json({ planos })
  } catch (e) {
    req.scope.resolve("logger").warn(`[hetna-planos] ${(e as Error).message}`)
    res.json({ planos: [] })
  }
}
