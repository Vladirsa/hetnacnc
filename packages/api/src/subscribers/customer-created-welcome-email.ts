import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../lib/resend"
import { welcomeEmailHtml } from "../lib/email-templates"
import { mandarCorreoVerificacion, requiereVerificacion } from "../lib/verificar-correo"

export default async function customerCreatedWelcomeEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "has_account", "created_at", "metadata"],
      filters: { id: event.data.id },
    })

    // Los checkouts de invitado también crean un registro de customer sin
    // cuenta: no les mandamos correo de bienvenida, solo a quien se registró.
    if (!customer?.email || !customer.has_account) {
      return
    }

    // Cuenta nueva: primero tiene que confirmar el correo. La bienvenida sale
    // cuando lo confirma (api/hooks/verificar-correo).
    if (requiereVerificacion(customer as any)) {
      const r = await mandarCorreoVerificacion({ id: customer.id, email: customer.email, first_name: customer.first_name })
      logger.info(`[verificar-correo] liga ${r.sent ? "enviada" : `no enviada (${r.reason})`} a ${customer.email}`)
      return
    }

    const { sent, reason } = await sendEmail({
      to: customer.email,
      subject: `¡Bienvenido a ${process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"}!`,
      html: welcomeEmailHtml({ name: customer.first_name || "" }),
    })

    if (sent) {
      logger.info(`[welcome-email] enviado a ${customer.email}`)
    } else {
      logger.info(`[welcome-email] no enviado a ${customer.email}: ${reason}`)
    }
  } catch (e) {
    logger.error(`[welcome-email] fallo para customer ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
