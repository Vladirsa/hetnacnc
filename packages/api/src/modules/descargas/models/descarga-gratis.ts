import { model } from "@medusajs/framework/utils"

// Una fila por archivo gratis que bajó un cliente. De aquí sale el cupo
// semanal: se cuentan las filas de los últimos 7 días.
//
// Se guarda la descarga y no un contador, por la misma razón que las metas
// del tablero van por mes: con las filas se puede contestar después qué
// archivos gratis jalan más gente, y un contador sólo diría cuántos.
const Descarga = model
  .define("descarga_gratis", {
    id: model.id({ prefix: "dgrat" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
  })
  .indexes([{ on: ["customer_id", "created_at"] }])

export default Descarga
