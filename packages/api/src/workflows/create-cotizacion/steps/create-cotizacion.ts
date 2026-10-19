import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { randomBytes } from "node:crypto"

import { COTIZADOR_MODULE } from "../../../modules/cotizador"
import CotizadorModuleService from "../../../modules/cotizador/service"
import { subtotalDePartida, totalesDeCotizacion } from "../../../lib/cotizador-config"
import { mesActual } from "../../../lib/cotizador-plan"

export type PartidaInput = {
  posicion?: number
  concepto: string
  descripcion?: string | null
  cantidad?: number
  unidad?: string
  precio_unitario?: number
  subtotal?: number
  desglose?: Record<string, unknown> | null
  material?: string | null
  proceso?: string | null
  tolerancia?: string | null
  acabado?: string | null
  setups?: number | null
}

export type CreateCotizacionStepInput = {
  customer_id: string
  cliente_nombre: string
  cliente_empresa?: string | null
  cliente_correo?: string | null
  cliente_telefono?: string | null
  cliente_rfc?: string | null
  cliente_direccion?: string | null
  proyecto_referencia?: string | null
  moneda?: "MXN" | "USD"
  resumen_ejecutivo?: string | null
  alcance_incluye?: string[] | null
  alcance_no_incluye?: string[] | null
  supuestos?: string | null
  tecnico?: Record<string, unknown> | null
  adjuntos?: unknown[] | null
  condiciones_pago?: string | null
  anticipo_pct?: number | null
  dias_entrega?: number | null
  incoterm?: string | null
  calidad?: string | null
  descuento?: number
  envio?: number
  aplicar_iva?: boolean
  notas_internas?: string | null
  partidas: PartidaInput[]
}

// El folio se consume del consecutivo del perfil (QT-2026-0001). Si el
// workflow se revierte NO se devuelve el consecutivo: un hueco en la
// numeración es inofensivo, reusar un folio ya impreso en un PDF que alguien
// pudo guardar no lo es.
export const createCotizacionStep = createStep(
  "create-cotizacion-step",
  async (input: CreateCotizacionStepInput, { container }) => {
    const cotizadorModuleService = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

    const [perfil] = await cotizadorModuleService.listTallerPerfils({
      customer_id: input.customer_id,
    })
    if (!perfil) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Este taller todavía no tiene perfil. Captura los datos del negocio antes de cotizar."
      )
    }

    if (!input.partidas?.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "La cotización necesita al menos una partida.")
    }

    const consecutivo = (perfil.folio_consecutivo ?? 0) + 1
    // El contador del mes se mueve aquí, junto con el folio: así cuenta
    // cotizaciones EMITIDAS y borrarlas después no devuelve cupo.
    const mes = mesActual()
    const usadasAntes = perfil.uso_mes === mes ? Number(perfil.uso_n) || 0 : 0
    await cotizadorModuleService.updateTallerPerfils({
      id: perfil.id,
      folio_consecutivo: consecutivo,
      uso_mes: mes,
      uso_n: usadasAntes + 1,
    })

    const fecha = new Date()
    const folio = `${perfil.folio_prefijo || "QT"}-${fecha.getFullYear()}-${String(consecutivo).padStart(4, "0")}`

    const vigenciaDias = perfil.vigencia_dias ?? 15
    const vigenciaHasta = new Date(fecha)
    vigenciaHasta.setDate(vigenciaHasta.getDate() + vigenciaDias)

    const aplicarIva = input.aplicar_iva ?? true
    const totales = totalesDeCotizacion(input.partidas, {
      descuento: input.descuento,
      envio: input.envio,
      iva_pct: perfil.iva_pct,
      aplicar_iva: aplicarIva,
    })

    const [cotizacion] = await cotizadorModuleService.createCotizacions([
      {
        perfil_id: perfil.id,
        folio,
        revision: "A",
        moneda: input.moneda || perfil.moneda || "MXN",
        fecha,
        vigencia_hasta: vigenciaHasta,
        proyecto_referencia: input.proyecto_referencia ?? null,
        cliente_nombre: input.cliente_nombre,
        cliente_empresa: input.cliente_empresa ?? null,
        cliente_correo: input.cliente_correo ?? null,
        cliente_telefono: input.cliente_telefono ?? null,
        cliente_rfc: input.cliente_rfc ?? null,
        cliente_direccion: input.cliente_direccion ?? null,
        resumen_ejecutivo: input.resumen_ejecutivo ?? null,
        alcance_incluye: input.alcance_incluye ?? null,
        alcance_no_incluye: input.alcance_no_incluye ?? null,
        supuestos: input.supuestos ?? null,
        tecnico: input.tecnico ?? null,
        adjuntos: input.adjuntos ?? null,
        condiciones_pago: input.condiciones_pago ?? perfil.condiciones_pago_default ?? null,
        anticipo_pct: input.anticipo_pct ?? null,
        dias_entrega: input.dias_entrega ?? perfil.dias_entrega_default ?? null,
        incoterm: input.incoterm ?? null,
        calidad: input.calidad ?? null,
        subtotal: totales.subtotal,
        descuento: totales.descuento,
        iva: totales.iva,
        envio: totales.envio,
        total: totales.total,
        estatus: "borrador",
        token_publico: randomBytes(16).toString("hex"),
        notas_internas: input.notas_internas ?? null,
      } as any,
    ])

    await cotizadorModuleService.createCotizacionPartidas(
      input.partidas.map((p, i) => ({
        cotizacion_id: cotizacion.id,
        posicion: p.posicion ?? i + 1,
        concepto: p.concepto,
        descripcion: p.descripcion ?? null,
        cantidad: p.cantidad ?? 1,
        unidad: p.unidad || "pza",
        precio_unitario: p.precio_unitario ?? 0,
        subtotal: subtotalDePartida(p),
        desglose: p.desglose ?? null,
        material: p.material ?? null,
        proceso: p.proceso ?? null,
        tolerancia: p.tolerancia ?? null,
        acabado: p.acabado ?? null,
        setups: p.setups ?? null,
      })) as any
    )

    return new StepResponse(
      { cotizacion_id: cotizacion.id, folio, token_publico: cotizacion.token_publico },
      cotizacion.id
    )
  },
  async (cotizacionId: string | undefined, { container }) => {
    if (!cotizacionId) {
      return
    }
    const cotizadorModuleService = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

    // El cupo del mes sí se devuelve aquí: esta cotización nunca llegó a
    // existir (típicamente porque el taller se pasó del plan y no tenía
    // créditos), y eso es distinto de borrar una ya emitida. El consecutivo
    // del folio no se devuelve, a propósito.
    const cotizacion = await cotizadorModuleService.retrieveCotizacion(cotizacionId)
    const [perfil] = await cotizadorModuleService.listTallerPerfils({ id: cotizacion.perfil_id })
    if (perfil && perfil.uso_mes === mesActual() && (perfil.uso_n ?? 0) > 0) {
      await cotizadorModuleService.updateTallerPerfils({
        id: perfil.id,
        uso_n: perfil.uso_n - 1,
      })
    }

    // Las partidas se van en cascada (ver .cascades en el modelo Cotizacion).
    await cotizadorModuleService.deleteCotizacions(cotizacionId)
  }
)
