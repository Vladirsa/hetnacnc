// Cada día: borra los archivos de solicitudes cerradas o canceladas hace más
// de DIAS_CONSERVACION días y las subidas que nunca se usaron (lib/conservacion-archivos).
//
// Arranca en MODO REPORTE: sólo anota en el log (y los lunes manda un correo a
// HETNA) cuántos borraría. Borra de verdad sólo con ARCHIVOS_BORRADO=1 en el
// .env del API. Así el primer borrado (que incluye solicitudes viejas) se
// revisa antes: lo borrado no se recupera.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DIAS_CONSERVACION, DIAS_HUERFANOS, borrarArchivosSolicitud, borrarHuerfano, pendientesDeBorrar } from "../lib/conservacion-archivos"
import { folioTexto } from "../lib/licitacion"
import { sendEmail } from "../lib/resend"

export default async function conservacionArchivos(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    const { solicitudes, huerfanos } = await pendientesDeBorrar(knex)
    if (!solicitudes.length && !huerfanos.length) return
    const real = process.env.ARCHIVOS_BORRADO === "1"
    if (!real) {
      const resumen = `${solicitudes.length} solicitudes con archivos de más de ${DIAS_CONSERVACION} días (${solicitudes
        .slice(0, 20)
        .map((s) => folioTexto(s.folio))
        .join(", ")}) y ${huerfanos.length} subidas sin usar de más de ${DIAS_HUERFANOS} días`
      logger.info(`[conservacion] MODO REPORTE (falta ARCHIVOS_BORRADO=1): se borrarían ${resumen}`)
      if (new Date().getUTCDay() === 1 && process.env.HETNA_LEADS_EMAIL) {
        await sendEmail({
          to: process.env.HETNA_LEADS_EMAIL,
          subject: "Conservación de archivos: revisión antes de borrar",
          html: `<p>La política de conservación borraría: ${resumen}.</p><p>Todavía no se borró nada. Para activarla, agrega <code>ARCHIVOS_BORRADO=1</code> al .env del API y despliega.</p>`,
        }).catch(() => null)
      }
      return
    }
    let nS = 0
    let nH = 0
    for (const s of solicitudes) if ((await borrarArchivosSolicitud(knex, s, "sistema", logger)).ok) nS++
    for (const h of huerfanos) if (await borrarHuerfano(knex, h.clave)) nH++
    logger.info(`[conservacion] borrados: archivos de ${nS} solicitudes, ${nH} subidas sin usar`)
  } catch (e) {
    logger.error(`[conservacion] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "conservacion-archivos",
  schedule: "17 9 * * *",
}
