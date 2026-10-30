// Liga de descarga de una compra digital, generada en el momento.
//   GET /store/customers/me/descargas/:productId
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getSignedDownloadUrl } from "../../../../../../lib/backblaze"
import { comprasDigitales } from "../../../../../../lib/mis-descargas"

// Se usa en el momento: con una hora sobra, y se pide otra en un clic.
const DURACION_S = 60 * 60

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const compra = (await comprasDigitales(req.scope, req.auth_context.actor_id)).find((c) => c.product_id === req.params.productId)
  if (!compra) return res.status(404).json({ message: "No encontramos esa compra en tu cuenta." })
  const liga = await getSignedDownloadUrl(compra.storage_key, DURACION_S)
  if (!liga.ok) {
    req.scope.resolve("logger").error(`[mis-descargas] sin liga para ${compra.storage_key}: ${liga.reason}`)
    return res.status(503).json({ message: "No pudimos preparar tu descarga. Intenta en un momento." })
  }
  res.json({ url: liga.url })
}
