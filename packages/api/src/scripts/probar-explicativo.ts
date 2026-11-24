// Hace un video explicativo YA, desde la terminal del servidor, y muestra el
// resultado o el error (sin pasar por el panel). Gasta ~0.15 USD de voz.
// Uso: TEMA="por qué se quema el MDF en el láser" NODE_ENV=production bunx medusa exec ./src/scripts/probar-explicativo.ts
import { ExecArgs } from "@medusajs/framework/types"

import { explicativoListo, hacerExplicativo } from "../lib/fabrica/explicativo"
import { chromeBin } from "../lib/fabrica/poster"
import { ffmpegDisponible } from "../lib/fabrica/video"
import { iaSocial } from "../lib/social-hub"

export default async function probarExplicativo({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  console.log("Requisitos:", { fal: !!(process.env.FAL_KEY || "").trim(), ia: iaSocial(), ffmpeg: ffmpegDisponible(), chrome: chromeBin() })
  if (!explicativoListo()) return console.log("✗ Falta un requisito (arriba sale cuál está en false o null).")
  console.log("Haciendo el video (3 a 8 minutos)…")
  const r = await hacerExplicativo(container, logger, { forzar: true, tema: process.env.TEMA || undefined })
  console.log(r.hecho ? `✓ Listo: «${r.tema}» · ${r.segundos} s · ${r.costo_usd} USD · quedó en Pendientes del Social Hub` : `✗ ${r.motivo}`)
}
