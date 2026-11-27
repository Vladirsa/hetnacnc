// Idioma de los correos del cliente (lib/idioma-correo.ts)
//   POST /store/hetna-idioma { idioma: "es" | "en", cart_id? }
// Con sesión de cliente se guarda para su correo. Sin sesión, sólo para el
// correo que ya tiene el carrito (así nadie puede cambiar el idioma de un
// correo ajeno escribiéndolo a mano).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarIdiomaCorreo } from "../../../lib/idioma-correo"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as { idioma?: string; cart_id?: string }
  const idioma = b.idioma === "en" ? "en" : b.idioma === "es" ? "es" : null
  if (!idioma) return res.status(400).json({ message: "Idioma no válido." })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  try {
    let email: string | null = null
    const clienteId = req.auth_context?.actor_type === "customer" ? req.auth_context.actor_id : null
    if (clienteId) {
      const { data } = await query.graph({ entity: "customer", fields: ["email"], filters: { id: clienteId } })
      email = data?.[0]?.email || null
    } else if (typeof b.cart_id === "string" && /^cart_[A-Za-z0-9]+$/.test(b.cart_id)) {
      const { data } = await query.graph({ entity: "cart", fields: ["email", "completed_at"], filters: { id: b.cart_id } })
      email = data?.[0] && !data[0].completed_at ? data[0].email || null : null
    }
    if (!email) return res.json({ guardado: false })
    await guardarIdiomaCorreo(email, idioma)
    res.json({ guardado: true })
  } catch (e) {
    req.scope.resolve("logger").warn(`[idioma-correo] ${(e as Error).message}`)
    res.json({ guardado: false })
  }
}
