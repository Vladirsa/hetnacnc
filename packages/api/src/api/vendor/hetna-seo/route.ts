// Tablero del taller > Sugerencias para Google (lib/seo-titulos.ts)
//   GET  /vendor/hetna-seo                              -> { sugerencias: [...] }
//   POST /vendor/hetna-seo { product_id, accion: "aceptar" | "descartar" } -> { ok }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { aceptarSugerencia, descartarSugerencia, sugerenciasDelTaller } from "../../../lib/seo-titulos"

const idTaller = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = idTaller(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  res.json({ sugerencias: await sugerenciasDelTaller(req.scope, sellerId).catch(() => []) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = idTaller(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const b = (req.body || {}) as { product_id?: string; accion?: string }
  if (!b.product_id) return res.status(400).json({ message: "Falta el producto." })
  const r = b.accion === "descartar" ? await descartarSugerencia(req.scope, sellerId, b.product_id) : await aceptarSugerencia(req.scope, sellerId, b.product_id)
  res.status(r.ok ? 200 : 400).json(r)
}
