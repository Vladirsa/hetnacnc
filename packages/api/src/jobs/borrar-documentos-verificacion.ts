// Todos los días: borra los documentos de verificación (identificación y fotos)
// que ya no se necesitan, como promete el Aviso de privacidad (sección 7):
//
//   - Verificación rechazada o nunca enviada, sin cambios en 180 días:
//     se borran los archivos y el expediente queda vacío.
//   - Taller dado de baja (status "terminated") hace más de 90 días:
//     se borran los archivos y el expediente.
//   - Taller que ya no existe: se borra todo de inmediato.
//
// Los talleres verificados y activos conservan sus documentos (por si hay que
// revisar una queja). El taller puede pedir el borrado antes en cualquier momento.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { servicio } from "../lib/verificacion"
import { borrarArchivo, borrarCarpeta, listaArchivos } from "../lib/verificacion-archivos"

const DIA = 24 * 60 * 60 * 1000
export const DIAS_SIN_ENVIAR = 180
export const DIAS_TRAS_BAJA = 90

export default async function borrarDocumentosVerificacion(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ahora = Date.now()

  try {
    const filas = await servicio(container).listVerificacionTallers({}, { take: 5000 })
    if (!filas.length) return

    const ids = [...new Set(filas.map((f) => f.seller_id))]
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["id", "status", "updated_at"],
      filters: { id: ids },
    })
    // Seguro: si la consulta no devuelve ningún taller, algo falló; no se borra nada
    if (!sellers?.length) {
      logger.warn(`[verificacion] limpieza omitida: no se pudieron leer los talleres`)
      return
    }
    const porId = new Map((sellers as { id: string; status?: string; updated_at?: string | Date }[]).map((s) => [s.id, s]))

    let vaciados = 0
    let eliminados = 0
    for (const f of filas) {
      const archivos = listaArchivos(f.archivos)
      const s = porId.get(f.seller_id)
      const editado = new Date(f.updated_at as unknown as string).getTime()

      // Taller borrado, o dado de baja hace más de 90 días: fuera todo
      const bajaVieja =
        s?.status === "terminated" && ahora - new Date(String(s.updated_at)).getTime() > DIAS_TRAS_BAJA * DIA
      if (!s || bajaVieja) {
        await borrarCarpeta(f.seller_id)
        await servicio(container).deleteVerificacionTallers(f.id)
        eliminados++
        continue
      }

      // Rechazada o nunca enviada, sin movimiento en 180 días: se vacía
      if (
        (f.estado === "rechazado" || f.estado === "borrador") &&
        archivos.length > 0 &&
        ahora - editado > DIAS_SIN_ENVIAR * DIA
      ) {
        for (const a of archivos) await borrarArchivo(f.seller_id, a)
        await servicio(container).updateVerificacionTallers({ id: f.id, archivos: { lista: [] }, estado: "borrador" })
        vaciados++
      }
    }

    if (vaciados || eliminados) {
      logger.info(`[verificacion] limpieza: ${vaciados} expedientes vaciados, ${eliminados} eliminados`)
    }
  } catch (e) {
    logger.error(`[verificacion] no se pudo hacer la limpieza de documentos: ${(e as Error).message}`)
  }
}

export const config = {
  name: "borrar-documentos-verificacion",
  schedule: "41 10 * * *",
}
