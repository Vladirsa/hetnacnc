// Membresía Empresarial de clientes (Licitaciones 3.0, Fase 3). Gratis por
// ahora: HETNA la activa a mano.
//   GET                                   -> clientes con membresía activa
//   POST { email, activa, hasta? }        -> activar o quitar por correo
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cambiarMembresia, listarMiembros } from "../../../lib/confianza"
import { STORE_URL, boton, marco } from "../../../lib/licitacion"
import { sendEmail } from "../../../lib/resend"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  res.json({ miembros: await listarMiembros(knex) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as { email?: string; activa?: boolean; hasta?: string }
  const email = String(b.email || "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Escribe un correo válido." })
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(b.hasta || "")) ? String(b.hasta) : null
  try {
    const n = await cambiarMembresia(knex, email, b.activa !== false, req.auth_context?.actor_id, hasta)
    res.json({ ok: true, cuentas: n })
    if (b.activa !== false) {
      await sendEmail({
        to: email,
        subject: "Tu Membresía Empresarial de HETNA CNC está activa",
        html: marco(
          "Membresía Empresarial activa",
          `<p style="color:#40403A">Ya puedes publicar licitaciones <b>privadas</b> (sólo talleres invitados) y <b>restringidas</b> (tus planos sólo para quien autorices), pedir el <b>resumen con IA</b> de tus propuestas y recibir propuestas <b>sólo de talleres verificados</b>.</p>` +
            boton("Publicar una licitación", `${STORE_URL}/mx/cotizar`)
        ),
      }).catch(() => undefined)
    }
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({ message: (e as Error).message })
  }
}
