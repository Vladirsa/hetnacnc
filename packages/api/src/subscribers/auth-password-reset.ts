import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { STORE_URL, boton, esc, marco } from "../lib/licitacion"
import { sendEmail } from "../lib/resend"

// Correo de "restablecer contraseña". Medusa genera el token y avisa con el
// evento auth.password_reset, pero NO manda ningún correo por su cuenta: sin
// este suscriptor el botón "Restablecer contraseña" no hacía nada visible.
//
// Una misma persona puede ser cliente, vendedor y administrador con el mismo
// correo; la liga lleva a la pantalla de cada uno:
//   customer -> tienda       /mx/reset-password
//   seller   -> panel taller /seller/reset-password
//   user     -> dashboard    /dashboard/reset-password
// El token de Medusa dura 15 minutos.
const DESTINO: Record<string, { ruta: string; donde: string }> = {
  customer: { ruta: "/mx/reset-password", donde: "tu cuenta de la tienda" },
  seller: { ruta: "/seller/reset-password", donde: "tu panel de vendedor" },
  user: { ruta: "/dashboard/reset-password", donde: "el panel de administración" },
}

export default async function authPasswordReset({
  event,
  container,
}: SubscriberArgs<{ entity_id: string; actor_type: string; token: string }>) {
  const logger = container.resolve("logger")
  const { entity_id: correo, actor_type, token } = event.data || ({} as any)
  if (!correo || !token) return

  const d = DESTINO[actor_type] || DESTINO.customer
  const liga = `${STORE_URL}${d.ruta}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(correo)}`

  const r = await sendEmail({
    to: correo,
    subject: "Restablece tu contraseña de HETNA CNC",
    html: marco(
      "Restablece tu contraseña",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Pediste cambiar la contraseña de ${esc(d.donde)} (${esc(correo)}). Presiona el botón para elegir una nueva. La liga sirve durante <b>15 minutos</b>.</p>` +
        boton("Elegir mi nueva contraseña", liga) +
        `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Si tú no lo pediste, ignora este correo: tu contraseña no cambia.</p>`
    ),
  })
  if (r.sent) logger.info(`[password-reset] liga enviada a ${correo} (${actor_type})`)
  else logger.warn(`[password-reset] no se pudo enviar a ${correo}: ${r.reason}`)
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
