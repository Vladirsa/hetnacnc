import { model } from "@medusajs/framework/utils"

/**
 * Resultado de un alumno en un ejercicio del Simulador CNC (lib/simulador).
 * Una fila por alumno y ejercicio: se guarda la mejor calificación, cuántas
 * veces lo intentó y cuándo lo aprobó por primera vez (con qué versión).
 */
const SimResultado = model
  .define("sim_resultado", {
    id: model.id({ prefix: "simr" }).primaryKey(),
    customer_id: model.text(),
    ejercicio_id: model.text(),
    version: model.number().default(1),
    mejor_calificacion: model.number().default(0),
    intentos: model.number().default(0),
    aprobado_en: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["customer_id", "ejercicio_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
  ])

export default SimResultado
