// Panel del taller › Licencias de mis diseños (lib/licencias.ts)
//   GET  /vendor/hetna-licencias  -> { disenos: [{ id, titulo, licencia, piezas }] }
//   POST /vendor/hetna-licencias  { product_id, licencia, piezas? }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorLicencia, disenosDelTaller, guardarLicencia } from "../../../lib/licencias"

const vendedor = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = vendedor(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  res.json({ disenos: await disenosDelTaller(req.scope, sellerId) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = vendedor(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const b = (req.body || {}) as Record<string, unknown>
  try {
    res.json(await guardarLicencia(req.scope, sellerId, String(b.product_id || ""), b.licencia, b.piezas))
  } catch (e) {
    if (e instanceof ErrorLicencia) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[licencias] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar la licencia. Intenta de nuevo." })
  }
}
