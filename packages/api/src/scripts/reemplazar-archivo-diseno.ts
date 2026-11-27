// Reemplaza el archivo que se entrega de un diseño digital (27 nov 2026: la
// plantilla de bisagra y la brida tenían el ZIP dañado). Revisa el archivo nuevo
// con lib/revisar-archivo-diseno.ts y, si está sano, lo sube a la MISMA llave del
// bucket privado (los compradores que vuelvan a descargar reciben el bueno).
// No publica ni despublica: el producto se queda en el estado que tenga; lo
// vuelves a publicar desde el admin cuando lo revises.
//
// Uso (desde packages/api):
//   ./node_modules/.bin/medusa exec ./src/scripts/reemplazar-archivo-diseno.ts <handle> <ruta del archivo>
// Ejemplo:
//   ./node_modules/.bin/medusa exec ./src/scripts/reemplazar-archivo-diseno.ts plantilla-bisagra-europea-35mm-dxf /tmp/plantilla-bisagra-35.zip
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { readFileSync } from "fs"

import { uploadFile } from "../lib/backblaze"
import { problemaArchivoDiseno } from "../lib/revisar-archivo-diseno"

export default async function reemplazarArchivoDiseno({ container, args }: ExecArgs) {
  const [handle, ruta] = args || []
  if (!handle || !ruta) {
    console.log("Uso: medusa exec ./src/scripts/reemplazar-archivo-diseno.ts <handle> <ruta del archivo>")
    return
  }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const [p] = await knex("product").whereNull("deleted_at").where({ handle }).select("id", "status", "metadata").limit(1)
  if (!p) return console.log(`✘ No existe el producto «${handle}».`)
  const meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : p.metadata || {}
  const llave = String(meta.archivo_storage_key || "")
  if (!llave) return console.log(`✘ «${handle}» no tiene archivo_storage_key: no es un diseño digital.`)

  let buf: Buffer
  try {
    buf = readFileSync(ruta)
  } catch (e) {
    return console.log(`✘ No pude leer ${ruta}: ${(e as Error).message}`)
  }
  // El archivo nuevo debe ser del mismo tipo que la llave (zip con zip, stl con stl)
  const ext = (s: string) => (s.split(".").pop() || "").toLowerCase()
  if (ext(ruta) !== ext(llave)) return console.log(`✘ El archivo es .${ext(ruta)} y el del producto es .${ext(llave)}: deben coincidir.`)
  const problema = problemaArchivoDiseno(ruta, buf)
  if (problema) return console.log(`✘ El archivo nuevo tampoco sirve: ${problema}`)

  const r = await uploadFile(buf, llave)
  if (!r.ok) return console.log(`✘ No se pudo subir: ${r.reason}`)

  // La vista 3D automática se rehace con el archivo nuevo (jobs/vistas-3d.ts)
  const limpio = { ...meta, vista3d_error: "", ...(meta.vista3d_auto ? { vista_previa: "", vista3d_v: "" } : {}) }
  await (container.resolve(Modules.PRODUCT) as any).updateProducts(p.id, { metadata: limpio })

  console.log(`✔ Archivo de «${handle}» reemplazado (${buf.length} bytes) en ${llave}.`)
  console.log(`  Estado del producto: ${p.status}. ${p.status === "published" ? "Ya está a la venta con el archivo nuevo." : "Revísalo y publícalo desde el admin cuando quieras."}`)
}
