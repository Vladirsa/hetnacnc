// Aprueba una tienda (pending_approval -> open) sin entrar al admin.
// Uso (en packages/api):
//   NODE_ENV=production bunx medusa exec ./src/scripts/aprobar-tienda.ts
//   HANDLE=otra-tienda NODE_ENV=production bunx medusa exec ./src/scripts/aprobar-tienda.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as flujos from "@mercurjs/core/workflows"

export default async function aprobarTienda({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const handle = (process.env.HANDLE || "hetna-cnc").trim()
  const f = flujos as any

  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "status", "currency_code"],
    filters: { handle } as any,
  })
  const tienda: any = data?.[0]

  if (!tienda) {
    logger.error(`No existe una tienda con handle "${handle}".`)
    return
  }
  if (tienda.status === "open") {
    logger.info(`${tienda.name} ya estaba aprobada (open).`)
    return
  }
  if (tienda.status !== "pending_approval") {
    logger.error(`${tienda.name} está en estado "${tienda.status}"; este script solo aprueba tiendas pendientes.`)
    return
  }

  await f.approveSellerWorkflow(container).run({ input: { seller_id: tienda.id } })

  const { data: despues } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "status"],
    filters: { id: tienda.id } as any,
  })
  logger.info(`Tienda aprobada: ${despues?.[0]?.name} -> estado=${despues?.[0]?.status}`)
}
