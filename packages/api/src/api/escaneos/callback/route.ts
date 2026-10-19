import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { timingSafeEqual } from "node:crypto"

import { ESCANEO_MODULE } from "../../../modules/escaneo"
import EscaneoModuleService from "../../../modules/escaneo/service"
import { grantCreditsWorkflow } from "../../../workflows/grant-credits"

// Por aquí reporta n8n cómo terminó un trabajo de RunPod.
//
// Va fuera de /store a propósito: lo llama una máquina, no un cliente con
// sesión, y Medusa exige x-publishable-api-key en todo /store/*. Se protege
// con un secreto compartido en la cabecera.
//
// Es idempotente: n8n puede reintentar, y un escaneo que ya terminó no se
// vuelve a tocar. Sin eso, un reintento después de un fallo podría pagar dos
// reembolsos por el mismo trabajo.

function secretoValido(recibido: string | undefined): boolean {
  const esperado = process.env.ESCANEO_CALLBACK_SECRET
  if (!esperado || !recibido) {
    return false
  }
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  // timingSafeEqual exige el mismo largo; compararlo aparte no filtra nada
  // útil (el largo del secreto no es lo que lo protege).
  return a.length === b.length && timingSafeEqual(a, b)
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!process.env.ESCANEO_CALLBACK_SECRET) {
    console.error("[escaneos] ESCANEO_CALLBACK_SECRET no está configurado: el callback queda cerrado")
    return res.status(503).json({ message: "Callback no configurado" })
  }
  if (!secretoValido(req.headers["x-escaneo-secreto"] as string | undefined)) {
    return res.status(401).json({ message: "No autorizado" })
  }

  const body = (req.body || {}) as Record<string, any>
  const escaneoId = String(body.escaneo_id || "")
  if (!escaneoId) {
    return res.status(400).json({ message: "escaneo_id es requerido" })
  }

  const escaneoModuleService = req.scope.resolve<EscaneoModuleService>(ESCANEO_MODULE)
  const [escaneo] = await escaneoModuleService.listEscaneo3ds({ id: escaneoId })
  if (!escaneo) {
    return res.status(404).json({ message: "Escaneo no encontrado" })
  }

  // Ya terminó: se responde ok para que n8n deje de reintentar, pero no se
  // cambia nada ni se vuelve a reembolsar.
  if (escaneo.estatus === "listo" || escaneo.estatus === "fallido") {
    return res.json({ escaneo_id: escaneo.id, estatus: escaneo.estatus, sin_cambios: true })
  }

  const estatus = String(body.estatus || "")

  if (estatus === "procesando") {
    await escaneoModuleService.updateEscaneo3ds({
      id: escaneo.id,
      estatus: "procesando",
      job_externo: body.job_externo ? String(body.job_externo) : escaneo.job_externo,
      iniciado_en: escaneo.iniciado_en ?? new Date(),
    } as any)
    return res.json({ escaneo_id: escaneo.id, estatus: "procesando" })
  }

  if (estatus === "listo") {
    await escaneoModuleService.updateEscaneo3ds({
      id: escaneo.id,
      estatus: "listo",
      job_externo: body.job_externo ? String(body.job_externo) : escaneo.job_externo,
      obj_storage_key: body.obj_storage_key ? String(body.obj_storage_key) : null,
      stl_storage_key: body.stl_storage_key ? String(body.stl_storage_key) : null,
      vertices: Number.isFinite(Number(body.vertices)) ? Number(body.vertices) : null,
      caras: Number.isFinite(Number(body.caras)) ? Number(body.caras) : null,
      watertight: typeof body.watertight === "boolean" ? body.watertight : null,
      bounding_box: Array.isArray(body.bounding_box) ? body.bounding_box : null,
      terminado_en: new Date(),
    } as any)
    return res.json({ escaneo_id: escaneo.id, estatus: "listo" })
  }

  if (estatus === "fallido") {
    await escaneoModuleService.updateEscaneo3ds({
      id: escaneo.id,
      estatus: "fallido",
      job_externo: body.job_externo ? String(body.job_externo) : escaneo.job_externo,
      error: body.error ? String(body.error).slice(0, 2000) : "El trabajo falló sin detalle",
      terminado_en: new Date(),
    } as any)

    // Si se cobró y no se entregó, se devuelve. El gasto se hace al disparar
    // el trabajo, así que este es el único momento en que se puede saber que
    // no hubo nada a cambio.
    const cobrado = Number(escaneo.creditos_cobrados) || 0
    if (cobrado > 0) {
      try {
        await grantCreditsWorkflow(req.scope).run({
          input: {
            customer_id: escaneo.customer_id,
            amount: cobrado,
            type: "reembolso",
            reference_id: escaneo.id,
            description: "Reembolso: el escaneo 3D no pudo completarse",
          },
        })
      } catch (e) {
        // El escaneo ya quedó marcado como fallido; que el reembolso truene
        // no debe hacer que n8n reintente todo y lo marque dos veces. Queda
        // en el log para resolverlo a mano.
        console.error(`[escaneos] falló el reembolso de ${escaneo.id}:`, e)
      }
    }

    return res.json({ escaneo_id: escaneo.id, estatus: "fallido", reembolso: cobrado })
  }

  return res.status(400).json({ message: `estatus desconocido: ${estatus}` })
}
