// Panel del taller > Productos en inglés (lib/productos-ingles.ts)
//   GET /vendor/hetna-ingles -> { productos: [{ id, handle, foto, estado, es, en, auto, traduccion }], ia, limites }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { iaInglesEncendida, LIMITES_EN, productosParaIngles } from "../../../lib/productos-ingles"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    res.json({ productos: await productosParaIngles(req.scope, sellerId), ia: iaInglesEncendida(), limites: LIMITES_EN })
  } catch (e) {
    req.scope.resolve("logger").error(`[ingles] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron cargar tus productos." })
  }
}
