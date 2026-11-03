// Vistas previas con IA: una foto → modelo 3D con textura (Tencent HY 3D).
//
// Mismo esquema que despachar-escaneos.ts (RunPod): se consulta el estado en
// cada vuelta en lugar de esperar un aviso, así un reinicio no deja nada
// colgado. Tencent borra sus archivos en un día, por eso en cuanto el modelo
// está listo se copia a Backblaze (GLB para el visor y STL para fabricar).
import { MedusaContainer } from "@medusajs/framework/types"

import { ESCANEO_MODULE } from "../modules/escaneo"
import EscaneoModuleService from "../modules/escaneo/service"
import { getSignedDownloadUrl, uploadFile } from "../lib/backblaze"
import { glbAStl } from "../lib/glb-a-stl"
import { consultarModelo, enviarModelo, ErrorTencent, tencentListo } from "../lib/tencent3d"
import { cerrarComoFallido } from "./despachar-escaneos"

// Tencent acepta 3 trabajos al mismo tiempo por cuenta.
const SIMULTANEOS = 3
// Normalmente tarda 2 a 5 minutos.
const MINUTOS_LIMITE = 30
const MAX_GLB = 150 * 1024 * 1024
const PREFIJO = "tencent:"

export default async function despacharEscaneosIa(container: MedusaContainer) {
  if (!tencentListo()) return
  const logger = container.resolve("logger")
  const servicio = container.resolve<EscaneoModuleService>(ESCANEO_MODULE)

  const enProceso = await servicio.listEscaneo3ds(
    { estatus: "procesando", proveedor: "tencent" } as any,
    { order: { created_at: "ASC" }, take: 25 }
  )

  // --- 1. Recoger los que ya terminaron ---
  let activos = 0
  for (const escaneo of enProceso) {
    const job = (escaneo.job_externo || "").replace(PREFIJO, "")
    const vencido =
      !!escaneo.iniciado_en && Date.now() - new Date(escaneo.iniciado_en).getTime() > MINUTOS_LIMITE * 60 * 1000
    if (!job) {
      await cerrarComoFallido(container, servicio, escaneo as any, "El trabajo nunca llegó al servicio de IA")
      continue
    }
    try {
      const estado = await consultarModelo(job)
      if (estado.estado === "DONE") {
        await guardarResultado(container, servicio, escaneo, estado.archivos)
        continue
      }
      if (estado.estado === "FAIL") {
        await cerrarComoFallido(container, servicio, escaneo as any, mensajeAmable(estado.error))
        continue
      }
      if (vencido) {
        await cerrarComoFallido(container, servicio, escaneo as any, `El modelo tardó más de ${MINUTOS_LIMITE} minutos`)
        continue
      }
      activos++
    } catch (e) {
      activos++
      logger.error(`[escaneos-ia] no se pudo consultar ${escaneo.id}: ${e}`)
    }
  }

  // --- 2. Mandar los que esperan, sin pasar del límite de Tencent ---
  const libres = SIMULTANEOS - activos
  if (libres <= 0) return
  const enCola = await servicio.listEscaneo3ds(
    { estatus: "pendiente", modo: "preview" },
    { order: { created_at: "ASC" }, take: libres }
  )
  for (const escaneo of enCola) {
    const llave = Array.isArray(escaneo.fotos) ? (escaneo.fotos as string[])[0] : null
    if (!llave) {
      await cerrarComoFallido(container, servicio, escaneo as any, "No hay foto para generar el modelo")
      continue
    }
    try {
      const firmada = await getSignedDownloadUrl(llave, 3600 * 2)
      if (!firmada.ok) throw new Error(`no se pudo firmar la foto: ${firmada.reason}`)
      const job = await enviarModelo({
        imagenUrl: firmada.url,
        modelo: "3.1",
        tipo: "Normal",
        caras: Number(process.env.ESCANEO_IA_CARAS) || 400000,
      })
      await servicio.updateEscaneo3ds({
        id: escaneo.id,
        estatus: "procesando",
        proveedor: "tencent",
        job_externo: PREFIJO + job,
        iniciado_en: new Date(),
      } as any)
      logger.info(`[escaneos-ia] ${escaneo.id} enviado a Tencent (${job})`)
    } catch (e) {
      // Errores de la foto (formato, tamaño, contenido) no se arreglan
      // reintentando: se cierra. Lo demás (red, límite) se reintenta.
      const t = e as ErrorTencent
      if (t?.codigo && /InvalidParameter|ImageSize|ImageFormat|ImageDecode|Content|Moderation|Unsupported/i.test(t.codigo)) {
        await cerrarComoFallido(container, servicio, escaneo as any, mensajeAmable(`${t.codigo} ${t.message}`))
      } else {
        logger.error(`[escaneos-ia] no se pudo enviar ${escaneo.id}: ${e}`)
      }
    }
  }
}

