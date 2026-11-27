// Sube a Backblaze (bucket PRIVADO) los diseños generados por scripts/disenos/ (27 nov 2026:
// el dueño pidió que todos los STL y diseños que se generen queden guardados ahí).
// Por cada <nombre>.zip de la carpeta: lo revisa (lib/revisar-archivo-diseno.ts) y, si está
// sano, lo sube a disenos-generados/<nombre>/<nombre>.zip junto con su vista previa
// <nombre>.png si existe. No publica nada en la tienda: para venderlo se usa «Subir diseños».
//
// Uso (desde packages/api; normalmente lo llama scripts/disenos/guardar_en_b2.sh):
//   ./node_modules/.bin/medusa exec ./src/scripts/guardar-disenos-b2.ts <carpeta>
import type { ExecArgs } from "@medusajs/framework/types"
import { existsSync, readFileSync, readdirSync } from "fs"
import { join } from "path"

import { uploadFile } from "../lib/backblaze"
import { problemaArchivoDiseno } from "../lib/revisar-archivo-diseno"

export const PREFIJO_B2 = "disenos-generados"

export default async function guardarDisenosB2({ args }: ExecArgs) {
  const carpeta = (args || [])[0]
  if (!carpeta || !existsSync(carpeta)) {
    console.log("Uso: medusa exec ./src/scripts/guardar-disenos-b2.ts <carpeta con los .zip>")
    return
  }
  const zips = readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".zip")).sort()
  if (!zips.length) return console.log(`✘ No hay archivos .zip en ${carpeta}.`)

  let ok = 0
  for (const z of zips) {
    const nombre = z.replace(/\.zip$/i, "")
    const buf = readFileSync(join(carpeta, z))
    const problema = problemaArchivoDiseno(z, buf)
    if (problema) {
      console.log(`✘ ${nombre}: no se subió — ${problema}`)
      continue
    }
    const llave = `${PREFIJO_B2}/${nombre}/${z}`
    const r = await uploadFile(buf, llave, "application/zip")
    if (!r.ok) {
      console.log(`✘ ${nombre}: Backblaze respondió ${r.reason}`)
      continue
    }
    const png = join(carpeta, `${nombre}.png`)
    if (existsSync(png)) await uploadFile(readFileSync(png), `${PREFIJO_B2}/${nombre}/${nombre}.png`, "image/png")
    ok++
    console.log(`✔ ${nombre} → ${llave} (${Math.round(buf.length / 1024)} KB)`)
  }
  console.log(`\n${ok} de ${zips.length} diseños guardados en Backblaze (${PREFIJO_B2}/).`)
}
