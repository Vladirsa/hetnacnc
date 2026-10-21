import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CREDIT_MODULE } from "../../../../modules/credit"
import CreditModuleService from "../../../../modules/credit/service"
import { creditosDe } from "../../../../workflows/create-escaneo/steps/create-escaneo"

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
    // Va aquí para que la pantalla del monedero pueda traducir el saldo a algo
    // que signifique algo ("te alcanza para 3 escaneos") con una sola llamada,
    // en vez de pedir también la lista de escaneos nomás por este número.
    creditos_por_escaneo: creditosDe("scan"),
    movimientos: movimientos.map((m) => ({
      id: m.id,
      cantidad: m.amount,
      tipo: m.type,
      descripcion: m.description,
      creado: m.created_at,
    })),
  })
}
