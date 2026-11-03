import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { ESCANEO_MODULE } from "../../../modules/escaneo"
import EscaneoModuleService from "../../../modules/escaneo/service"
import { esCuentaDeLaCasa } from "../../../lib/cuentas-casa"

export type CreateEscaneoStepInput = {
  customer_id: string
  modo: "preview" | "scan"
  titulo?: string | null
  // Llaves en el bucket privado de las fotos ya subidas.
  fotos: string[]
  // Medida real del lado más largo, en mm (ver el modelo).
  medida_mm?: number | null
  // Sólo del modelo con IA (ver OpcionesModeloIa).
  vistas?: string[] | null
  tipo?: string | null
  detalle?: string | null
}

// Lo que el taller puede elegir del modelo con IA.
export const VISTAS_IA = ["front", "left", "back", "right"] as const
export const CARAS_POR_DETALLE: Record<string, number> = { ligero: 150000, normal: 400000, alto: 1000000 }

// Límites de la medida de referencia: de una rondana a una pieza grande de
// router. Fuera de eso casi seguro es un error de captura (cm por mm).
export const MEDIDA_MINIMA_MM = 5
export const MEDIDA_MAXIMA_MM = 3000

// Cuántas fotos necesita cada camino. El preview usa una sola (TripoSR
// reconstruye a partir de una imagen); la fotogrametría necesita muchas
// vistas que se traslapen, y con menos de 15 Meshroom no logra alinear nada.
const MINIMO_FOTOS = { preview: 1, scan: 15 } as const
// Con varias vistas (frente, izquierda, atrás, derecha) la IA ve los lados
// que una sola foto esconde.
const MAXIMO_FOTOS = { preview: 4, scan: 80 } as const

// Cuántos créditos cuesta un escaneo profesional. Decisión de precio, no de
// código: por eso sale del entorno. El preview es gratis a propósito -- es el
// gancho que lleva al de paga.
const CREDITOS_POR_ESCANEO_DEFAULT = 5

export function previewsGratisPorMes(): number {
  const n = Number(process.env.ESCANEO_PREVIEWS_GRATIS)
  return Number.isFinite(n) && n >= 0 ? n : 1
}

/** Modelos con IA del cliente en los últimos 30 días (los fallidos no cuentan). */
export async function modelosIaDelMes(servicio: EscaneoModuleService, customerId: string): Promise<number> {
  const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const [, total] = await servicio.listAndCountEscaneo3ds(
    {
      customer_id: customerId,
      modo: "preview",
      estatus: ["pendiente", "procesando", "listo"],
      created_at: { $gte: desde },
    } as any,
    { take: 1, select: ["id"] }
  )
  return total
}

/** Lo que cuesta un modelo con IA ya usado el gratis del mes. */
export function creditosModeloIa(): number {
  const n = Number(process.env.ESCANEO_IA_CREDITOS)
  return Number.isFinite(n) && n >= 0 ? n : 2
}

export function creditosDe(modo: "preview" | "scan"): number {
  if (modo === "preview") return 0
  return Number(process.env.ESCANEO_CREDITOS_POR_TRABAJO) || CREDITOS_POR_ESCANEO_DEFAULT
}

export const createEscaneoStep = createStep(
  "create-escaneo-step",
  async (input: CreateEscaneoStepInput, { container }) => {
    const escaneoModuleService = container.resolve<EscaneoModuleService>(ESCANEO_MODULE)

    const fotos = (input.fotos || []).filter((f) => typeof f === "string" && f.length)
    const minimo = MINIMO_FOTOS[input.modo]
    const maximo = MAXIMO_FOTOS[input.modo]

    if (fotos.length < minimo) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        input.modo === "preview"
          ? "La vista previa necesita una foto."
          : `El escaneo necesita al menos ${minimo} fotos para poder alinearlas.`
      )
    }
    if (fotos.length > maximo) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Son demasiadas fotos: el máximo es ${maximo}.`
      )
    }

    // Vistas del modelo con IA: una por foto, sin repetir, y la primera es el
    // frente (Tencent la usa como imagen principal).
    let opciones: Record<string, unknown> | null = null
    if (input.modo === "preview") {
      const vistas = fotos.length === 1 ? ["front"] : (input.vistas || []).map(String)
      const validas =
        vistas.length === fotos.length &&
        vistas[0] === "front" &&
        new Set(vistas).size === vistas.length &&
        vistas.every((v) => (VISTAS_IA as readonly string[]).includes(v))
      if (!validas) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Con varias fotos, indica qué vista es cada una (frente, izquierda, atrás, derecha); el frente es obligatorio."
        )
      }
      opciones = {
        vistas,
        tipo: input.tipo === "Geometry" ? "Geometry" : "Normal",
        caras: CARAS_POR_DETALLE[String(input.detalle)] || CARAS_POR_DETALLE.normal,
      }
    }

    // Sólo el escaneo de paga se escala; el preview de IA nunca es a medida.
    const medida = input.modo === "scan" ? Number(input.medida_mm) : NaN
    const hayMedida = Number.isFinite(medida) && medida > 0
    if (input.modo === "scan" && !hayMedida) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Escribe la medida real del lado más largo de la pieza: con ella el STL sale en milímetros."
      )
    }
    if (hayMedida && (medida < MEDIDA_MINIMA_MM || medida > MEDIDA_MAXIMA_MM)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `La medida debe estar entre ${MEDIDA_MINIMA_MM} y ${MEDIDA_MAXIMA_MM} mm. Revisa que no esté en centímetros.`
      )
    }

    // El precio se congela aquí, en el expediente. Si mañana sube, un
    // reembolso de este trabajo sigue devolviendo lo que de verdad se cobró.
    const deLaCasa = await esCuentaDeLaCasa(container as any, input.customer_id)
    let creditos = deLaCasa ? 0 : creditosDe(input.modo)

    // La vista previa con IA cuesta dinero de verdad (Tencent cobra cada
    // modelo), así que la gratis tiene tope por mes. Las que fallan no cuentan.
    if (input.modo === "preview" && !deLaCasa) {
      const tope = previewsGratisPorMes()
      const usados = await modelosIaDelMes(escaneoModuleService, input.customer_id)
      // Pasado el tope gratis, el modelo con IA se cobra en créditos (Tencent
      // cobra cada modelo). Si el saldo no alcanza, spendCreditsStep lo frena.
      if (usados >= tope) creditos = creditosModeloIa()
    }

    const [escaneo] = await escaneoModuleService.createEscaneo3ds([
      {
        customer_id: input.customer_id,
        modo: input.modo,
        titulo: input.titulo || null,
        fotos,
        n_fotos: fotos.length,
        medida_mm: hayMedida ? Math.round(medida * 100) / 100 : null,
        estatus: "pendiente",
        creditos_cobrados: creditos,
        opciones,
      } as any,
    ])

    return new StepResponse({ escaneo_id: escaneo.id, modo: escaneo.modo, creditos }, escaneo.id)
  },
  // Si el cobro de créditos falla, el expediente no debe quedar colgado.
  async (escaneoId: string | undefined, { container }) => {
    if (!escaneoId) return
    const escaneoModuleService = container.resolve<EscaneoModuleService>(ESCANEO_MODULE)
    await escaneoModuleService.deleteEscaneo3ds([escaneoId])
  }
)
