import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { CREDIT_MODULE } from "../../../modules/credit"
import CreditModuleService from "../../../modules/credit/service"

export type GrantCreditsStepInput = {
  customer_id: string
  amount: number
  type: "compra" | "reembolso" | "ajuste"
  reference_id?: string | null
  description?: string | null
}

// Un solo paso porque balance y ledger entry viven en el mismo modulo/DB --
// no hace falta dividirlo en dos steps de workflow para esto. El balance
// nunca se edita a mano fuera de aqui: siempre balance += amount junto con
// su renglon en el ledger, para que uno sea la suma auditable del otro.
export const grantCreditsStep = createStep(
  "grant-credits-step",
  async (input: GrantCreditsStepInput, { container }) => {
    const creditModuleService = container.resolve<CreditModuleService>(CREDIT_MODULE)

    const [entry] = await creditModuleService.createCreditLedgerEntries([
      {
        customer_id: input.customer_id,
        amount: input.amount,
        type: input.type,
        reference_id: input.reference_id ?? null,
        description: input.description ?? null,
      },
    ])

    const [existente] = await creditModuleService.listCreditBalances({
      customer_id: input.customer_id,
    })

    if (existente) {
      await creditModuleService.updateCreditBalances({
        id: existente.id,
        balance: existente.balance + input.amount,
      })
    } else {
      await creditModuleService.createCreditBalances({
        customer_id: input.customer_id,
        balance: input.amount,
      })
    }

    return new StepResponse({ entry_id: entry.id, customer_id: input.customer_id, amount: input.amount }, entry.id)
  },
  async (entryId: string | undefined, { container }) => {
    if (!entryId) return

    const creditModuleService = container.resolve<CreditModuleService>(CREDIT_MODULE)
    const entry = await creditModuleService.retrieveCreditLedgerEntry(entryId)

    const [balance] = await creditModuleService.listCreditBalances({
      customer_id: entry.customer_id,
    })
    if (balance) {
      await creditModuleService.updateCreditBalances({
        id: balance.id,
        balance: balance.balance - entry.amount,
      })
    }

    await creditModuleService.deleteCreditLedgerEntries(entryId)
  }
)
