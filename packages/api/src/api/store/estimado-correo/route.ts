import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../../../lib/baja"
import { quoteLeadEmailHtml } from "../../../lib/email-templates"
import { T_ESTIMADO, asegurarTablaEstimado, guardarEstimado } from "../../../lib/estimados"
import { sendEmail } from "../../../lib/resend"
import { validarEstimadoCorreo } from "../../../lib/estimado-correo"

// POST /store/estimado-correo: "Mándame este estimado por correo" del
// cotizador de /cotizar (el estimado se calcula en el navegador). Con permiso
// expreso (casilla), manda el rango que vio y lo guarda para el Reactivador de
// estimados (lib/estimados.ts: seguimiento a los 2 y 7 días). Un correo por
// dirección al día, para que nadie use esto para llenar el buzón de otro.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const b = (req.body || {}) as Record<string, unknown>
  if (b.sitio_web) return res.json({ ok: true }) // trampa para bots
  const v = validarEstimadoCorreo(b)
  if (!v.ok) return res.status(400).json({ message: v.mensaje })
  const e = v.datos
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  await asegurarTablaEstimado(knex)
  const yaHoy = await knex(T_ESTIMADO)
    .where({ email: e.email })
    .whereNull("herramienta") // "Mándamelo por correo" de las herramientas va aparte
    .where("created_at", ">", knex.raw("now() - interval '1 day'"))
    .first("id")
    .catch(() => null)
  if (yaHoy || (await estaDeBaja(knex, e.email).catch(() => false))) {
    // Sin avisar si ya se mandó: el cliente ve "listo" igual
    await guardarEstimado(knex, e)
    return res.json({ ok: true })
  }
  const numero = process.env.OWNER_WHATSAPP_NUMBER
  const texto = encodeURIComponent(`Hola HETNA CNC, vi mi estimado de ${e.servicio} (${e.cantidad} pieza(s), ${e.material || "material a confirmar"}) y quiero propuestas.`)
  const r = await sendEmail({
    to: e.email,
    bajaUrl: ligaBaja(e.email),
    subject: `Tu estimado de ${e.servicio} — HETNA CNC`,
    html: quoteLeadEmailHtml({
      servicioNombre: e.servicio,
      estimadoMin: e.estimado_min,
      estimadoMax: e.estimado_max,
      whatsappUrl: numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`,
    }),
  })
  if (!r.sent) logger.info(`[estimado-correo] no enviado: ${r.reason}`)
  await guardarEstimado(knex, e)
  res.json({ ok: true })
}
