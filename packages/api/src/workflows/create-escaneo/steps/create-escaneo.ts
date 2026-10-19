import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { ESCANEO_MODULE } from "../../../modules/escaneo"
import EscaneoModuleService from "../../../modules/escaneo/service"

export type CreateEscaneoStepInput = {
  customer_id: string
  modo: "preview" | "scan"
  titulo?: string | null
  // Llaves en el bucket privado de las fotos ya subidas.
  fotos: string[]
}

// Cuántas fotos necesita cada camino. El preview usa una sola (TripoSR
// reconstruye a partir de una imagen); la fotogrametría necesita muchas
// vistas que se traslapen, y con menos de 15 Meshroom no logra alinear nada.
const MINIMO_FOTOS = { preview: 1, scan: 15 } as const
const MAXIMO_FOTOS = { preview: 1, scan: 80 } as const

// Cuántos créditos cuesta un escaneo profesional. Decisión de precio, no de
// código: por eso sale del entorno. El preview es gratis a propósito -- es el
// gancho que lleva al de paga.
const CREDITOS_POR_ESCANEO_DEFAULT = 5

function creditosDe(modo: "preview" | "scan"): number {
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

    // El precio se congela aquí, en el expediente. Si mañana sube, un
    // reembolso de este trabajo sigue devolviendo lo que de verdad se cobró.
    const creditos = creditosDe(input.modo)

    const [escaneo] = await escaneoModuleService.createEscaneo3ds([
      {
        customer_id: input.customer_id,
        modo: input.modo,
        titulo: input.titulo || null,
        fotos,
        n_fotos: fotos.length,
        estatus: "pendiente",
        creditos_cobrados: creditos,
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
