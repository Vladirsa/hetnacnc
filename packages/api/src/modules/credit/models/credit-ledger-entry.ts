import { model } from "@medusajs/framework/utils"

// Un renglon por cada movimiento de creditos. amount es positivo para
// "compra"/"reembolso" y negativo para "consumo"/"ajuste" a la baja --
// balance en CreditBalance siempre debe ser la suma de estos renglones para
// ese customer_id, nunca se edita directo.
// reference_id guarda el order_id (compra) o el job_id del servicio 3D
// (consumo/reembolso), segun el tipo -- es texto libre a proposito porque
// apunta a distintas entidades segun el caso.
const CreditLedgerEntry = model
  .define("credit_ledger_entry", {
    id: model.id({ prefix: "credmov" }).primaryKey(),
    customer_id: model.text(),
    amount: model.number(),
    type: model.enum(["compra", "consumo", "reembolso", "ajuste"]),
    reference_id: model.text().nullable(),
    description: model.text().nullable(),
  })
  .indexes([
    {
      on: ["customer_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default CreditLedgerEntry
