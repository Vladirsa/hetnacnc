import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Medusa no expone un "listar todos los carritos" en su Admin API (solo
// GET /admin/carts/:id, por carrito individual). Esta ruta existe para que
// el workflow de n8n de recordatorio de carrito abandonado por WhatsApp
// pueda traer los carritos abiertos en un solo request, igual que ya hace
// el job de email de carrito abandonado (src/jobs/abandoned-cart-reminder.ts)
// usando el query service directo.
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

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
      "shipping_address.phone",
    ],
    filters: {
      completed_at: null,
    },
  })

  res.json({ carts })
}
