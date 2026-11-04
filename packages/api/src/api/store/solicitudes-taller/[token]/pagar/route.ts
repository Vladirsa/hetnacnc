// POST /store/solicitudes-taller/:token/pagar  { proveedor: "mercadopago" | "paypal" }
// Liga del siguiente cobro (anticipo, resto o total) de la propuesta elegida.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas, folioTexto } from "../../../../../lib/licitacion"
import { ligaDePago } from "../../../../../lib/licitacion-cobro"

export const POST = async (req: MedusaRequest<{ proveedor?: string }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })
  const proveedor = (req.body as any)?.proveedor === "paypal" ? "paypal" : "mercadopago"

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  // "cerrada" también: el resto de un anticipo se puede pagar después de la entrega
  if (!["elegida", "pagada", "cerrada"].includes(s.estado)) return res.status(409).json({ message: "Esta solicitud no tiene pagos pendientes." })
  try {
    const r = await ligaDePago(knex, s, proveedor, logger)
    return res.json({ ok: true, url: r.url, monto: r.monto, tipo: r.tipo })
  } catch (e) {
    const err = e as Error & { status?: number }
    logger.error(`[licitacion] ${folioTexto(s.folio)} liga de pago ${proveedor}: ${err.message}`)
    return res.status(err.status || 502).json({ message: err.status ? err.message : "No se pudo crear la liga de pago. Intenta de nuevo en un momento." })
  }
}
