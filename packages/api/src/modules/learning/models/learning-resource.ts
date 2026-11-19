import { model } from "@medusajs/framework/utils"

// Biblioteca de recursos de la Academia: ligas a materiales buenos de otros
// sitios (planos, guías, programas, videos). HETNA no copia el contenido:
// guarda el título, una descripción propia, el crédito de la fuente y la liga
// al sitio original.
export const LearningResource = model.define("learning_resource", {
  id: model.id().primaryKey(),
  titulo: model.text(),
  descripcion: model.text().default(""),
  url: model.text(),
  fuente: model.text(),
  categoria: model.text(),
  tipo: model.text().default("guia"),
  imagen_url: model.text().nullable(),
  destacado: model.boolean().default(false),
  orden: model.number().default(0),
  publicado: model.boolean().default(true),
})