async function guardarResultado(
  container: MedusaContainer,
  servicio: EscaneoModuleService,
  escaneo: any,
  archivos: { tipo: string; url: string }[]
) {
  const logger = container.resolve("logger")
  const glb = archivos.find((a) => a.tipo === "GLB")
  if (!glb?.url) {
    await cerrarComoFallido(container, servicio, escaneo, "El servicio de IA no entregó el modelo GLB")
    return
  }
  try {
    const res = await fetch(glb.url)
    if (!res.ok) throw new Error(`descarga respondió ${res.status}`)
    const datos = Buffer.from(await res.arrayBuffer())
    if (datos.length > MAX_GLB) throw new Error(`el GLB pesa ${Math.round(datos.length / 1e6)} MB`)

    const base = `escaneos3d/${escaneo.customer_id}/${escaneo.id}/`
    const subidoGlb = await uploadFile(datos, `${base}modelo.glb`, "model/gltf-binary")
    if (!subidoGlb.ok) throw new Error(subidoGlb.reason)

    // El STL es un extra: si no se puede convertir, el modelo igual se ve.
    let stlKey: string | null = null
    let datosMalla: Record<string, unknown> = {}
    try {
      const conv = glbAStl(datos, Number(escaneo.medida_mm) || 100)
      if (conv) {
        const subidoStl = await uploadFile(conv.stl, `${base}modelo.stl`, "model/stl")
        if (subidoStl.ok) stlKey = subidoStl.storageKey
        datosMalla = { vertices: conv.vertices, caras: conv.triangulos, bounding_box: conv.caja_mm }
      }
    } catch (e) {
      logger.error(`[escaneos-ia] no se pudo convertir a STL ${escaneo.id}: ${e}`)
    }

    await servicio.updateEscaneo3ds({
      id: escaneo.id,
      estatus: "listo",
      glb_storage_key: subidoGlb.storageKey,
      stl_storage_key: stlKey,
      escala_real: false,
      ...datosMalla,
      terminado_en: new Date(),
    } as any)
    logger.info(`[escaneos-ia] ${escaneo.id} listo`)
  } catch (e) {
    // Se reintenta en la siguiente vuelta (los enlaces de Tencent duran un
    // día); si ya se pasó del límite de tiempo, se cierra.
    logger.error(`[escaneos-ia] no se pudo guardar ${escaneo.id}: ${e}`)
    const inicio = escaneo.iniciado_en ? new Date(escaneo.iniciado_en).getTime() : Date.now()
    if (Date.now() - inicio > 6 * 3600 * 1000) {
      await cerrarComoFallido(container, servicio, escaneo, "No se pudo guardar el modelo generado")
    }
  }
}

function mensajeAmable(error?: string): string {
  const t = error || ""
  if (/moderat|content|sensitive/i.test(t)) return "La foto no pasó la revisión de contenido del servicio de IA. Prueba con otra foto de la pieza."
  if (/size|resolution|pixel/i.test(t)) return "La foto no tiene el tamaño adecuado. Usa una foto de al menos 128 px y menos de 8 MB."
  if (/format|decode/i.test(t)) return "No se pudo leer la foto. Súbela en JPG o PNG."
  return t ? `El servicio de IA no pudo generar el modelo (${t.slice(0, 200)})` : "El servicio de IA no pudo generar el modelo"
}

export const config = {
  name: "despachar-escaneos-ia",
  schedule: "* * * * *",
}
