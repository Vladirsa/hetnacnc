// Mueve los escaneos 3D entre la plataforma y la GPU: despacha los que están
// en cola y recoge los que ya terminaron.
//
// Por qué un job y no un webhook: RunPod puede avisar por webhook, pero
// entonces el trabajo depende de que ese aviso llegue -- y si se pierde (el
// backend reiniciando, una red intermitente), el escaneo se queda "procesando"
// para siempre y nadie se entera. Consultando desde aquí el estado se recupera
// solo en la siguiente vuelta. Es más tráfico y menos elegante; también es la
// diferencia entre un servicio que se repara solo y uno que hay que destrabar
// a mano.
//
// El callback (/escaneos/callback) sigue existiendo para que n8n pueda
// reportar si algún día se arma el flujo por ahí. Los dos caminos son
// idempotentes, así que pueden convivir sin pisarse.
import { MedusaContainer } from "@medusajs/framework/types"

import { ESCANEO_MODULE } from "../modules/escaneo"
import EscaneoModuleService from "../modules/escaneo/service"
import { getSignedDownloadUrl } from "../lib/backblaze"
import { grantCreditsWorkflow } from "../workflows/grant-credits"

// Cuántos atender por vuelta. El tope existe para no disparar cincuenta
// trabajos de GPU de golpe si algo se acumuló.
const POR_VUELTA = 5

// Un trabajo que lleva más de esto sin terminar se da por perdido. Un escaneo
// profesional con 60 fotos puede tardar bastante, de ahí que sea generoso.
const HORAS_LIMITE = 3

