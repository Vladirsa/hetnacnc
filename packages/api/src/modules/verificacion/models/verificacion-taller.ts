import { model } from "@medusajs/framework/utils"

/**
 * Expediente de verificación de un taller: identificación oficial y fotos del
 * taller y de la fachada. Una fila por taller.
 *
 * Los archivos NO viven en la carpeta pública de imágenes: se guardan en una
 * carpeta privada del servidor (ver src/lib/verificacion-archivos.ts) y solo se
 * entregan al propio taller y a un administrador. Aquí se guarda únicamente la
 * lista: tipo, nombre interno, formato y tamaño.
 *
 * estado:
 *   borrador    -> el taller está subiendo documentos, aún no los envía
 *   en_revision -> enviado, falta que un administrador lo revise
 *   verificado  -> aprobado: se muestra la insignia "Taller verificado"
 *   rechazado   -> no aprobado; `motivo` explica qué corregir y puede reenviar
 */
const VerificacionTaller = model
  .define("verificacion_taller", {
    id: model.id({ prefix: "vtal" }).primaryKey(),
    seller_id: model.text(),
    estado: model.text().default("borrador"),
    archivos: model.json().nullable(),
    motivo: model.text().nullable(),
    enviado_en: model.dateTime().nullable(),
    revisado_en: model.dateTime().nullable(),
    revisado_por: model.text().nullable(),
  })
  .indexes([
    { on: ["seller_id"], unique: true },
    { on: ["estado"] },
  ])

export default VerificacionTaller
