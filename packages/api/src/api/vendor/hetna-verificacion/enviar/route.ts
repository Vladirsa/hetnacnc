// POST /vendor/hetna-verificacion/enviar -> manda los documentos a revisión
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarExpediente, leerExpediente, vistaTaller } from "../../../../lib/verificacion"
import { faltantes } from "../../../../lib/verificacion-archivos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const exp = await leerExpediente(req.scope, sellerId)
  if (!exp) return res.status(400).json({ message: "Primero sube tus documentos." })
  if (exp.estado === "en_revision") return res.status(409).json({ message: "Ya está en revisión." })
  if (exp.estado === "verificado") return res.status(409).json({ message: "Tu taller ya está verificado." })
  const falta = faltantes(exp.archivos)
  if (falta.length) return res.status(400).json({ message: "Falta: " + falta.join(", ") })

  // Consentimiento expreso para tratar la identificación (LFPDPPP arts. 7-8)
  if ((req.body as { consentimiento?: unknown } | undefined)?.consentimiento !== true) {
    return res.status(400).json({ message: "Para enviar necesitas autorizar el uso de tus documentos para la verificación." })
  }

  const ahora = new Date()
  await guardarExpediente(req.scope, exp.id, { estado: "en_revision", enviado_en: ahora, consentimiento_en: ahora, motivo: null })
  const logger = req.scope.resolve("logger")
  logger.info(`[verificacion] ${sellerId} envió sus documentos a revisión`)
  res.json(vistaTaller(await leerExpediente(req.scope, sellerId)))
}
