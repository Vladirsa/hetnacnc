// «Activar mi cuenta» (lib/afiliacion.ts).
//   GET  ?t=<liga>  (sin sesión): correo, nombre y número para la pantalla de
//        activación. Sólo con una liga válida; no sirve para averiguar correos.
//   POST { t }      (con la sesión de la cuenta recién creada): liga la cuenta
//        con su número, pasa sus solicitudes a «Mis solicitudes» y, si la liga
//        es la del correo, deja el correo confirmado y manda la bienvenida.
import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { afiliadoPorToken, ligarSolicitudesPorCorreo, tieneCuenta } from "../../../../lib/afiliacion"
import { bienvenidaAfiliado } from "../../../../lib/afiliacion-correos"
import { sendEmail } from "../../../../lib/resend"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const r = await afiliadoPorToken(knex, String((req.query as any)?.t || ""))
  if (!r) return res.status(404).json({ message: "Esta liga ya no es válida. Puedes crear tu cuenta normalmente." })
  const { afiliado: a, deCorreo } = r
  if (deCorreo && !a.customer_id) await knex("hetna_afiliado").where({ id: a.id }).update({ activando_en: knex.fn.now() })
  const [nombre, ...resto] = String(a.nombre || "").trim().split(/\s+/)
  res.json({
    numero: a.numero,
    email: a.email,
    first_name: nombre || "",
    last_name: resto.join(" "),
    telefono: a.telefono || "",
    cuenta_existe: !!a.customer_id || (await tieneCuenta(knex, a.email)),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const r = await afiliadoPorToken(knex, String(((req.body || {}) as any).t || ""))
  if (!r) return res.status(404).json({ message: "Esta liga ya no es válida." })
  const { afiliado: a, deCorreo } = r

  const clientes = req.scope.resolve(Modules.CUSTOMER) as any
  const [c] = await clientes.listCustomers({ id }, { take: 1 })
  // La liga sólo sirve para la cuenta de ESE correo
  if (!c?.email || c.email.toLowerCase() !== a.email) {
    return res.status(403).json({ message: "Esta liga es de otro correo." })
  }

  const yaVerificado = c.metadata?.correo_verificado === true
  const metadata: Record<string, unknown> = { ...(c.metadata || {}), afiliacion: a.numero }
  if (deCorreo && !yaVerificado) {
    metadata.correo_verificado = true
    metadata.correo_verificado_en = new Date().toISOString()
  }
  await clientes.updateCustomers(c.id, { metadata })
  await knex("hetna_afiliado").where({ id: a.id }).whereNull("customer_id").update({ customer_id: c.id, activado_en: knex.fn.now() })
  const ligadas = await ligarSolicitudesPorCorreo(knex, a.email, c.id).catch(() => 0)

  if (deCorreo && !yaVerificado) {
    await sendEmail({
      to: a.email,
      subject: `Tu cuenta de HETNA CNC está activa · afiliado ${a.numero}`,
      html: bienvenidaAfiliado({ nombre: c.first_name, numero: a.numero }),
    }).catch(() => undefined)
  }
  req.scope.resolve("logger").info(`[afiliacion] ${a.numero} activó su cuenta (${deCorreo ? "liga del correo" : "pantalla"}; ${ligadas} solicitudes ligadas)`)
  res.json({ ok: true, numero: a.numero, verificado: deCorreo || yaVerificado, solicitudes: ligadas })
}
