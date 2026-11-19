// Créditos de regalo al abrir la cuenta (lib/precios-diseno.ts): alcanzan para
// diseñar y bajar 2–3 muebles o una cocina, así el taller prueba sin pagar.
// Sólo para cuentas reales (no los clientes que crea un pago como invitado) y
// una sola vez por cliente (se revisa el ledger antes de dar).
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CREDIT_MODULE } from "../modules/credit"
import CreditModuleService from "../modules/credit/service"
import { CREDITOS_BIENVENIDA } from "../lib/precios-diseno"
import { grantCreditsWorkflow } from "../workflows/grant-credits"

export default async function creditosBienvenida({ event, container }: SubscriberArgs<{ id: string }>) {
  if (!(CREDITOS_BIENVENIDA > 0)) return
  const logger = container.resolve("logger")
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [cliente],
    } = await query.graph({ entity: "customer", fields: ["id", "has_account"], filters: { id: event.data.id } })
    if (!cliente?.has_account) return
    const referencia = `bienvenida:${cliente.id}`
    const creditos = container.resolve<CreditModuleService>(CREDIT_MODULE)
    const ya = await creditos.listCreditLedgerEntries({ customer_id: cliente.id, reference_id: referencia }, { take: 1 })
    if (ya.length) return
    await grantCreditsWorkflow(container).run({
      input: { customer_id: cliente.id, amount: CREDITOS_BIENVENIDA, type: "ajuste", reference_id: referencia, description: `Regalo de bienvenida: ${CREDITOS_BIENVENIDA} créditos para diseñar` },
    })
  } catch (e) {
    logger.warn(`[creditos] no se pudo dar la bienvenida a ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "customer.created" }
