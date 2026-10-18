// Crea un taller de ejemplo con una cotización completa (las 11 secciones) para
// ver el documento real y probar el link público. Sirve de referencia de qué
// espera cada campo.
//
// Uso: desde packages/api, con la base de datos accesible:
//   ./node_modules/.bin/medusa exec ./src/scripts/seed-cotizador-demo.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { COTIZADOR_MODULE } from "../modules/cotizador"
import CotizadorModuleService from "../modules/cotizador/service"
import { createCotizacionWorkflow } from "../workflows/create-cotizacion"

const CUSTOMER_DEMO = "cus_demo_cotizador"

export default async function seedCotizadorDemo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const cotizadorModuleService = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  let [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: CUSTOMER_DEMO })

  if (!perfil) {
    ;[perfil] = await cotizadorModuleService.createTallerPerfils([
      {
        customer_id: CUSTOMER_DEMO,
        nombre_comercial: "Taller de Demostración",
        razon_social: "Taller de Demostración S.A. de C.V.",
        rfc: "XAXX010101000",
        direccion: "Av. Industria 123, Col. Centro",
        ciudad: "Querétaro",
        estado: "Querétaro",
        cp: "76000",
        telefono: "442 000 0000",
        whatsapp: "524420000000",
        correo: "ventas@tallerdemo.mx",
        moneda: "MXN",
        iva_pct: 16,
        vigencia_dias: 15,
        costo_hora_taller: 120,
        costo_hora_maquina: 380,
        costo_hora_operador: 90,
        margen_minimo: 20,
        margen_recomendado: 35,
        folio_prefijo: "QT",
        condiciones_pago_default: "50% de anticipo, 50% contra entrega",
        dias_entrega_default: 10,
        terminos_estandar:
          "Los precios están sujetos a revisión si cambia el diseño, el material o la cantidad. El material sobrante queda en poder del taller salvo acuerdo por escrito. La garantía cubre defectos de fabricación por 30 días naturales y no cubre uso distinto al especificado.",
        firma_nombre: "Nombre del responsable",
        firma_puesto: "Gerencia comercial",
      } as any,
    ])
    logger.info(`Perfil de taller demo creado: ${perfil.id}`)
  } else {
    logger.info(`Perfil demo ya existía: ${perfil.id}`)
  }

  const { result } = await createCotizacionWorkflow(container).run({
    input: {
      customer_id: CUSTOMER_DEMO,
      cliente_nombre: "Ing. Cliente Ejemplo",
      cliente_empresa: "Manufacturas del Bajío S.A. de C.V.",
      cliente_correo: "compras@manufacturasbajio.mx",
      cliente_telefono: "4421234567",
      cliente_rfc: "MBA120101AB1",
      cliente_direccion: "Parque Industrial Bernardo Quintana, El Marqués, Qro.",
      proyecto_referencia: "Soporte motor NEMA 23 — lote piloto",
      moneda: "MXN",
      resumen_ejecutivo:
        "Fabricación de 25 soportes para motor NEMA 23 en aluminio 6061-T6, maquinados en fresadora CNC de 3 ejes a partir del archivo STEP proporcionado por el cliente. Incluye corte, barrenado, roscado e inspección dimensional de cotas críticas.",
      alcance_incluye: [
        "Maquinado CNC de las 25 piezas",
        "Barrenado y roscado M6",
        "Rebabeo y limpieza",
        "Inspección dimensional de cotas críticas",
        "Embalaje para traslado terrestre",
      ],
      alcance_no_incluye: [
        "Diseño o rediseño CAD",
        "Tratamiento térmico",
        "Anodizado o pintura",
        "Flete y maniobras de entrega",
        "Impuestos",
      ],
      supuestos:
        "El archivo STEP recibido es la revisión final. Se asume material comercial disponible en placa de 6.35 mm.",
      tecnico: {
        material: "Aluminio 6061-T6",
        cantidad: "25 piezas",
        medidas: "120 × 80 mm",
        espesor: "6.35 mm",
        tolerancia_general: "±0.10 mm",
        acabado: "Maquinado natural, sin recubrimiento",
        archivo_recibido: "STEP + PDF",
        uso_final: "Montaje de motor paso a paso en eje Y",
        proceso: "Fresado CNC 3 ejes",
        maquina: "Centro de maquinado vertical",
        operaciones: "Corte de contorno exterior, barrenado, roscado M6",
        setups: "2",
        inspeccion: "Calibrador vernier y micrómetro en cotas críticas",
        trazabilidad: "Lote de producción identificado",
      },
      condiciones_pago: "50% de anticipo, 50% contra entrega",
      anticipo_pct: 50,
      dias_entrega: 10,
      calidad:
        "Inspección dimensional en las cotas marcadas como críticas en el plano. Certificado de material disponible con costo adicional. El lote se entrega identificado para trazabilidad.",
      aplicar_iva: true,
      partidas: [
        {
          concepto: "Maquinado CNC — soporte NEMA 23",
          descripcion: "Corte de contorno, barrenado de 4 orificios y roscado M6 por pieza.",
          cantidad: 25,
          unidad: "pza",
          precio_unitario: 285,
          material: "Aluminio 6061-T6 6.35 mm",
          proceso: "Fresado CNC 3 ejes",
          tolerancia: "±0.10 mm",
          acabado: "Natural",
          setups: 2,
          desglose: { Material: 95, Maquina: 110, Operador: 28, Consumibles: 12 },
        },
        {
          concepto: "Setup inicial de máquina",
          descripcion: "Preparación, ceros, sujeción y primera pieza de prueba.",
          cantidad: 1,
          unidad: "servicio",
          precio_unitario: 850,
        },
        {
          concepto: "Embalaje para traslado",
          cantidad: 1,
          unidad: "lote",
          precio_unitario: 320,
        },
      ],
    },
  })

  const cotizacion = await cotizadorModuleService.retrieveCotizacion(result.cotizacion_id)

  logger.info(`✔ Cotización creada: ${cotizacion.folio} (${cotizacion.id})`)
  logger.info(`  Total: ${cotizacion.total} ${cotizacion.moneda}`)
  logger.info(`  Link público: /cotizacion/${cotizacion.token_publico}`)
}
