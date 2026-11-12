// Verificar el WhatsApp del taller (panel del vendedor).
// GET  /vendor/hetna-whatsapp -> { verificado, numero?, avisos?, fotos? }
// POST /vendor/hetna-whatsapp { accion: "iniciar" | "codigo" | "confirmar", numero, codigo? }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { confirmarCodigo, estadoDe, iniciarVerificacion, mandarCodigo } from "../../../lib/whatsapp"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  res.json(await estadoDe(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), { seller_id: sellerId }))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const b: any = req.body || {}
  try {
    if (b.accion === "iniciar") {
      const r = await iniciarVerificacion(knex, { numero: String(b.numero || ""), quien: "taller", seller_id: sellerId })
      return res.json({ numero: r.numero, liga: r.liga })
    }
    if (b.accion === "codigo") return res.json(await mandarCodigo(knex, String(b.numero || "")))
    if (b.accion === "confirmar") return res.json(await confirmarCodigo(knex, String(b.numero || ""), String(b.codigo || "")))
    res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
