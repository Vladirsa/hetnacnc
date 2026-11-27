// Revisa una sola vez los archivos de TODOS los diseños digitales ya publicados
// (26 nov 2026: la brida escalonada M12 se vendía con un STL dañado). Sólo lee:
// no cambia ni despublica nada; al final imprime la lista de los que fallan.
//   - que el archivo exista en el bucket privado y se pueda bajar
//   - ZIP: que abra completo; STL: que traiga triángulos (lib/revisar-archivo-diseno.ts)
//   - otros formatos (DXF, SVG, STEP...): sólo que exista y no venga vacío
//
// Uso (desde packages/api):
//   ./node_modules/.bin/medusa exec ./src/scripts/revisar-archivos-disenos.ts
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../lib/backblaze"
import { problemaArchivoDiseno } from "../lib/revisar-archivo-diseno"

export default async function revisarArchivosDisenos({ container }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const filas = await knex("product")
    .whereNull("deleted_at")
    .whereRaw("metadata->>'producto_digital' = 'true'")
    .select("id", "handle", "status", "metadata")
    .orderBy("created_at", "asc")

  const malos: { handle: string; status: string; motivo: string }[] = []
  let revisados = 0
  for (const f of filas) {
    const meta = typeof f.metadata === "string" ? JSON.parse(f.metadata) : f.metadata || {}
    const llave = String(meta.archivo_storage_key || "")
    if (!llave) {
      malos.push({ handle: f.handle, status: f.status, motivo: "sin archivo (no hay qué entregar)" })
      continue
    }
    let motivo: string | null = null
    try {
      const liga = await getSignedDownloadUrl(llave, 600)
      if (!liga.ok) throw new Error(liga.reason)
      const r = await fetch(liga.url, { signal: AbortSignal.timeout(180_000) })
      if (r.status === 404) motivo = "el archivo no existe en el bucket"
      else if (!r.ok) motivo = `no se pudo bajar (${r.status})`
      else {
        const buf = Buffer.from(await r.arrayBuffer())
        motivo = buf.length === 0 ? "el archivo está vacío" : problemaArchivoDiseno(llave, buf)
      }
    } catch (e) {
      motivo = `no se pudo revisar: ${(e as Error).message}`
    }
    revisados++
    console.log(`${motivo ? "✘" : "✔"} ${f.handle} (${f.status})${motivo ? ` — ${motivo}` : ""}`)
    if (motivo) malos.push({ handle: f.handle, status: f.status, motivo })
  }

  console.log(`\n${filas.length} diseños digitales, ${revisados} archivos revisados, ${malos.length} con problema.`)
  for (const m of malos) console.log(`  ✘ ${m.handle} [${m.status}]: ${m.motivo}`)
}
