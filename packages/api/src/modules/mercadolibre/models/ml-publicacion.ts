import { model } from "@medusajs/framework/utils"

/**
 * Producto de HETNA publicado en Mercado Libre por un taller.
 * estado: active | paused | closed | under_review | error (lo último que dijo Mercado Libre)
 */
const MlPublicacion = model
  .define("ml_publicacion", {
    id: model.id({ prefix: "mlp" }).primaryKey(),
    seller_id: model.text(),
    product_id: model.text(),
    offer_id: model.text().nullable(),
    ml_item_id: model.text().nullable(),
    permalink: model.text().nullable(),
    categoria_id: model.text().nullable(),
    estado: model.text().default("active"),
    precio: model.bigNumber().nullable(),
    existencia: model.number().nullable(),
    ultimo_error: model.text().nullable(),
    sincronizado_en: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["seller_id", "product_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["ml_item_id"], where: "deleted_at IS NULL" },
  ])

export default MlPublicacion
