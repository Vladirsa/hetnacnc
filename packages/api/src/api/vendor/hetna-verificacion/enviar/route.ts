// POST /vendor/hetna-verificacion/enviar -> manda los documentos a revisión
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarExpediente, leerExpediente, vistaTaller } from "../../../../lib/verificacion"
import { faltantes } from "../../../../lib/verificacion-archivos"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRECIO_VERIFICACION_GRATIS, debePagarVerificacion } from "../../../../lib/confianza"
import { planComision } from "../../../../lib/licitacion-cobro"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const exp = await leerExpediente(req.scope, sellerId)
  if (!exp) return res.status(400).json({ message: "Primero sube tus documentos." })
  if (exp.estado === "en_revision") return res.status(409).json({ message: "Ya está en revisión." })
  if (exp.estado === "verificado") return res.status(409).json({ message: "Tu taller ya está verificado." })
  const falta = faltantes(exp.archivos)
  if (falta.length) return res.status(400).json({ message: "Falta: " + falta.join(", ") })

  // Fase 3: con plan Gratis la verificación cuesta $299 (una sola vez); en los
  // planes de pago va incluida.
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const vendedor = await knex("seller").where({ id: sellerId }).first("id", "email", "metadata")
  const plan = await planComision(vendedor || {}).catch(() => "gratis")
  if (vendedor && debePagarVerificacion(plan, vendedor)) {
    return res.status(402).json({ message: `Con el plan Gratis la verificación cuesta $${PRECIO_VERIFICACION_GRATIS} (una sola vez). En los planes Taller, Pro e Industrial va incluida.`, pagar: true })
  }

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
