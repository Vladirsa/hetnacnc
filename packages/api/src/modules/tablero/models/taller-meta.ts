import { model } from "@medusajs/framework/utils"

// La meta de ventas que el propio taller se pone para un mes.
//
// Una fila por taller y mes: guardar la meta por mes (y no un solo campo
// "meta actual") deja ver al final de marzo si cumplió la de marzo, aunque
// en abril ya se haya puesto otra.
//
// meta_ingresos va en bigNumber y no en number: model.number() genera una
// columna integer y una meta de $45,000.50 se guardaría como 45000. Los
// importes de este proyecto se comparan contra totales de pedidos, que sí
// traen centavos.
const TallerMeta = model
  .define("taller_meta", {
    id: model.id({ prefix: "tmeta" }).primaryKey(),
    seller_id: model.text(),
    // YYYY-MM en hora de México, no UTC: con UTC el mes le cambiaría al
    // taller a las 6 de la tarde del último día.
    mes: model.text(),
    meta_ingresos: model.bigNumber().default(0),
    moneda: model.text().default("mxn"),
  })
  .indexes([
    {
      on: ["seller_id", "mes"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default TallerMeta
