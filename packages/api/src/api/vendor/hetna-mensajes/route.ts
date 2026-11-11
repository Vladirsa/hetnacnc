// GET /vendor/hetna-mensajes → conversaciones del taller con sus clientes
// (chat de HETNA). Cada una se abre en hetnacnc.com/chat-taller/<token>.
import type { MedusaResponse } from "@medusajs/framework/http"

import { mensajesDelTaller } from "../../../lib/clientes-taller"
import type { VendorRequest } from "../tablero/vendor-request"

export const GET = async (req: VendorRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    res.json(await mensajesDelTaller(sellerId))
  } catch (e) {
    res.status(502).json({ message: `No se pudieron leer tus mensajes: ${(e as Error).message}` })
  }
}
