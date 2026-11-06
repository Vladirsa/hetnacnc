import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { Modules } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../lib/baja"
import { abandonedCartSegundoEmailHtml } from "../lib/email-templates"
import { pushACliente } from "../lib/push"
import { sendEmail } from "../lib/resend"
import { sendAbandonedCartEmailWorkflow } from "../workflows/send-abandoned-cart-email"

// Dos toques por carrito:
//   1. A las 3 horas: correo "Dejaste algo en tu carrito" + aviso al celular
//      (si el cliente activó los avisos).
//   2. Un día después del primero (hasta 7 días de abandonado): correo corto
//      con ayuda por WhatsApp y el cupón de CARRITO_CUPON si existe, + aviso.
const SEGUNDO_HORAS = Number(process.env.ABANDONED_CART_SECOND_HOURS || 24)
const SEGUNDO_MAX_DIAS = 7
const WHATSAPP = (process.env.HETNA_WHATSAPP || "522461217072").replace(/\D/g, "")

const MIN_HOURS = Number(process.env.ABANDONED_CART_MIN_HOURS || 3)
const MAX_HOURS = Number(process.env.ABANDONED_CART_MAX_HOURS || 72)
const MAX_CARTS_PER_RUN = 50

type CandidateCart = {
  id: string
  email: string | null
  customer_id?: string | null
  currency_code: string
  total: number | null
  metadata: Record<string, unknown> | null
  updated_at: string
  items: { title: string; quantity: number }[] | null
}

export default async function abandonedCartReminder(container: MedusaContainer) {
  const logger = container.resolve("logger")

  if (!process.env.RESEND_API_KEY) {
    // Nada que hacer sin proveedor de email configurado; evitamos spamear el
    // log cada hora con un warning.
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const now = Date.now()
  const upperBound = new Date(now - MIN_HOURS * 60 * 60 * 1000) // carritos más nuevos que esto: aún no "abandonados"
  const lowerBound = new Date(now - MAX_HOURS * 60 * 60 * 1000) // carritos más viejos que esto: ya no vale la pena insistir

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "customer_id",
      "currency_code",
      "total",
      "metadata",
      "updated_at",
      "completed_at",
      "items.title",
      "items.quantity",
    ],
    filters: {
      completed_at: null,
    },
  })

  const storefrontUrl =
    process.env.STOREFRONT_URL || process.env.STOREFRONT_REVALIDATE_URL || "http://localhost:3000"

  const eligible = (carts as CandidateCart[])
    .filter((cart) => {
      if (!cart.email || !cart.items?.length) return false
      if (cart.metadata?.abandoned_email_sent_at) return false

      const updatedAt = new Date(cart.updated_at).getTime()
      return updatedAt <= upperBound.getTime() && updatedAt >= lowerBound.getTime()
    })
    .slice(0, MAX_CARTS_PER_RUN)

  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  let sent = 0
  for (const cart of eligible) {
    try {
      const { result } = await sendAbandonedCartEmailWorkflow(container).run({
        input: {
          cart_id: cart.id,
          email: cart.email as string,
          items: (cart.items || []).map((i) => ({ title: i.title, quantity: i.quantity })),
          total: cart.total || 0,
          currency_code: cart.currency_code,
          cart_url: `${storefrontUrl}/mx/cart`,
          metadata: cart.metadata,
        },
      })
      if (result?.sent) {
        sent += 1
        await pushACliente(
          knex,
          { customerId: cart.customer_id, email: cart.email },
          {
            titulo: "Dejaste algo en tu carrito 🛒",
            cuerpo: `${cart.items?.[0]?.title || "Tus productos"}${(cart.items?.length || 0) > 1 ? ` y ${(cart.items?.length || 1) - 1} más` : ""} te esperan. Termina tu compra.`,
            url: "/mx/cart",
            etiqueta: `carrito-${cart.id}`,
          },
          logger
        )
      }
    } catch (e) {
      logger.error(`[abandoned-cart] fallo para cart ${cart.id}: ${e}`)
    }
  }

  // ── Segundo recordatorio ────────────────────────────────────────────────
  const cartService = container.resolve(Modules.CART) as any
  const cupon = (process.env.CARRITO_CUPON || "").trim() || null
  const segundos = (carts as CandidateCart[])
    .filter((cart) => {
      const primero = cart.metadata?.abandoned_email_sent_at
      if (!cart.email || !cart.items?.length || !primero || cart.metadata?.abandoned_second_sent_at) return false
      const desdePrimero = now - new Date(String(primero)).getTime()
      const desdeCambio = now - new Date(cart.updated_at).getTime()
      return desdePrimero >= SEGUNDO_HORAS * 3_600_000 && desdeCambio <= SEGUNDO_MAX_DIAS * 86_400_000
    })
    .slice(0, MAX_CARTS_PER_RUN)
  let segundosEnviados = 0
  for (const cart of segundos) {
    try {
      const correo = cart.email as string
      const deBaja = await estaDeBaja(knex, correo).catch(() => false)
      if (!deBaja) {
        const r = await sendEmail({
          to: correo,
          bajaUrl: ligaBaja(correo),
          subject: "¿Te ayudamos a terminar tu compra?",
          html: abandonedCartSegundoEmailHtml({
            items: cart.items || [],
            cartUrl: `${storefrontUrl}/mx/cart`,
            whatsappUrl: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, tengo una duda sobre mi carrito en HETNA CNC")}`,
            cupon,
          }),
        })
        if (!r.sent && !r.configuracion) continue
        if (r.sent) segundosEnviados++
        await pushACliente(
          knex,
          { customerId: cart.customer_id, email: correo },
          {
            titulo: "Tu carrito sigue guardado",
            cuerpo: cupon ? `Usa el cupón ${cupon} y termina tu compra.` : "¿Dudas? Escríbenos por WhatsApp y te ayudamos.",
            url: "/mx/cart",
            etiqueta: `carrito-${cart.id}`,
          },
          logger
        )
      }
      await cartService.updateCarts(cart.id, {
        metadata: { ...(cart.metadata || {}), abandoned_second_sent_at: new Date().toISOString() },
      })
    } catch (e) {
      logger.error(`[abandoned-cart] segundo recordatorio ${cart.id}: ${e}`)
    }
  }
  if (segundosEnviados) logger.info(`[abandoned-cart] ${segundosEnviados} segundos recordatorios`)

  logger.info(
    `[abandoned-cart] revisados ${carts.length} carritos, ${eligible.length} elegibles, ${sent} correos enviados`
  )
}

export const config = {
  name: "abandoned-cart-reminder",
  schedule: "0 * * * *",
}
