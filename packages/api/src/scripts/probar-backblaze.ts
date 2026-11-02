// Prueba que el sitio puede guardar y leer archivos en Backblaze B2 (lo usan
// las fotos del escaneo 3D, las entregas de diseños y las solicitudes).
// Sube un archivo de texto de unos bytes a pruebas/ y lo vuelve a descargar.
// No imprime llaves ni direcciones firmadas.
//
// Uso (desde packages/api):
//   ./node_modules/.bin/medusa exec ./src/scripts/probar-backblaze.ts
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { randomUUID } from "crypto"

import { getSignedDownloadUrl, uploadFile } from "../lib/backblaze"

export default async function probarBackblaze({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const texto = `prueba HETNA ${new Date().toISOString()}`
  const llave = `pruebas/${randomUUID()}.txt`

  const subida = await uploadFile(Buffer.from(texto), llave, "text/plain")
  if (!subida.ok) {
    logger.error(`✘ SUBIDA FALLÓ: ${subida.reason}`)
    return
  }
  logger.info("✔ Subida a Backblaze correcta")

  const firmada = await getSignedDownloadUrl(llave, 120)
  if (!firmada.ok) {
    logger.error(`✘ NO SE PUDO FIRMAR LA DESCARGA: ${firmada.reason}`)
    return
  }
  const r = await fetch(firmada.url)
  const leido = await r.text()
  logger.info(
    r.ok && leido === texto
      ? "✔ Descarga correcta: el sitio guarda y lee archivos en Backblaze."
      : `✘ La descarga respondió ${r.status}`
  )
}
