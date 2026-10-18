import { model } from "@medusajs/framework/utils"

import Cotizacion from "./cotizacion"

// Un perfil por taller. Esto es la pieza que vuelve multi-taller al Cotizador:
// hoy cfg/costos salen de lib/cotizador-datos.json (un solo juego de tarifas,
// las de HETNA), y el motor (lib/cotizador-engine.ts) los recibe como
// parámetro -- así que basta guardarlos por taller aquí y pasárselos para que
// cada uno cotice con sus propios números.
//
// customer_id es columna plana (igual que en CreditBalance): el taller es una
// cuenta de cliente de hetnacnc.com, sin relación de base de datos entre
// módulos.
const TallerPerfil = model
  .define("cotizador_perfil", {
    id: model.id({ prefix: "cotperf" }).primaryKey(),
    customer_id: model.text(),

    nombre_comercial: model.text(),
    razon_social: model.text().nullable(),
    rfc: model.text().nullable(),
    direccion: model.text().nullable(),
    ciudad: model.text().nullable(),
    estado: model.text().nullable(),
    cp: model.text().nullable(),
    pais: model.text().default("México"),
    telefono: model.text().nullable(),
    whatsapp: model.text().nullable(),
    correo: model.text().nullable(),
    sitio_web: model.text().nullable(),
    logo_url: model.text().nullable(),

    moneda: model.enum(["MXN", "USD"]).default("MXN"),
    iva_pct: model.float().default(16),
    vigencia_dias: model.number().default(15),

    // Costos del taller: entran directo al motor de cálculo como
    // CotizadorCostos. float, no number: un costo de $382.50 por hora de
    // máquina o un margen de 32.5% no son enteros.
    costo_hora_taller: model.float().default(0),
    costo_hora_maquina: model.float().default(0),
    costo_hora_operador: model.float().default(0),
    margen_minimo: model.float().default(0),
    margen_recomendado: model.float().default(0),
    // tarifas y rangos propios del taller, con la forma de CotizadorCfg.
    tarifas: model.json().nullable(),

    // Folio con trazabilidad: QT-2026-1048 sale de prefijo + consecutivo.
    folio_prefijo: model.text().default("QT"),
    folio_consecutivo: model.number().default(0),

    terminos_estandar: model.text().nullable(),
    condiciones_pago_default: model.text().nullable(),
    dias_entrega_default: model.number().nullable(),
    firma_nombre: model.text().nullable(),
    firma_puesto: model.text().nullable(),

    cotizaciones: model.hasMany(() => Cotizacion, { mappedBy: "perfil" }),
  })
  .indexes([
    {
      on: ["customer_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default TallerPerfil
