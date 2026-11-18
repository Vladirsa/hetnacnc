import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cambiarSobrepesoConSaldo } from "../../../../lib/saldos-talleres"
import { T_SOBREPESO, asegurarTablaSobrepesos, cobrarSobrepeso, folioSobrepeso } from "../../../../lib/sobrepesos"

// Cambiar el estado de un sobrepeso desde el panel.
//   POST /admin/hetna-sobrepesos/:id  { accion }
//     cobrar     -> liga de pago y correo al responsable (bloquea nuevas guías)
//     disputar   -> se está peleando con la paquetería (no bloquea)
//     anular     -> la paquetería dio la razón: no se cobra
//     pagado     -> se pagó por fuera (transferencia, efectivo)
//     descontado -> se descuenta del pago al taller: entra un renglón negativo a
//                   su saldo en "Pagos a talleres" (lib/saldos-talleres.ts). Ya
//                   descontado, sólo se puede anular (devuelve el descuento si
//                   aún no se le pagó); cobrar de nuevo sería cobrarle dos veces.
const DESTINO: Record<string, string> = { disputar: "en_disputa", anular: "anulado", pagado: "pagado", descontado: "descontado" }

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaSobrepesos(knex)
  const s = await knex(T_SOBREPESO).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Sobrepeso no encontrado." })
  const accion = String((req.body as any)?.accion || "")
  if (s.estado === "pagado" && accion !== "anular") return res.status(400).json({ message: "Este sobrepeso ya está pagado." })

  if (accion === "descontado" && s.responsable_tipo !== "taller")
    return res.status(400).json({ message: "Sólo a un taller se le puede descontar de sus pagos." })
  // Descontar y lo que sale de "descontado" pasan por el saldo del taller
  const d = await cambiarSobrepesoConSaldo(knex, s, accion)
  if (d?.tipo === "bloqueado") return res.status(409).json({ message: d.mensaje })
  if (d) {
    const estado = d.tipo === "nada" || d.tipo === "descontar" ? "descontado" : "anulado"
    logger.info(`[sobrepesos] ${folioSobrepeso(s.folio)} -> ${estado} (${d.tipo})`)
    return res.json({ ok: true, estado })
  }

  if (accion === "cobrar") {
    const r = await cobrarSobrepeso(knex, s, logger)
    return res.json({ ok: true, ...r })
  }
  const estado = DESTINO[accion]
  if (!estado) return res.status(400).json({ message: "Acción no válida." })
  // Condicionado al estado que se leyó: si otra acción lo cambió mientras tanto
  // (p. ej. se descontó), no se pisa
  const n = await knex(T_SOBREPESO).where({ id: s.id, estado: s.estado }).update({ estado, updated_at: knex.fn.now() })
  if (!n) return res.status(409).json({ message: "El sobrepeso cambió mientras tanto. Recarga la página." })
  logger.info(`[sobrepesos] ${folioSobrepeso(s.folio)} -> ${estado}`)
  return res.json({ ok: true, estado })
}
