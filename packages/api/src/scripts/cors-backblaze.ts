// Pone las reglas CORS del bucket privado de Backblaze para que el navegador
// suba los archivos de /fabricacion directo a B2 (hasta 100 MB sin pasar por
// este servidor) y el visor de planos pueda leerlos con liga firmada.
// Se corre UNA vez después de desplegar (y otra vez si cambia el bucket).
//
// Uso (desde packages/api):
//   ./node_modules/.bin/medusa exec ./src/scripts/cors-backblaze.ts
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ORIGENES_CORS, ponerCorsBucket } from "../lib/backblaze"

export default async function corsBackblaze({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const r = await ponerCorsBucket()
  if (!r.ok) {
    logger.error(`✘ NO SE PUDIERON PONER LAS REGLAS CORS: ${r.reason}`)
    logger.error("  Si dice 401 o unauthorized, la llave de B2 necesita el permiso writeBuckets.")
    return
  }
  logger.info(`✔ Reglas CORS puestas para: ${ORIGENES_CORS.join(", ")}`)
}
