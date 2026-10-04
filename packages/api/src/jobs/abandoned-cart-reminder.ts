import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendAbandonedCartEmailWorkflow } from "../workflows/send-abandoned-cart-email"

const MIN_HOURS = Number(process.env.ABANDONED_CART_MIN_HOURS || 3)
const MAX_HOURS = Number(process.env.ABANDONED_CART_MAX_HOURS || 72)
const MAX_CARTS_PER_RUN = 50

type CandidateCart = {
  id: string
  email: string | null
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
      if (result?.sent) sent += 1
    } catch (e) {
      logger.error(`[abandoned-cart] fallo para cart ${cart.id}: ${e}`)
    }
  }

  logger.info(
    `[abandoned-cart] revisados ${carts.length} carritos, ${eligible.length} elegibles, ${sent} correos enviados`
  )
}

export const config = {
  name: "abandoned-cart-reminder",
  schedule: "0 * * * *",
}
