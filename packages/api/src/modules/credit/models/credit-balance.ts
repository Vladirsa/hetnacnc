import { model } from "@medusajs/framework/utils"

// customer_id es columna plana (igual que seller_id en Offer, customer_id en
// Enrollment): referencia al módulo de clientes por id, sin relación de base
// de datos. balance es el saldo vigente -- se mueve solo a través de
// CreditLedgerEntry para que cada cambio quede auditado.
const CreditBalance = model
  .define("credit_balance", {
    id: model.id({ prefix: "credbal" }).primaryKey(),
    customer_id: model.text(),
    balance: model.number().default(0),
  })
  .indexes([
    {
      on: ["customer_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CreditBalance
