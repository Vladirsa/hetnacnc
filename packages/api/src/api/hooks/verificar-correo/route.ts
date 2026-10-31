// Confirmación de correo (lib/verificar-correo.ts). Llega desde la tienda:
//   GET  /hooks/verificar-correo?c=<cliente>&e=<vence>&t=<firma>  -> confirma
//   POST /hooks/verificar-correo  { email }                        -> reenvía la liga
// El POST no dice si el correo existe (para no regalar qué correos tienen cuenta).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import {
  VERIFICAR_DESDE,
  firmaVerificacionValida,
  mandarCorreoVerificacion,
  requiereVerificacion,
} from "../../../lib/verificar-correo"
import { sendEmail } from "../../../lib/resend"
import { welcomeEmailHtml } from "../../../lib/email-templates"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, string>
  const id = String(q.c || "")
  if (!firmaVerificacionValida(id, String(q.e || ""), String(q.t || ""))) {
    return res.status(400).json({ ok: false, motivo: "liga" })
  }
  const clientes = req.scope.resolve(Modules.CUSTOMER) as any
  const [c] = await clientes.listCustomers({ id }, { take: 1 })
  if (!c) return res.status(404).json({ ok: false, motivo: "cuenta" })

  if (c.metadata?.correo_verificado !== true) {
    await clientes.updateCustomers(id, {
      metadata: { ...(c.metadata || {}), correo_verificado: true, correo_verificado_en: new Date().toISOString() },
    })
    req.scope.resolve("logger").info(`[verificar-correo] ${c.email} confirmó su correo`)
    // La bienvenida va ahora, ya con el correo confirmado. Las cuentas de antes
    // (que confirman al activar el Cotizador) ya la recibieron al registrarse.
    const nueva = !c.created_at || new Date(c.created_at).getTime() >= VERIFICAR_DESDE().getTime()
    if (nueva) await sendEmail({
      to: c.email,
      subject: `¡Bienvenido a ${process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"}!`,
      html: welcomeEmailHtml({ name: c.first_name || "" }),
    }).catch(() => undefined)
  }
  res.json({ ok: true, email: c.email })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const correo = String(((req.body || {}) as { email?: string }).email || "").trim().toLowerCase()
  if (correo.includes("@")) {
    const clientes = req.scope.resolve(Modules.CUSTOMER) as any
    const lista = await clientes.listCustomers({ email: correo, has_account: true }, { take: 1 })
    const c = lista[0]
    if (c && requiereVerificacion(c)) {
      await mandarCorreoVerificacion({ id: c.id, email: c.email, first_name: c.first_name }).catch(() => undefined)
    }
  }
  res.json({ ok: true })
}
