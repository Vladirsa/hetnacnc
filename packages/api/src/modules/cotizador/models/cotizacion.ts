import { model } from "@medusajs/framework/utils"

import TallerPerfil from "./taller-perfil"
import CotizacionPartida from "./cotizacion-partida"

// Cotización con la estructura de una cotización industrial formal: nivel
// comercial (qué, cuánto, en cuánto tiempo, bajo qué condiciones) y nivel
// técnico (material, tolerancias, proceso, inspección).
//
// Los datos del cliente se COPIAN aquí en vez de referenciarse: una cotización
// enviada es un documento con folio y vigencia, no puede cambiar porque el
// cliente luego edite su dirección.
const Cotizacion = model
  .define("cotizador_cotizacion", {
    id: model.id({ prefix: "cotiz" }).primaryKey(),

    // Encabezado formal
    folio: model.text(),
    revision: model.text().default("A"),
    moneda: model.enum(["MXN", "USD"]).default("MXN"),
    fecha: model.dateTime(),
    vigencia_hasta: model.dateTime().nullable(),
    proyecto_referencia: model.text().nullable(),

    cliente_nombre: model.text(),
    cliente_empresa: model.text().nullable(),
    cliente_correo: model.text().nullable(),
    cliente_telefono: model.text().nullable(),
    cliente_rfc: model.text().nullable(),
    cliente_direccion: model.text().nullable(),

    // Resumen ejecutivo y alcance
    resumen_ejecutivo: model.text().nullable(),
    // string[]: el "incluye / no incluye" que evita los malentendidos caros.
    alcance_incluye: model.json().nullable(),
    alcance_no_incluye: model.json().nullable(),
    supuestos: model.text().nullable(),

    // Revisión técnica y especificaciones de fabricación. Va en json porque el
    // juego de campos cambia por proceso (láser no lleva setups ni roscado;
    // fresado sí) y no queremos una columna muerta por cada variante.
    tecnico: model.json().nullable(),

    // Planos, imágenes y anexos: [{ nombre, storage_key, tipo }]
    adjuntos: model.json().nullable(),

    // Condiciones comerciales
    condiciones_pago: model.text().nullable(),
    anticipo_pct: model.number().nullable(),
    dias_entrega: model.number().nullable(),
    incoterm: model.text().nullable(),
    // Condiciones técnicas y de calidad (inspección, trazabilidad, certificados)
    calidad: model.text().nullable(),

    // bigNumber, no number: model.number() genera una columna integer y el
    // IVA de 1327.20 se guardaría como 1327. Los importes que ve el cliente
    // tienen que cuadrar al centavo con la aritmética del documento.
    subtotal: model.bigNumber().default(0),
    descuento: model.bigNumber().default(0),
    iva: model.bigNumber().default(0),
    envio: model.bigNumber().default(0),
    total: model.bigNumber().default(0),

    estatus: model
      .enum(["borrador", "enviada", "vista", "aceptada", "rechazada", "vencida"])
      .default("borrador"),
    enviada_en: model.dateTime().nullable(),
    vista_en: model.dateTime().nullable(),
    respondida_en: model.dateTime().nullable(),
    aceptada_por: model.text().nullable(),
    aceptada_firma: model.text().nullable(),

    pdf_storage_key: model.text().nullable(),
    // Link estable para que el cliente abra la cotización sin que le manden un
    // archivo -- y para saber cuándo la vio (alimenta las alertas de día 3/5/7).
    token_publico: model.text().nullable(),
    notas_internas: model.text().nullable(),

    perfil: model.belongsTo(() => TallerPerfil, { mappedBy: "cotizaciones" }),
    partidas: model.hasMany(() => CotizacionPartida, { mappedBy: "cotizacion" }),
  })
  .cascades({ delete: ["partidas"] })
  .indexes([
    // Único por taller incluyendo la revisión: dos cotizaciones no pueden
    // compartir folio, pero la Rev B de un folio sí puede convivir con su
    // Rev A. Sin esto, dos altas simultáneas del mismo taller podrían leer el
    // mismo consecutivo y emitir dos documentos con el mismo folio.
    {
      on: ["perfil_id", "folio", "revision"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["folio"],
    },
    {
      on: ["token_publico"],
      unique: true,
      where: "deleted_at IS NULL AND token_publico IS NOT NULL",
    },
  ])

export default Cotizacion