export default async function despacharEscaneos(container: MedusaContainer) {
  const apiKey = process.env.RUNPOD_API_KEY
  const endpointId = process.env.RUNPOD_SCAN3D_ENDPOINT_ID

  if (!apiKey || !endpointId) {
    // Sin credenciales no hay nada que hacer. No se avisa cada minuto para no
    // llenar el log.
    return
  }

  const logger = container.resolve("logger")
  const servicio = container.resolve<EscaneoModuleService>(ESCANEO_MODULE)
  const base = `https://api.runpod.ai/v2/${endpointId}`
  const cabeceras = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }

  // --- 1. Despachar los que están en cola ---
  const enCola = await servicio.listEscaneo3ds(
    { estatus: "pendiente" },
    { order: { created_at: "ASC" }, take: POR_VUELTA }
  )

  for (const escaneo of enCola) {
    try {
      // RunPod baja las fotos por su cuenta, así que necesita URLs que
      // funcionen sin credenciales. Se firman cortas: para cuando el trabajo
      // termina ya no sirven de nada.
      const urls: string[] = []
      // fotos es jsonb: el tipo generado lo da como Record, pero lo que se
      // guarda siempre es un arreglo de llaves (ver createEscaneoStep).
      const llaves = Array.isArray(escaneo.fotos) ? (escaneo.fotos as string[]) : []
      for (const llave of llaves) {
        const firmado = await getSignedDownloadUrl(llave, 3600 * 6)
        if (!firmado.ok) {
          throw new Error(`no se pudo firmar ${llave}: ${firmado.reason}`)
        }
        urls.push(firmado.url)
      }

      const res = await fetch(`${base}/run`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({
          input: {
            mode: escaneo.modo,
            job_id: escaneo.id,
            image_urls: urls,
            output_prefix: `escaneos3d/${escaneo.customer_id}/${escaneo.id}/`,
          },
        }),
      })

      if (!res.ok) {
        throw new Error(`RunPod respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }

      const cuerpo = await res.json()
      await servicio.updateEscaneo3ds({
        id: escaneo.id,
        estatus: "procesando",
        job_externo: cuerpo.id ? String(cuerpo.id) : null,
        iniciado_en: new Date(),
      } as any)

      logger.info(`[escaneos] ${escaneo.id} despachado a RunPod (${cuerpo.id})`)
    } catch (e) {
      // No se marca fallido al primer tropiezo: puede ser la red. Se deja en
      // cola y se reintenta en la siguiente vuelta. Lo que sí tiene límite es
      // el tiempo: más abajo, los que llevan demasiado se cierran.
      logger.error(`[escaneos] no se pudo despachar ${escaneo.id}: ${e}`)
    }
  }

  // --- 2. Recoger los que ya terminaron ---
  const enProceso = await servicio.listEscaneo3ds(
    { estatus: "procesando" },
    { order: { created_at: "ASC" }, take: 25 }
  )

  for (const escaneo of enProceso) {
    const vencido =
      escaneo.iniciado_en &&
      Date.now() - new Date(escaneo.iniciado_en).getTime() > HORAS_LIMITE * 3600 * 1000

    if (!escaneo.job_externo) {
      if (vencido) {
        await cerrarComoFallido(container, servicio, escaneo, "El trabajo nunca llegó a la GPU")
      }
      continue
    }

    try {
      const res = await fetch(`${base}/status/${escaneo.job_externo}`, { headers: cabeceras })
      if (!res.ok) {
        throw new Error(`status respondió ${res.status}`)
      }
      const cuerpo = await res.json()

      if (cuerpo.status === "COMPLETED") {
        const salida = cuerpo.output || {}
        if (salida.error) {
          await cerrarComoFallido(container, servicio, escaneo, String(salida.error))
          continue
        }
        await servicio.updateEscaneo3ds({
          id: escaneo.id,
          estatus: "listo",
          obj_storage_key: salida.obj_storage_key || null,
          stl_storage_key: salida.stl_storage_key || null,
          vertices: Number.isFinite(Number(salida.vertices)) ? Number(salida.vertices) : null,
          caras: Number.isFinite(Number(salida.caras)) ? Number(salida.caras) : null,
          watertight: typeof salida.watertight === "boolean" ? salida.watertight : null,
          bounding_box: Array.isArray(salida.bounding_box_mm) ? salida.bounding_box_mm : null,
          terminado_en: new Date(),
        } as any)
        logger.info(`[escaneos] ${escaneo.id} terminado`)
        continue
      }

      if (cuerpo.status === "FAILED" || cuerpo.status === "CANCELLED" || cuerpo.status === "TIMED_OUT") {
        await cerrarComoFallido(
          container,
          servicio,
          escaneo,
          String(cuerpo.error || cuerpo.output?.error || cuerpo.status)
        )
        continue
      }

      if (vencido) {
        await cerrarComoFallido(container, servicio, escaneo, `El trabajo excedió ${HORAS_LIMITE} horas`)
      }
    } catch (e) {
      logger.error(`[escaneos] no se pudo consultar ${escaneo.id}: ${e}`)
    }
  }
}

// Marca el escaneo como fallido y devuelve los créditos. El gasto se hace al
// disparar el trabajo, así que este es el único momento en que se puede saber
// que no hubo nada a cambio.
async function cerrarComoFallido(
  container: MedusaContainer,
  servicio: EscaneoModuleService,
  escaneo: { id: string; customer_id: string; creditos_cobrados: number },
  motivo: string
) {
  const logger = container.resolve("logger")

  await servicio.updateEscaneo3ds({
    id: escaneo.id,
    estatus: "fallido",
    error: motivo.slice(0, 2000),
    terminado_en: new Date(),
  } as any)

  const cobrado = Number(escaneo.creditos_cobrados) || 0
  if (cobrado > 0) {
    try {
      await grantCreditsWorkflow(container as any).run({
        input: {
          customer_id: escaneo.customer_id,
          amount: cobrado,
          type: "reembolso",
          reference_id: escaneo.id,
          description: "Reembolso: el escaneo 3D no pudo completarse",
        },
      })
    } catch (e) {
      // El escaneo ya quedó cerrado; que el reembolso truene no debe dejarlo
      // colgado en "procesando" para siempre. Queda en el log para resolverlo
      // a mano.
      logger.error(`[escaneos] falló el reembolso de ${escaneo.id}: ${e}`)
    }
  }

  logger.error(`[escaneos] ${escaneo.id} fallido: ${motivo}`)
}

export const config = {
  name: "despachar-escaneos",
  // Cada minuto: un taller que sube fotos espera ver movimiento pronto, y la
  // vuelta no cuesta nada cuando no hay nada en cola.
  schedule: "* * * * *",
}
