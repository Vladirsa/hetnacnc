// Cuando alguien se registra en HETNA (taller/vendedor o cliente con cuenta),
// avisa a n8n para que lo marque como REGISTRADO en la hoja de prospectos y
// deje de mandarle correos de la campaña. Ver scripts/prospectos/README.md.
//
// Variables:
//   N8N_PROSPECTOS_REGISTRO_URL  webhook del flujo "Prospectos · Registrado en HETNA"
//   N8N_PROSPECTOS_SECRETO       (opcional) se manda en el header x-hetna-secreto
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function prospectoRegistradoN8n({ event, container }: SubscriberArgs<{ id: string }>) {
  const url = process.env.N8N_PROSPECTOS_REGISTRO_URL
  if (!url) return
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const esTaller = event.name === "seller.created"

  try {
    let email = ""
    let nombre = ""
    if (esTaller) {
      const { data: [s] } = await query.graph({
        entity: "seller",
        fields: ["id", "email", "name"],
        filters: { id: event.data.id },
      } as any)
      email = (s as any)?.email || ""
      nombre = (s as any)?.name || ""
    } else {
      const { data: [c] } = await query.graph({
        entity: "customer",
        fields: ["id", "email", "first_name", "company_name", "has_account"],
        filters: { id: event.data.id },
      })
      if (!c?.has_account) return
      email = c.email || ""
      nombre = (c as any).company_name || c.first_name || ""
    }
    if (!email) return

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_PROSPECTOS_SECRETO ? { "x-hetna-secreto": process.env.N8N_PROSPECTOS_SECRETO } : {}),
      },
      body: JSON.stringify({
        tipo: esTaller ? "vendedor" : "cliente",
        id: event.data.id,
        email: email.toLowerCase().trim(),
        dominio: email.split("@")[1]?.toLowerCase() || "",
        nombre,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    logger.warn(`[prospectos] no se avisó a n8n del registro ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["seller.created", "customer.created"],
}
