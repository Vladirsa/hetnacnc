import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../../../lib/baja"
import { T_PLANOS, asegurarTablaPlanos, cargarNombresPlanos, correoPlanoHtml, nombrePlano, validarPedidoPlano } from "../../../lib/planos-correo"
import { sendEmail } from "../../../lib/resend"

// POST /store/planos-correo { email, plano, acepta, promos?, nombre? }
// "Bájalo gratis con tu correo" de la Biblioteca de planos (/planos/[slug]).
// Guarda el pedido y manda la liga al plano. Un correo por dirección y plano
// al día, para que nadie use esto para llenar el buzón de otro.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const b = (req.body || {}) as Record<string, unknown>
  if (b.sitio_web) return res.json({ ok: true }) // trampa para bots
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await cargarNombresPlanos(knex)
  const v = validarPedidoPlano(b)
  if (!v.ok) return res.status(400).json({ message: v.mensaje })
  const d = v.datos
  await asegurarTablaPlanos(knex)

  const yaHoy = await knex(T_PLANOS)
    .where({ email: d.email, plano: d.plano })
    .where("created_at", ">", knex.raw("now() - interval '1 day'"))
    .first("id")
    .catch(() => null)
  await knex(T_PLANOS).insert({ email: d.email, nombre: d.nombre, plano: d.plano, promos: d.promos }).catch((e: unknown) => logger.warn(`[planos-correo] no se guardó: ${String(e)}`))
  if (yaHoy || (await estaDeBaja(knex, d.email).catch(() => false))) return res.json({ ok: true })

  const r = await sendEmail({
    to: d.email,
    bajaUrl: ligaBaja(d.email),
    subject: `Tu plano gratis: ${nombrePlano(d.plano)} — HETNA CNC`,
    html: correoPlanoHtml(d.plano, d.nombre),
  })
  if (!r.sent) logger.info(`[planos-correo] no enviado: ${r.reason}`)
  res.json({ ok: true })
}
