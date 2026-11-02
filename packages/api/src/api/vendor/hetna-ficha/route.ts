// Panel del taller > Ficha extendida (lib/ficha-extendida.ts)
//   GET /vendor/hetna-ficha -> { productos: [{ id, titulo, handle, foto, estado, ficha, completa }], limites }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { LIMITES, productosDelTaller } from "../../../lib/ficha-extendida"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    res.json({ productos: await productosDelTaller(req.scope, sellerId), limites: LIMITES })
  } catch (e) {
    req.scope.resolve("logger").error(`[ficha] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron cargar tus productos." })
  }
}
