// POST /vendor/hetna-clientes/:id/chat { mensaje } → el taller le escribe a
// un cliente que ya le compró, por el chat de HETNA. Devuelve { id, token }
// para abrir la conversación en hetnacnc.com/chat-taller/<token>.
import type { MedusaResponse } from "@medusajs/framework/http"

import { ErrorClientes, iniciarChatTaller } from "../../../../../lib/clientes-taller"
import type { VendorRequest } from "../../../tablero/vendor-request"

export const POST = async (req: VendorRequest<{ mensaje?: string }>, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    res.json(await iniciarChatTaller(req.scope, sellerId, String(req.params.id || ""), req.body?.mensaje))
  } catch (e) {
    if (e instanceof ErrorClientes) return res.status(e.status).json({ message: e.message, ...e.extra })
    res.status(502).json({ message: "No se pudo enviar. Intenta de nuevo." })
  }
}
