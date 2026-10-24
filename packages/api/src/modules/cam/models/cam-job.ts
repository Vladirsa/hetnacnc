import { model } from "@medusajs/framework/utils"

/**
 * Un trabajo CAM: la pieza que subió el cliente, la configuración de su
 * máquina / herramienta / estrategia y el estado del servicio.
 */
const CamJob = model
  .define("cam_job", {
    id: model.id({ prefix: "camjob" }).primaryKey(),
    status: model
      .enum(["received", "in_cart", "paid", "in_review", "delivered", "cancelled"])
      .default("received"),
    service: model.enum(["cam_3", "cam_4", "cam_5", "post"]),
    tier: model.text().nullable(),
    access_token: model.text(),
    customer_id: model.text().nullable(),
    email: model.text().nullable(),
    cart_id: model.text().nullable(),
    order_id: model.text().nullable(),
    model_name: model.text(),
    model_file_id: model.text().nullable(),
    model_file_url: model.text().nullable(),
    gcode_file_id: model.text().nullable(),
    gcode_file_url: model.text().nullable(),
    deliverables: model.json().nullable(),
    controller: model.text().nullable(),
    kinematics: model.text().nullable(),
    config: model.json(),
    stats: model.json().nullable(),
    review_requested: model.boolean().default(false),
    customer_notes: model.text().nullable(),
    internal_notes: model.text().nullable(),
    paid_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["order_id"] },
    { on: ["customer_id"] },
    { on: ["status"] },
  ])

export default CamJob
