import { model } from "@medusajs/framework/utils"

import Cotizacion from "./cotizacion"

// Una partida de la tabla comercial. `desglose` guarda lo que el motor calculó
// por dentro (material, mano de obra, máquina, setup, acabado, embalaje,
// margen): el taller decide si lo muestra al cliente o no, pero internamente
// siempre queda -- es lo que permite saber después si una partida se cotizó
// por debajo del costo.
const CotizacionPartida = model.define("cotizador_partida", {
  id: model.id({ prefix: "cotpar" }).primaryKey(),
  posicion: model.number().default(0),

  concepto: model.text(),
  descripcion: model.text().nullable(),
  // cantidad es float porque hay unidades fraccionarias (2.5 m de perfil,
  // 0.75 kg de material); precio y subtotal son bigNumber por los centavos.
  cantidad: model.float().default(1),
  unidad: model.text().default("pza"),
  precio_unitario: model.bigNumber().default(0),
  subtotal: model.bigNumber().default(0),
  desglose: model.json().nullable(),

  material: model.text().nullable(),
  proceso: model.text().nullable(),
  tolerancia: model.text().nullable(),
  acabado: model.text().nullable(),
  setups: model.number().nullable(),

  cotizacion: model.belongsTo(() => Cotizacion, { mappedBy: "partidas" }),
})

export default CotizacionPartida
