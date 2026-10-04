import { model } from "@medusajs/framework/utils"

// Portada (diapositiva) del carrusel principal de la tienda.
// Fase 1: HETNA las administra desde /dashboard.
// Fase 2: los vendedores compran espacios por semana (origen "vendedor"),
// pagan con Mercado Pago y HETNA las aprueba antes de publicarse.
export const Portada = model.define("hetna_portada", {
  id: model.id({ prefix: "port" }).primaryKey(),
  etiqueta: model.text().default(""),
  titulo: model.text(),
  texto: model.text().default(""),
  imagen_url: model.text().nullable(),
  boton1_texto: model.text().nullable(),
  boton1_url: model.text().nullable(),
  boton2_texto: model.text().nullable(),
  boton2_url: model.text().nullable(),
  orden: model.number().default(0),
  activa: model.boolean().default(true),
  inicia_en: model.dateTime().nullable(),
  termina_en: model.dateTime().nullable(),
  origen: model.enum(["hetna", "vendedor"]).default("hetna"),
  seller_id: model.text().nullable(),
  estado: model
    .enum(["pendiente_pago", "en_revision", "aprobada", "rechazada"])
    .default("aprobada"),
  nota_admin: model.text().nullable(),
  impresiones: model.number().default(0),
  clics: model.number().default(0),
})
