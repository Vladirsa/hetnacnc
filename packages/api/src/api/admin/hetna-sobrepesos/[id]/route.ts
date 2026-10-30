import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOBREPESO, asegurarTablaSobrepesos, cobrarSobrepeso, folioSobrepeso } from "../../../../lib/sobrepesos"

// Cambiar el estado de un sobrepeso desde el panel.
//   POST /admin/hetna-sobrepesos/:id  { accion }
//     cobrar     -> liga de pago y correo al responsable (bloquea nuevas guías)
//     disputar   -> se está peleando con la paquetería (no bloquea)
//     anular     -> la paquetería dio la razón: no se cobra
//     pagado     -> se pagó por fuera (transferencia, efectivo)
//     descontado -> se descontó del pago al taller
const DESTINO: Record<string, string> = { disputar: "en_disputa", anular: "anulado", pagado: "pagado", descontado: "descontado" }

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaSobrepesos(knex)
  const s = await knex(T_SOBREPESO).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Sobrepeso no encontrado." })
  const accion = String((req.body as any)?.accion || "")
  if (s.estado === "pagado" && accion !== "anular") return res.status(400).json({ message: "Este sobrepeso ya está pagado." })

  if (accion === "cobrar") {
    const r = await cobrarSobrepeso(knex, s, logger)
    return res.json({ ok: true, ...r })
  }
  if (accion === "descontado" && s.responsable_tipo !== "taller")
    return res.status(400).json({ message: "Sólo a un taller se le puede descontar de sus pagos." })
  const estado = DESTINO[accion]
  if (!estado) return res.status(400).json({ message: "Acción no válida." })
  await knex(T_SOBREPESO).where({ id: s.id }).update({ estado, updated_at: knex.fn.now() })
  logger.info(`[sobrepesos] ${folioSobrepeso(s.folio)} -> ${estado}`)
  return res.json({ ok: true, estado })
}
