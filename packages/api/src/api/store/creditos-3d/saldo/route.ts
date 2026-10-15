import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CREDIT_MODULE } from "../../../../modules/credit"
import CreditModuleService from "../../../../modules/credit/service"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const creditModuleService = req.scope.resolve<CreditModuleService>(CREDIT_MODULE)

  const [balance] = await creditModuleService.listCreditBalances({ customer_id: customerId })

  const movimientos = await creditModuleService.listCreditLedgerEntries(
    { customer_id: customerId },
    { order: { created_at: "DESC" }, take: 20 }
  )

  res.json({
    saldo: balance?.balance ?? 0,
    movimientos: movimientos.map((m) => ({
      id: m.id,
      cantidad: m.amount,
      tipo: m.type,
      descripcion: m.description,
      creado: m.created_at,
    })),
  })
}
