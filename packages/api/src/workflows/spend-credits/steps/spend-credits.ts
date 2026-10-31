import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { CREDIT_MODULE } from "../../../modules/credit"
import CreditModuleService from "../../../modules/credit/service"
import { esCuentaDeLaCasa } from "../../../lib/cuentas-casa"

export type SpendCreditsStepInput = {
  customer_id: string
  amount: number
  reference_id?: string | null
  description?: string | null
}

// amount es positivo en el input (lo que cuesta el servicio); aqui se
// guarda como renglon negativo en el ledger. Si el trabajo de RunPod falla
// despues, el caller acredita de vuelta con grantCreditsWorkflow
// (type: "reembolso"), no hay reversa automatica aqui -- el gasto ya es
// real en cuanto se dispara el trabajo.
export const spendCreditsStep = createStep(
  "spend-credits-step",
  async (input: SpendCreditsStepInput, { container }) => {
    const creditModuleService = container.resolve<CreditModuleService>(CREDIT_MODULE)

    const [balance] = await creditModuleService.listCreditBalances({
      customer_id: input.customer_id,
    })

    const saldoActual = balance?.balance ?? 0

    // Cuenta de la casa (lib/cuentas-casa.ts): créditos ilimitados. Queda un
    // renglón en 0 para que el movimiento se vea en su historial.
    if (await esCuentaDeLaCasa(container as any, input.customer_id)) {
      const [entry] = await creditModuleService.createCreditLedgerEntries([
        {
          customer_id: input.customer_id,
          amount: 0,
          type: "consumo",
          reference_id: input.reference_id ?? null,
          description: `${input.description ?? "Consumo"} (cuenta de la casa: sin costo)`,
        },
      ])
      return new StepResponse({ entry_id: entry.id, saldo_restante: saldoActual }, entry.id)
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Cantidad de créditos inválida")
    }

    // Descuento atómico: el UPDATE sólo pasa si el saldo alcanza EN ESE
    // momento. Antes se leía el saldo, se comparaba y luego se escribía: con
    // varias peticiones al mismo tiempo todas pasaban la revisión y se
    // lanzaban N escaneos por el precio de uno.
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const descontados = balance
      ? await knex("credit_balance")
          .where({ id: balance.id })
          .whereNull("deleted_at")
          .where("balance", ">=", input.amount)
          .update({ balance: knex.raw("balance - ?", [input.amount]), updated_at: knex.fn.now() })
          .returning("balance")
      : []
    if (!descontados.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Saldo de créditos insuficiente: tiene ${saldoActual}, necesita ${input.amount}`
      )
    }
    const saldoRestante = Number((descontados[0] as { balance: number }).balance)

    const [entry] = await creditModuleService.createCreditLedgerEntries([
      {
        customer_id: input.customer_id,
        amount: -input.amount,
        type: "consumo",
        reference_id: input.reference_id ?? null,
        description: input.description ?? null,
      },
    ])

    return new StepResponse({ entry_id: entry.id, saldo_restante: saldoRestante }, entry.id)
  },
  async (entryId: string | undefined, { container }) => {
    if (!entryId) return

    const creditModuleService = container.resolve<CreditModuleService>(CREDIT_MODULE)
    const entry = await creditModuleService.retrieveCreditLedgerEntry(entryId)

    const [balance] = await creditModuleService.listCreditBalances({
      customer_id: entry.customer_id,
    })
    if (balance && entry.amount) {
      const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
      await knex("credit_balance")
        .where({ id: balance.id })
        .update({ balance: knex.raw("balance - ?", [entry.amount]), updated_at: knex.fn.now() })
    }

    await creditModuleService.deleteCreditLedgerEntries(entryId)
  }
)
