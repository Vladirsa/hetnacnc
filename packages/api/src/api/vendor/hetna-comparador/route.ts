// Tablero del taller > ¿Buscas una máquina o refacción? (lib/comparador-proveedores.ts)
//   POST /vendor/hetna-comparador { consulta } -> { ok, en_hetna[], opciones[], consejo }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { compararProveedores } from "../../../lib/comparador-proveedores"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    const r = await compararProveedores(req.scope, sellerId, String((req.body as any)?.consulta || ""))
    res.status(r.ok ? 200 : 400).json(r)
  } catch (e) {
    req.scope.resolve("logger").warn(`[comparador] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo buscar ahora. Intenta en unos minutos." })
  }
}
