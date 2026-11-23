import { model } from "@medusajs/framework/utils"

/**
 * Cuenta de Mercado Libre conectada por un taller (una por taller).
 *
 * Los tokens van CIFRADOS (lib/cifrado-llaves.ts) y esta tabla nunca se manda a
 * la tienda: no usar seller.metadata, que sí sale en el API público.
 * Mercado Libre da un refresh_token de UN SOLO USO: cada renovación guarda el
 * nuevo (lib/mercadolibre.ts serializa las renovaciones por taller).
 */
const MlCuenta = model
  .define("ml_cuenta", {
    id: model.id({ prefix: "mlc" }).primaryKey(),
    seller_id: model.text(),
    ml_user_id: model.text(),
    apodo: model.text().nullable(),
    access_token: model.text(),
    refresh_token: model.text(),
    expira_en: model.dateTime(),
    // Mercado Libre pasa a los vendedores al modelo "User Products" poco a poco:
    // con ese modelo se publica con family_name en lugar de title.
    user_products: model.boolean().default(false),
  })
  .indexes([{ on: ["seller_id"], unique: true, where: "deleted_at IS NULL" }])

export default MlCuenta
